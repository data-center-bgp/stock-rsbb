import Link from "next/link";
import type { ReactNode } from "react";
import { getSession } from "@/lib/session";
import { todayInAppZone } from "@/lib/dates";
import { DesktopOnly } from "@/components/shell/DesktopOnly";
import {
  ArrowLeftRightIcon,
  ArrowRightIcon,
  ClipboardCheckIcon,
  PackageIcon,
  PackageXIcon,
} from "@/components/icons";
import { PageHeader, cardClass } from "@/components/ui";

const numberFormat = new Intl.NumberFormat("id-ID");

// Each card opens the full list behind its number (Data Stok or Riwayat).
function StatCard({
  href,
  icon,
  tone,
  title,
  description,
  value,
}: {
  href: string;
  icon: ReactNode;
  tone: string;
  title: string;
  description: string;
  value: number | null;
}) {
  return (
    <Link href={href} className={`${cardClass} group p-4 transition-colors hover:border-primary/40 sm:p-5`}>
      <div className="flex items-center gap-2.5 sm:gap-3">
        <span className={`grid size-9 shrink-0 place-items-center rounded-xl sm:size-10 ${tone}`}>{icon}</span>
        <p className="flex-1 text-sm font-semibold leading-tight sm:text-base">{title}</p>
        <ArrowRightIcon className="size-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>
      <p className="mt-4 hidden text-sm text-muted sm:block">{description}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums sm:mt-1 sm:text-3xl">
        {value === null ? "—" : numberFormat.format(value)}
      </p>
    </Link>
  );
}

export default async function DashboardPage() {
  const { supabase, profile } = await getSession();
  // Staff only ever get their own unit's rows back (RLS); say so in the copy.
  const staffUnit = profile?.role === "staff" ? (profile.unit?.nama_gudang ?? "inventori Anda") : null;
  const today = todayInAppZone();

  const [totalRes, outRes, txRes, varianceRes] = await Promise.all([
    supabase.from("inventory").select("id_inventory", { count: "exact", head: true }),
    supabase.from("inventory").select("id_inventory", { count: "exact", head: true }).lte("current_qty", 0),
    supabase
      .from("stock_transaction")
      .select("id_transaction", { count: "exact", head: true })
      .eq("transaction_date", today),
    supabase
      .from("opname_count")
      .select("id_opname_count, opname_session!inner(opname_date)", { count: "exact", head: true })
      .eq("opname_session.opname_date", today)
      .neq("selisih", 0),
  ]);

  return (
    <DesktopOnly>
      <PageHeader
        title="Dashboard"
        description={staffUnit ? `Ringkasan stok ${staffUnit}.` : "Ringkasan stok di semua inventori."}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          href="/stok"
          icon={<PackageIcon className="size-5" />}
          tone="bg-primary/12 text-primary"
          title="Total Item"
          description={staffUnit ? `Item yang tercatat di ${staffUnit}` : "Item yang tercatat di semua inventori"}
          value={totalRes.count}
        />
        <StatCard
          href="/stok?status=habis"
          icon={<PackageXIcon className="size-5" />}
          tone="bg-rose-500/12 text-rose-600 dark:text-rose-400"
          title="Stok Habis"
          description="Item dengan stok 0 atau kurang"
          value={outRes.count}
        />
        <StatCard
          href={`/riwayat?tab=mutasi&from=${today}&to=${today}`}
          icon={<ArrowLeftRightIcon className="size-5" />}
          tone="bg-sky-500/12 text-sky-600 dark:text-sky-400"
          title="Mutasi Hari Ini"
          description="Barang masuk dan keluar dengan tanggal hari ini"
          value={txRes.count}
        />
        <StatCard
          href={`/riwayat?tab=opname&selisih=ada&from=${today}&to=${today}`}
          icon={<ClipboardCheckIcon className="size-5" />}
          tone="bg-amber-500/15 text-amber-600 dark:text-amber-400"
          title="Selisih Opname"
          description="Item dengan selisih di opname hari ini"
          value={varianceRes.count}
        />
      </div>
    </DesktopOnly>
  );
}
