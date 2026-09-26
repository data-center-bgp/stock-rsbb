"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowRightIcon, PackageIcon, SearchIcon, SpinnerIcon } from "@/components/icons";
import { Alert, fieldClass } from "@/components/ui";
import type { UnitKind } from "@/lib/types";

type InventoryHit = {
  id_inventory: number;
  qr_token: string;
  current_qty: number;
  item: { id_barang: number; nama: string; satuan_jual: string };
  location: { nama_lokasi: string } | null;
};
type CatalogHit = { id_barang: number; nama: string; satuan_jual: string };

const LIMIT = 30;
const QUERY_KEY = "opname:q"; // keep the search when coming back from an item
const numberFormat = new Intl.NumberFormat("id-ID");
const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, "\\$&")}%`;

function readQuery() {
  try {
    return sessionStorage.getItem(QUERY_KEY) ?? "";
  } catch {
    return "";
  }
}

// Find the item to count by name, instead of scanning its label. In a
// hospital unit's inventory, items it doesn't have yet can be added from the
// pharmacy catalog on the spot (units start empty).
export function OpnameItemSearch({ gudang, kind }: { gudang: number; kind: UnitKind }) {
  const router = useRouter();
  const [query, setQuery] = useState(readQuery);
  const [inventory, setInventory] = useState<InventoryHit[] | null>(null);
  const [catalog, setCatalog] = useState<CatalogHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const isUnit = kind === "unit";

  useEffect(() => {
    try {
      sessionStorage.setItem(QUERY_KEY, query);
    } catch {
      // private mode: the search just isn't remembered
    }
    const q = query.trim();
    // A unit lists its items even before typing; the pharmacy's ~850 need a search.
    if (!q && !isUnit) return;
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      const supabase = createClient();
      let invQuery = supabase
        .from("inventory")
        .select("id_inventory, qr_token, current_qty, item:id_barang!inner(id_barang, nama, satuan_jual), location:id_lokasi(nama_lokasi)")
        .eq("id_gudang", gudang)
        .limit(LIMIT);
      if (q) invQuery = invQuery.ilike("item.nama", likePattern(q));
      const [inv, cat] = await Promise.all([
        invQuery,
        isUnit && q.length >= 2
          ? supabase.from("item").select("id_barang, nama, satuan_jual").ilike("nama", likePattern(q)).order("nama").limit(LIMIT)
          : Promise.resolve({ data: [] as CatalogHit[], error: null }),
      ]);
      if (id !== requestId.current) return; // a newer search is on its way
      setLoading(false);
      if (inv.error || cat.error) {
        setError((inv.error ?? cat.error)!.message);
        return;
      }
      const hits = (inv.data as unknown as InventoryHit[]).sort((a, b) => a.item.nama.localeCompare(b.item.nama));
      const held = new Set(hits.map((h) => h.item.id_barang));
      setInventory(hits);
      setCatalog((cat.data as CatalogHit[]).filter((c) => !held.has(c.id_barang)));
    }, q ? 250 : 0);
    return () => clearTimeout(timer);
  }, [query, gudang, isUnit]);

  async function addFromCatalog(item: CatalogHit) {
    setAdding(item.id_barang);
    setError(null);
    const { data, error } = await createClient().rpc("add_unit_item", { p_id_gudang: gudang, p_id_barang: item.id_barang });
    if (error || !data?.[0]) {
      setAdding(null);
      setError(error?.message ?? "Gagal menambahkan item.");
      return;
    }
    router.push(`/i/${data[0].qr_token}?mode=opname`);
  }

  const q = query.trim();
  // Results of an earlier search stay in state; hide them once the box is cleared.
  const showResults = Boolean(q) || isUnit;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari nama item..."
          aria-label="Cari nama item"
          className={`${fieldClass} h-11 w-full pl-10 pr-10`}
        />
        {loading && <SpinnerIcon className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />}
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      {!q && !isUnit && <p className="px-1 text-sm text-muted">Ketik nama item yang akan dihitung.</p>}

      {showResults && inventory && (
        <section>
          <h3 className="mb-1.5 px-1 text-xs font-medium text-muted">
            {isUnit ? "Item di unit ini" : "Item di inventori ini"}
          </h3>
          {inventory.length ? (
            <ul className="overflow-hidden rounded-xl border border-border">
              {inventory.map((hit) => (
                <li key={hit.id_inventory} className="border-b border-border last:border-b-0">
                  <button
                    type="button"
                    onClick={() => router.push(`/i/${hit.qr_token}?mode=opname`)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-muted"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{hit.item.nama}</span>
                      <span className="block truncate text-xs text-muted">
                        {hit.location?.nama_lokasi} · Stok {numberFormat.format(hit.current_qty)} {hit.item.satuan_jual}
                      </span>
                    </span>
                    <ArrowRightIcon className="size-4 shrink-0 text-muted" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-1 text-sm text-muted">
              {q
                ? "Tidak ada yang cocok."
                : "Belum ada item di unit ini. Cari nama item untuk menambahkannya dari katalog."}
            </p>
          )}
          {inventory.length === LIMIT && (
            <p className="mt-1.5 px-1 text-xs text-muted">Menampilkan {LIMIT} item pertama — ketik untuk mempersempit.</p>
          )}
        </section>
      )}

      {showResults && isUnit && q.length >= 2 && catalog.length > 0 && (
        <section>
          <h3 className="mb-1.5 px-1 text-xs font-medium text-muted">Tambah dari katalog farmasi</h3>
          <ul className="overflow-hidden rounded-xl border border-dashed border-border">
            {catalog.map((item) => (
              <li key={item.id_barang} className="border-b border-dashed border-border last:border-b-0">
                <button
                  type="button"
                  disabled={adding !== null}
                  onClick={() => addFromCatalog(item)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-muted disabled:opacity-60"
                >
                  <PackageIcon className="size-4 shrink-0 text-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{item.nama}</span>
                    <span className="block text-xs text-muted">{item.satuan_jual}</span>
                  </span>
                  {adding === item.id_barang ? (
                    <SpinnerIcon className="size-4 shrink-0 text-muted" />
                  ) : (
                    <span className="shrink-0 text-xs font-semibold text-primary">+ Tambah</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
