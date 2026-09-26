import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import {
  HISTORY_PAGE_SIZE,
  loadHistory,
  parseHistoryFilters,
  type HistorySearchParams,
  type HistoryTab,
  type OpnameEntry,
} from "@/lib/history";
import { HistoryFilters } from "@/components/history/HistoryFilters";
import { EntryList, EntryTable, OpnameTable } from "@/components/history/HistoryEntries";
import { PendingMutasi } from "@/components/history/PendingMutasi";
import { Pagination } from "@/components/Pagination";
import { ArrowLeftRightIcon, ChevronLeftIcon, ClipboardCheckIcon, HistoryIcon, MapPinIcon } from "@/components/icons";
import { Alert, PageHeader, cardClass } from "@/components/ui";

export const metadata: Metadata = { title: "Riwayat — Stock RSBB" };

function historyHref(params: HistorySearchParams, changes: HistorySearchParams) {
  const next = new URLSearchParams(
    Object.entries({ ...params, ...changes }).filter((e): e is [string, string] => typeof e[1] === "string" && e[1] !== ""),
  );
  const qs = next.toString();
  return qs ? `/riwayat?${qs}` : "/riwayat";
}

const TABS: { tab: HistoryTab; label: string; icon: typeof ArrowLeftRightIcon }[] = [
  { tab: "semua", label: "Semua", icon: HistoryIcon },
  { tab: "mutasi", label: "Mutasi", icon: ArrowLeftRightIcon },
  { tab: "opname", label: "Stock Opname", icon: ClipboardCheckIcon },
];

const NOUNS: Record<HistoryTab, string> = { semua: "catatan", mutasi: "mutasi", opname: "hitungan" };

type InventoryHeader = {
  qr_token: string;
  current_qty: number;
  item: { nama: string; satuan_jual: string };
  unit: { nama_gudang: string } | null;
  location: { nama_lokasi: string } | null;
};

const numberFormat = new Intl.NumberFormat("id-ID");

// One page for both layouts: phones get a brief list with expandable rows
// (reached from /input), desktop gets full tables (from the sidebar). With
// ?inv=, it's one item's history: Mutasi and Stock Opname in one timeline.
export default async function HistoryPage({ searchParams }: { searchParams: Promise<HistorySearchParams> }) {
  const params = await searchParams;
  const filters = parseHistoryFilters(params);
  const { supabase, user, profile } = await getSession();
  // The layout redirects too, but pages render alongside it, not after it.
  if (!user) redirect("/login");
  const canRecord = profile?.role === "master" || profile?.role === "staff";
  const staffUnit = profile?.role === "staff" ? (profile.unit?.nama_gudang ?? "inventori Anda") : null;

  const [result, unitsRes, invRes] = await Promise.all([
    loadHistory(supabase, filters, user.id),
    supabase.from("unit").select("id_gudang, nama_gudang").order("nama_gudang"),
    filters.inv
      ? supabase
          .from("inventory")
          .select(
            "qr_token, current_qty, item:id_barang(nama, satuan_jual), unit:id_gudang(nama_gudang), location:id_lokasi(nama_lokasi)",
          )
          .eq("id_inventory", filters.inv)
          .maybeSingle()
      : Promise.resolve(null),
  ]);

  // Page past the end (stale link, or filters shrank the results).
  if (result.error?.code === "PGRST103") redirect(historyHref(params, { page: "" }));

  const item = (invRes?.data ?? null) as InventoryHeader | null;
  const showItem = !filters.inv;
  const filtered = Boolean(
    filters.q || filters.unit || filters.jenis || filters.selisih || filters.from || filters.to || filters.mine,
  );
  const noun = NOUNS[filters.tab];

  return (
    <div className="mx-auto w-full max-w-lg lg:max-w-none">
      <Link
        href={item ? `/i/${item.qr_token}` : "/input"}
        className="-mt-2 mb-3 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-foreground lg:hidden"
      >
        <ChevronLeftIcon className="size-4" /> {item ? "Kembali ke item" : "Input Data"}
      </Link>

      {filters.inv ? (
        <PageHeader
          title="Riwayat Item"
          description={
            item ? (
              <>
                <span className="font-medium text-foreground">{item.item.nama}</span>
                <span className="mt-1 flex flex-wrap items-center gap-x-1.5">
                  <MapPinIcon className="size-3.5 shrink-0" />
                  {item.location?.nama_lokasi} · {item.unit?.nama_gudang} · Stok sistem{" "}
                  {numberFormat.format(item.current_qty)} {item.item.satuan_jual}
                </span>
                <Link href="/riwayat" className="mt-1 inline-block font-medium text-primary hover:underline">
                  Lihat riwayat semua item
                </Link>
              </>
            ) : (
              "Item tidak ditemukan."
            )
          }
        />
      ) : (
        <PageHeader
          title="Riwayat"
          description={
            staffUnit
              ? `Semua mutasi dan stock opname yang tercatat di ${staffUnit}.`
              : "Semua mutasi dan stock opname yang tercatat, terbaru di atas."
          }
        />
      )}

      <section className={cardClass}>
        <div className="flex flex-col gap-4 p-4 lg:p-5">
          <nav className="grid grid-cols-3 gap-1 self-stretch rounded-xl bg-surface-muted p-1 lg:self-start" aria-label="Jenis riwayat">
            {TABS.map(({ tab, label, icon: Icon }) => {
              const active = filters.tab === tab;
              return (
                <Link
                  key={tab}
                  href={historyHref(params, { tab: tab === "semua" ? "" : tab, page: "", jenis: "", selisih: "" })}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors lg:px-4 ${
                    active ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="hidden size-4 sm:block" />
                  {label}
                </Link>
              );
            })}
          </nav>
          <HistoryFilters tab={filters.tab} units={unitsRes.data ?? []} canRecord={canRecord} />
        </div>

        {result.error && (
          <div className="px-4 pb-4 lg:px-5">
            <Alert tone="danger">Gagal memuat riwayat: {result.error.message}</Alert>
          </div>
        )}

        {filters.tab !== "opname" && <PendingMutasi inventoryId={filters.inv ? Number(filters.inv) : null} />}

        <div className="border-t border-border lg:hidden">
          <EntryList entries={result.entries} recorders={result.recorders} showItem={showItem} />
        </div>
        <div className="hidden lg:block">
          {filters.tab === "opname" ? (
            <OpnameTable
              entries={result.entries.filter((e): e is OpnameEntry => e.kind === "opname")}
              recorders={result.recorders}
              showItem={showItem}
            />
          ) : (
            <EntryTable entries={result.entries} recorders={result.recorders} showItem={showItem} tab={filters.tab} />
          )}
        </div>

        {!result.entries.length && !result.error && (
          <p className="px-5 py-12 text-center text-sm text-muted">
            {filtered ? "Tidak ada riwayat yang cocok dengan filter." : `Belum ada ${noun} yang tercatat.`}
          </p>
        )}

        <Pagination
          page={filters.page}
          pageSize={HISTORY_PAGE_SIZE}
          total={result.total}
          noun={noun}
          href={(p) => historyHref(params, { page: p > 1 ? String(p) : "" })}
        />
      </section>
    </div>
  );
}
