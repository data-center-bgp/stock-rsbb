import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, isUnitStaff } from "@/lib/session";
import { scanHref } from "@/lib/input-mode";
import { OpnameItemSearch } from "@/components/opname/OpnameItemSearch";
import { ChevronLeftIcon, ScanLineIcon } from "@/components/icons";
import { Alert, PageHeader, cardClass, primaryButtonClass } from "@/components/ui";

export const metadata: Metadata = { title: "Pemakaian — Stock RSBB" };

// Where a hospital unit's Pemakaian starts: scan an item's label, or find it by
// name. Only unit staff record usage; the pharmacy side uses Mutasi.
export default async function PemakaianPage() {
  const { profile } = await getSession();
  if (!isUnitStaff(profile)) redirect("/input");
  const gudang = profile?.id_gudang;

  return (
    <div className="mx-auto w-full max-w-lg">
      <Link href="/input" className="-mt-2 mb-3 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-foreground">
        <ChevronLeftIcon className="size-4" /> Input Data
      </Link>
      <PageHeader
        title="Pemakaian"
        description={`Catat barang yang dipakai di ${profile?.unit?.nama_gudang ?? "unit"}.`}
      />

      {!gudang ? (
        <Alert tone="warning">Akun Anda belum terhubung ke inventori. Hubungi admin.</Alert>
      ) : (
        <div className="flex flex-col gap-4">
          <Link href={scanHref("pemakaian")} className={`${primaryButtonClass} w-full`}>
            <ScanLineIcon className="size-4" /> Scan label QR
          </Link>

          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-border" /> atau cari item <span className="h-px flex-1 bg-border" />
          </div>

          <section className={`${cardClass} p-4`}>
            <OpnameItemSearch key={gudang} gudang={gudang} kind="unit" mode="pemakaian" />
          </section>
        </div>
      )}
    </div>
  );
}
