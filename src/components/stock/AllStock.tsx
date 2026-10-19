import Link from "next/link";
import { redirect } from "next/navigation";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import { Pagination } from "@/components/Pagination";
import { InventoryFilters } from "@/components/stock/InventoryFilters";
import { STOCK_PAGE_SIZE, likePattern, parseStockParams, stockHref, type StockSearchParams } from "@/components/stock/params";
import { ArrowRightIcon, ChevronDownIcon } from "@/components/icons";
import { Alert, StockStatus, cardClass, secondaryButtonClass } from "@/components/ui";
import type { UnitKind } from "@/lib/types";

// One row of stock_rsbb.item_stock (0014): an item summed over every inventory.
type ItemStockRow = {
  id_barang: number;
  item_nama: string;
  satuan_jual: string;
  total_qty: number;
  farmasi_qty: number;
  unit_qty: number;
  unit_count: number;
};

type Holder = {
  id_barang: number;
  id_inventory: number;
  qr_token: string;
  current_qty: number;
  unit: { nama_gudang: string; kind: UnitKind } | null;
  location: { nama_lokasi: string } | null;
};

const numberFormat = new Intl.NumberFormat("id-ID");
// Name, total, pharmacy, units, status, chevron.
const columns = "grid grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_6rem_1.5rem] items-center gap-4";

// Semua Stok: each item once, with its stock over all inventories; open a row
// to see which inventory holds how much.
export async function AllStock({ supabase, params }: { supabase: AppSupabaseClient; params: StockSearchParams }) {
  const { q, status, sebaran, page } = parseStockParams(params);
  const from = (page - 1) * STOCK_PAGE_SIZE;

  let query = supabase.from("item_stock").select("*", { count: "exact" });
  if (q) query = query.ilike("item_nama", likePattern(q));
  if (status === "habis") query = query.lte("total_qty", 0);
  if (status === "tersedia") query = query.gt("total_qty", 0);
  if (sebaran === "unit") query = query.gt("unit_qty", 0);

  const res = await query.order("item_nama").order("id_barang").range(from, from + STOCK_PAGE_SIZE - 1);
  // Page past the end: back to the first page (see InventoryStock).
  if (res.error?.code === "PGRST103") redirect(stockHref(params, 1));

  const rows = (res.data ?? []) as ItemStockRow[];
  const total = res.count ?? 0;

  // Where each of this page's items sits: pharmacy inventories first, then units by name.
  const holdersByItem = new Map<number, Holder[]>();
  let holdersError: { message: string } | null = null;
  if (rows.length) {
    const holdersRes = await supabase
      .from("inventory")
      .select("id_barang, id_inventory, qr_token, current_qty, unit:id_gudang(nama_gudang, kind), location:id_lokasi(nama_lokasi)")
      .in("id_barang", rows.map((r) => r.id_barang));
    holdersError = holdersRes.error;
    for (const h of (holdersRes.data ?? []) as unknown as Holder[]) {
      holdersByItem.set(h.id_barang, [...(holdersByItem.get(h.id_barang) ?? []), h]);
    }
    for (const list of holdersByItem.values()) {
      list.sort(
        (a, b) =>
          Number(a.unit?.kind === "unit") - Number(b.unit?.kind === "unit") ||
          (a.unit?.nama_gudang ?? "").localeCompare(b.unit?.nama_gudang ?? ""),
      );
    }
  }
  const error = res.error ?? holdersError;

  return (
    <section className={cardClass}>
      <div className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Semua Stok</h2>
          <p className="mt-0.5 text-sm text-muted">Jumlah tiap item di seluruh inventori. Klik item untuk melihat rinciannya.</p>
        </div>
        <InventoryFilters variant="semua" units={[]} />
      </div>

      {error && (
        <div className="px-5 pb-5">
          <Alert tone="danger">Gagal memuat data: {error.message}</Alert>
        </div>
      )}

      <div className="overflow-x-auto">
        <div className="min-w-[820px]">
          <div className={`${columns} border-y border-border bg-surface-muted px-5 py-3 text-xs font-medium text-muted`}>
            <span>Item</span>
            <span className="text-right">Total</span>
            <span className="text-right">Farmasi</span>
            <span className="text-right">Di Unit</span>
            <span>Status</span>
            <span />
          </div>

          <ul>
            {rows.map((row) => {
              const holders = holdersByItem.get(row.id_barang) ?? [];
              return (
                <li key={row.id_barang} className="border-b border-border last:border-b-0">
                  <details className="group">
                    <summary
                      className={`${columns} cursor-pointer list-none px-5 py-3 hover:bg-surface-muted/60 [&::-webkit-details-marker]:hidden`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{row.item_nama}</span>
                        <span className="block text-xs text-muted">{row.satuan_jual}</span>
                      </span>
                      <span className="text-right tabular-nums">
                        <span className="font-semibold">{numberFormat.format(row.total_qty)}</span>{" "}
                        <span className="text-xs text-muted">{row.satuan_jual}</span>
                      </span>
                      <span className="text-right tabular-nums">{numberFormat.format(row.farmasi_qty)}</span>
                      <span className="text-right tabular-nums">
                        {numberFormat.format(row.unit_qty)}
                        {row.unit_count > 0 && <span className="block text-xs text-muted">di {row.unit_count} unit</span>}
                      </span>
                      <span>
                        <StockStatus qty={row.total_qty} />
                      </span>
                      <ChevronDownIcon className="size-4 text-muted transition-transform group-open:rotate-180" />
                    </summary>

                    <div className="bg-surface-muted/40 px-5 pb-4 pt-1">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs font-medium text-muted">
                            <th className="py-2 pr-4 font-medium">Inventori</th>
                            <th className="py-2 pr-4 font-medium">Lokasi</th>
                            <th className="py-2 pr-4 text-right font-medium">Stok</th>
                            <th className="py-2 pr-4 font-medium">Status</th>
                            <th className="py-2 text-right font-medium">Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {holders.map((h) => (
                            <tr key={h.id_inventory} className="border-t border-border">
                              <td className="py-2 pr-4">
                                <p className="font-medium">{h.unit?.nama_gudang}</p>
                                <p className="text-xs text-muted">{h.unit?.kind === "unit" ? "Unit rumah sakit" : "Farmasi"}</p>
                              </td>
                              <td className="py-2 pr-4">{h.location?.nama_lokasi}</td>
                              <td className="py-2 pr-4 text-right tabular-nums">
                                <span className="font-semibold">{numberFormat.format(h.current_qty)}</span>{" "}
                                <span className="text-xs text-muted">{row.satuan_jual}</span>
                              </td>
                              <td className="py-2 pr-4">
                                <StockStatus qty={h.current_qty} />
                              </td>
                              <td className="py-2 text-right">
                                <Link href={`/i/${h.qr_token}`} className={`${secondaryButtonClass} h-8 px-3 text-xs`}>
                                  Buka <ArrowRightIcon className="size-3.5" />
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        </div>

        {!rows.length && !error && (
          <p className="px-5 py-12 text-center text-sm text-muted">
            {q || status || sebaran ? "Tidak ada item yang cocok dengan filter." : "Belum ada data stok."}
          </p>
        )}
      </div>

      <Pagination page={page} pageSize={STOCK_PAGE_SIZE} total={total} noun="item" href={(p) => stockHref(params, p)} />
    </section>
  );
}
