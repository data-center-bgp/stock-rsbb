import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";
import { PrintButton } from "@/components/PrintButton";
import { QrLabelGrid, type QrLabel } from "@/components/QrLabelGrid";

type UnitRow = { id_gudang: number; nama_gudang: string };

type InventoryRow = {
  id_inventory: number;
  qr_token: string;
  item: { nama: string; satuan_jual: string } | null;
  location: { nama_lokasi: string } | null;
};

export default async function LabelsPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string }>;
}) {
  const { unit } = await searchParams;
  const supabase = await createClient();

  if (!unit) {
    const { data, error } = await supabase.from("unit").select("id_gudang, nama_gudang").order("nama_gudang");
    const units = data as UnitRow[] | null;

    return (
      <div className="flex-1 flex flex-col">
        <AppNav />
        <div className="p-6">
          <h1 className="text-xl font-semibold mb-1">Label QR</h1>
          <p className="text-sm text-zinc-600 mb-4">Pilih unit untuk mencetak label QR item-itemnya.</p>

          {error && <p className="text-sm text-red-600">{error.message}</p>}

          <ul className="flex flex-col gap-1">
            {units?.map((u) => (
              <li key={u.id_gudang}>
                <Link href={`/dashboard/labels?unit=${u.id_gudang}`} className="text-sm underline">
                  {u.nama_gudang}
                </Link>
              </li>
            ))}
          </ul>

          {!units?.length && !error && (
            <p className="text-sm text-zinc-500">Belum ada unit — impor data terlebih dahulu.</p>
          )}
        </div>
      </div>
    );
  }

  const { data, error } = await supabase
    .from("inventory")
    .select("id_inventory, qr_token, item:id_barang(nama, satuan_jual), location:id_lokasi(nama_lokasi)")
    .eq("id_gudang", unit)
    .order("id_inventory");

  const inventory = data as unknown as InventoryRow[] | null;
  const labels: QrLabel[] = (inventory ?? []).map((row) => ({
    id: row.id_inventory,
    token: row.qr_token,
    nama: row.item?.nama ?? "",
    lokasi: row.location?.nama_lokasi ?? "",
    satuan: row.item?.satuan_jual ?? "",
  }));

  return (
    <div className="flex-1 flex flex-col">
      <div className="print:hidden">
        <AppNav />
      </div>

      <div className="p-6">
        <div className="flex items-center justify-between mb-4 print:hidden">
          <div>
            <h1 className="text-xl font-semibold mb-1">Label QR</h1>
            <Link href="/dashboard/labels" className="text-sm underline text-zinc-600">
              Pilih unit lain
            </Link>
          </div>
          <PrintButton />
        </div>

        {error && <p className="text-sm text-red-600">{error.message}</p>}

        <QrLabelGrid labels={labels} />

        {!labels.length && !error && (
          <p className="text-sm text-zinc-500">Unit ini belum punya item.</p>
        )}
      </div>
    </div>
  );
}
