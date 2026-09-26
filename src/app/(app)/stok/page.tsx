import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { formatDateTime } from "@/lib/dates";
import { Pagination } from "@/components/Pagination";
import { InventoryFilters } from "@/components/stock/InventoryFilters";
import { DesktopOnly } from "@/components/shell/DesktopOnly";
import { ArrowRightIcon } from "@/components/icons";
import { Alert, PageHeader, StockStatus, cardClass, secondaryButtonClass } from "@/components/ui";

export const metadata: Metadata = { title: "Data Stok — Stock RSBB" };

const PAGE_SIZE = 25;

type InventoryRow = {
  id_inventory: number;
  qr_token: string;
  current_qty: number;
  item: { nama: string; satuan_jual: string };
  unit: { nama_gudang: string } | null;
  location: { nama_lokasi: string } | null;
  stock_transaction: { created_at: string }[];
};

type SearchParams = { q?: string; status?: string; unit?: string; page?: string };

const numberFormat = new Intl.NumberFormat("id-ID");

function pageHref(params: SearchParams, page: number) {
  const next = new URLSearchParams(
    Object.entries(params).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
  next.set("page", String(page));
  return `/stok?${next.toString()}`;
}

// Every inventory row with its current stock: search, status/inventory
// filters and paging, all in the URL.
export default async function StockPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 100);
  const status = params.status === "habis" || params.status === "tersedia" ? params.status : null;
  const unit = /^\d+$/.test(params.unit ?? "") ? params.unit! : null;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const { supabase, profile } = await getSession();
  // Staff only ever get their own unit's rows back (RLS); say so in the copy.
  const staffUnit = profile?.role === "staff" ? (profile.unit?.nama_gudang ?? "inventori Anda") : null;

  let inventoryQuery = supabase
    .from("inventory")
    .select(
      "id_inventory, qr_token, current_qty, item:id_barang!inner(nama, satuan_jual), unit:id_gudang(nama_gudang), location:id_lokasi(nama_lokasi), stock_transaction(created_at)",
      { count: "exact" },
    );
  // Escape LIKE wildcards so a typed % or _ matches literally.
  if (q) inventoryQuery = inventoryQuery.ilike("item.nama", `%${q.replace(/[\\%_]/g, "\\$&")}%`);
  if (status === "habis") inventoryQuery = inventoryQuery.lte("current_qty", 0);
  if (status === "tersedia") inventoryQuery = inventoryQuery.gt("current_qty", 0);
  if (unit) inventoryQuery = inventoryQuery.eq("id_gudang", unit);

  const [inventoryRes, unitsRes] = await Promise.all([
    inventoryQuery
      .order("id_inventory")
      .order("created_at", { referencedTable: "stock_transaction", ascending: false })
      .limit(1, { referencedTable: "stock_transaction" })
      .range(from, from + PAGE_SIZE - 1),
    supabase.from("unit").select("id_gudang, nama_gudang").order("nama_gudang"),
  ]);

  // Page past the end (stale link, or filters shrank the result set) — PostgREST
  // rejects the range, so go back to the first page instead of showing an error.
  if (inventoryRes.error?.code === "PGRST103") redirect(pageHref(params, 1));

  const rows = (inventoryRes.data ?? []) as unknown as InventoryRow[];
  const total = inventoryRes.count ?? 0;
  const units = unitsRes.data ?? [];
  const error = inventoryRes.error ?? unitsRes.error;

  return (
    <DesktopOnly>
      <PageHeader
        title="Data Stok"
        description={staffUnit ? `Stok terkini di ${staffUnit}.` : "Stok terkini di semua inventori."}
      />

      <section className={cardClass}>
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <h2 className="text-lg font-semibold tracking-tight">Daftar Stok</h2>
          <InventoryFilters units={units} />
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
          pageSize={PAGE_SIZE}
          total={total}
          noun="item"
          href={(p) => pageHref(params, p)}
        />
      </section>
    </DesktopOnly>
  );
}
