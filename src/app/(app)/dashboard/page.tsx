import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, startOfTodayInAppZone, todayInAppZone } from "@/lib/dates";
import { InventoryFilters } from "@/components/dashboard/InventoryFilters";
import {
  ArrowLeftRightIcon,
  ArrowRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardCheckIcon,
  PackageIcon,
  PackageXIcon,
} from "@/components/icons";
import { Alert, PageHeader, StockStatus, cardClass, secondaryButtonClass } from "@/components/ui";

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

function StatCard({
  icon,
  tone,
  title,
  description,
  value,
}: {
  icon: ReactNode;
  tone: string;
  title: string;
  description: string;
  value: number | null;
}) {
  return (
    <div className={`${cardClass} p-4 sm:p-5`}>
      <div className="flex items-center gap-2.5 sm:gap-3">
        <span className={`grid size-9 shrink-0 place-items-center rounded-xl sm:size-10 ${tone}`}>{icon}</span>
        <p className="text-sm font-semibold leading-tight sm:text-base">{title}</p>
      </div>
      <p className="mt-4 hidden text-sm text-muted sm:block">{description}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums sm:mt-1 sm:text-3xl">
        {value === null ? "—" : numberFormat.format(value)}
      </p>
    </div>
  );
}

function pageHref(params: SearchParams, page: number) {
  const next = new URLSearchParams(
    Object.entries(params).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
  next.set("page", String(page));
  return `/dashboard?${next.toString()}`;
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 100);
  const status = params.status === "habis" || params.status === "tersedia" ? params.status : null;
  const unit = /^\d+$/.test(params.unit ?? "") ? params.unit! : null;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();

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

  const [inventoryRes, unitsRes, totalRes, outRes, txRes, varianceRes] = await Promise.all([
    inventoryQuery
      .order("id_inventory")
      .order("created_at", { referencedTable: "stock_transaction", ascending: false })
      .limit(1, { referencedTable: "stock_transaction" })
      .range(from, from + PAGE_SIZE - 1),
    supabase.from("unit").select("id_gudang, nama_gudang").order("nama_gudang"),
    supabase.from("inventory").select("id_inventory", { count: "exact", head: true }),
    supabase.from("inventory").select("id_inventory", { count: "exact", head: true }).lte("current_qty", 0),
    supabase
      .from("stock_transaction")
      .select("id_transaction", { count: "exact", head: true })
      .gte("created_at", startOfTodayInAppZone()),
    supabase
      .from("opname_count")
      .select("id_opname_count, opname_session!inner(opname_date)", { count: "exact", head: true })
      .eq("opname_session.opname_date", todayInAppZone())
      .neq("selisih", 0),
  ]);

  // Page past the end (stale link, or filters shrank the result set) — PostgREST
  // rejects the range, so go back to the first page instead of showing an error.
  if (inventoryRes.error?.code === "PGRST103") redirect(pageHref(params, 1));

  const rows = (inventoryRes.data ?? []) as unknown as InventoryRow[];
  const total = inventoryRes.count ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const units = unitsRes.data ?? [];
  const error = inventoryRes.error ?? unitsRes.error;

  return (
    <>
      <PageHeader title="Dashboard" description="Ringkasan stok di semua unit." />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          icon={<PackageIcon className="size-5" />}
          tone="bg-primary/12 text-primary"
          title="Total Item"
          description="Item yang tercatat di semua unit"
          value={totalRes.count}
        />
        <StatCard
          icon={<PackageXIcon className="size-5" />}
          tone="bg-rose-500/12 text-rose-600 dark:text-rose-400"
          title="Stok Habis"
          description="Item dengan stok 0 atau kurang"
          value={outRes.count}
        />
        <StatCard
          icon={<ArrowLeftRightIcon className="size-5" />}
          tone="bg-sky-500/12 text-sky-600 dark:text-sky-400"
          title="Transaksi Hari Ini"
          description="Barang masuk dan keluar hari ini"
          value={txRes.count}
        />
        <StatCard
          icon={<ClipboardCheckIcon className="size-5" />}
          tone="bg-amber-500/15 text-amber-600 dark:text-amber-400"
          title="Selisih Opname"
          description="Item dengan selisih di opname hari ini"
          value={varianceRes.count}
        />
      </div>

      <section className={`${cardClass} mt-6`}>
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

        {total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3.5 text-sm">
            <p className="text-muted">
              Menampilkan {numberFormat.format(from + 1)}–{numberFormat.format(Math.min(from + PAGE_SIZE, total))} dari{" "}
              {numberFormat.format(total)} item
            </p>
            <div className="flex items-center gap-2">
              <Link
                href={pageHref(params, page - 1)}
                aria-disabled={page <= 1}
                tabIndex={page <= 1 ? -1 : undefined}
                aria-label="Halaman sebelumnya"
                className={`${secondaryButtonClass} h-9 px-2.5`}
              >
                <ChevronLeftIcon className="size-4" />
              </Link>
              <span className="tabular-nums text-muted">
                {page} / {lastPage}
              </span>
              <Link
                href={pageHref(params, page + 1)}
                aria-disabled={page >= lastPage}
                tabIndex={page >= lastPage ? -1 : undefined}
                aria-label="Halaman berikutnya"
                className={`${secondaryButtonClass} h-9 px-2.5`}
              >
                <ChevronRightIcon className="size-4" />
              </Link>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
