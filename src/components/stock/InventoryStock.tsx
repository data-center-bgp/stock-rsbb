import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDateTime } from "@/lib/dates";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import { Pagination } from "@/components/Pagination";
import { InventoryFilters } from "@/components/stock/InventoryFilters";
import { STOCK_PAGE_SIZE, likePattern, parseStockParams, stockHref, type StockSearchParams } from "@/components/stock/params";
import { ArrowRightIcon } from "@/components/icons";
import { Alert, StockStatus, cardClass, secondaryButtonClass } from "@/components/ui";

type InventoryRow = {
  id_inventory: number;
  qr_token: string;
  current_qty: number;
  item: { nama: string; satuan_jual: string };
  unit: { nama_gudang: string } | null;
  location: { nama_lokasi: string } | null;
  stock_transaction: { created_at: string }[];
};

const numberFormat = new Intl.NumberFormat("id-ID");

// Per Inventori: every inventory row with its current stock — search,
// status/inventory filters and paging, all in the URL.
export async function InventoryStock({ supabase, params }: { supabase: AppSupabaseClient; params: StockSearchParams }) {
  const { q, status, unit, page } = parseStockParams(params);
  const from = (page - 1) * STOCK_PAGE_SIZE;

  let inventoryQuery = supabase
    .from("inventory")
    .select(
      "id_inventory, qr_token, current_qty, item:id_barang!inner(nama, satuan_jual), unit:id_gudang(nama_gudang), location:id_lokasi(nama_lokasi), stock_transaction(created_at)",
      { count: "exact" },
    );
  if (q) inventoryQuery = inventoryQuery.ilike("item.nama", likePattern(q));
  if (status === "habis") inventoryQuery = inventoryQuery.lte("current_qty", 0);
  if (status === "tersedia") inventoryQuery = inventoryQuery.gt("current_qty", 0);
  if (unit) inventoryQuery = inventoryQuery.eq("id_gudang", unit);

  const [inventoryRes, unitsRes] = await Promise.all([
    inventoryQuery
      .order("id_inventory")
      .order("created_at", { referencedTable: "stock_transaction", ascending: false })
      .limit(1, { referencedTable: "stock_transaction" })
      .range(from, from + STOCK_PAGE_SIZE - 1),
    supabase.from("unit").select("id_gudang, nama_gudang").order("nama_gudang"),
  ]);

  // Page past the end (stale link, or filters shrank the result set) — PostgREST
  // rejects the range, so go back to the first page instead of showing an error.
  if (inventoryRes.error?.code === "PGRST103") redirect(stockHref(params, 1));

  const rows = (inventoryRes.data ?? []) as unknown as InventoryRow[];
  const total = inventoryRes.count ?? 0;
  const units = unitsRes.data ?? [];
  const error = inventoryRes.error ?? unitsRes.error;

  return (
    <section className={cardClass}>
      <div className="flex flex-wrap items-center justify-between gap-3 p-5">
        <h2 className="text-lg font-semibold tracking-tight">Daftar Stok</h2>
        <InventoryFilters variant="inventori" units={units} />
      </div>

      {error && (
        <div className="px-5 pb-5">
          <Alert tone="danger">Gagal memuat data: {error.message}</Alert>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-y border-border bg-surface-muted text-left text-xs font-medium text-muted">
              <th className="px-5 py-3 font-medium">Item</th>
              <th className="px-5 py-3 font-medium">Lokasi</th>
              <th className="px-5 py-3 text-right font-medium">Stok</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Terakhir Diperbarui</th>
              <th className="px-5 py-3 text-right font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const lastTx = row.stock_transaction[0]?.created_at;
              return (
                <tr key={row.id_inventory} className="border-b border-border last:border-b-0 hover:bg-surface-muted/60">
                  <td className="px-5 py-3">
                    <p className="font-medium">{row.item.nama}</p>
                    <p className="text-xs text-muted">{row.item.satuan_jual}</p>
                  </td>
                  <td className="px-5 py-3">
                    <p>{row.location?.nama_lokasi}</p>
                    <p className="text-xs text-muted">{row.unit?.nama_gudang}</p>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    <span className="font-semibold">{numberFormat.format(row.current_qty)}</span>{" "}
                    <span className="text-xs text-muted">{row.item.satuan_jual}</span>
                  </td>
                  <td className="px-5 py-3">
                    <StockStatus qty={row.current_qty} />
                  </td>
                  <td className="px-5 py-3 text-muted">{lastTx ? formatDateTime(lastTx) : "—"}</td>
                  <td className="px-5 py-3 text-right">
                    <Link href={`/i/${row.qr_token}`} className={`${secondaryButtonClass} h-8 px-3 text-xs`}>
                      Buka <ArrowRightIcon className="size-3.5" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {!rows.length && !error && (
          <p className="px-5 py-12 text-center text-sm text-muted">
            {q || status || unit ? "Tidak ada item yang cocok dengan filter." : "Belum ada data stok."}
          </p>
        )}
      </div>

      <Pagination
        page={page}
        pageSize={STOCK_PAGE_SIZE}
        total={total}
        noun="item"
        href={(p) => stockHref(params, p)}
      />
    </section>
  );
}
