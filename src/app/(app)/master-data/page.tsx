import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { DesktopOnly } from "@/components/shell/DesktopOnly";
import { LookupManager, type LookupEntry } from "@/components/master-data/LookupManager";
import { Alert, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Data Master — Stock RSBB" };

export default async function MasterDataPage() {
  const { supabase, profile } = await getSession();
  // Masters only; RLS also only lets a master write these tables.
  if (profile?.role !== "master") notFound();

  const [distributors, units] = await Promise.all([
    supabase.from("distributor").select("id_distributor, nama, is_active").order("nama"),
    supabase.from("hospital_unit").select("id_hospital_unit, nama, is_active").order("nama"),
  ]);

  const distributorEntries: LookupEntry[] = (distributors.data ?? []).map((d) => ({
    id: d.id_distributor,
    nama: d.nama,
    is_active: d.is_active,
  }));
  const unitEntries: LookupEntry[] = (units.data ?? []).map((u) => ({
    id: u.id_hospital_unit,
    nama: u.nama,
    is_active: u.is_active,
  }));
  const error = distributors.error ?? units.error;

  return (
    <DesktopOnly>
      <PageHeader
        title="Data Master"
        description="Daftar distributor dan unit yang dipakai saat mencatat mutasi farmasi."
      />

      {error && (
        <div className="mb-4">
          <Alert tone="danger">Gagal memuat data: {error.message}</Alert>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <LookupManager
          table="distributor"
          idColumn="id_distributor"
          title="Distributor"
          noun="distributor"
          entries={distributorEntries}
        />
        <LookupManager
          table="hospital_unit"
          idColumn="id_hospital_unit"
          title="Unit"
          noun="unit"
          entries={unitEntries}
        />
      </div>
    </DesktopOnly>
  );
}
