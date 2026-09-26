import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { scanHref } from "@/lib/input-mode";
import { GudangPicker } from "@/components/opname/GudangPicker";
import { OpnameItemSearch } from "@/components/opname/OpnameItemSearch";
import { ChevronLeftIcon, ScanLineIcon } from "@/components/icons";
import { Alert, PageHeader, cardClass, primaryButtonClass } from "@/components/ui";
import type { Unit } from "@/lib/types";

export const metadata: Metadata = { title: "Stock Opname — Stock RSBB" };

// Where a Stock Opname starts: scan an item's label, or find it by name.
// Staff count in their own inventory; masters pick one.
export default async function OpnamePage({ searchParams }: { searchParams: Promise<{ gudang?: string }> }) {
  const { gudang: gudangParam } = await searchParams;
  const { supabase, profile } = await getSession();
  if (profile?.role !== "master" && profile?.role !== "staff") redirect("/input");

  let gudangs: Unit[] = [];
  let current: Unit | null = null;
  if (profile.role === "staff") {
    current = profile.unit && profile.id_gudang ? { id_gudang: profile.id_gudang, ...profile.unit } : null;
  } else {
    const { data } = await supabase.from("unit").select("id_gudang, nama_gudang, kind").order("nama_gudang");
    // Pharmacy inventories first, then the hospital units.
    gudangs = ((data ?? []) as Unit[]).sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "farmasi" ? -1 : 1));
    current = gudangs.find((g) => String(g.id_gudang) === gudangParam) ?? gudangs[0] ?? null;
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      <Link href="/input" className="-mt-2 mb-3 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-foreground">
        <ChevronLeftIcon className="size-4" /> Input Data
      </Link>
      <PageHeader
        title="Stock Opname"
        description={current ? `Hitung stok fisik di ${current.nama_gudang}.` : "Hitung stok fisik."}
      />

      {!current ? (
        <Alert tone="warning">Akun Anda belum terhubung ke inventori. Hubungi admin.</Alert>
      ) : (
        <div className="flex flex-col gap-4">
          {profile.role === "master" && <GudangPicker gudangs={gudangs} value={current.id_gudang} />}

          <Link href={scanHref("opname")} className={`${primaryButtonClass} w-full`}>
            <ScanLineIcon className="size-4" /> Scan label QR
          </Link>

          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-border" /> atau cari item <span className="h-px flex-1 bg-border" />
          </div>

          <section className={`${cardClass} p-4`}>
            <OpnameItemSearch key={current.id_gudang} gudang={current.id_gudang} kind={current.kind} />
          </section>
        </div>
      )}
    </div>
  );
}
