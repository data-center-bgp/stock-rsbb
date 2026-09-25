import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/PrintButton";
import { QrLabelGrid, type QrLabel } from "@/components/QrLabelGrid";
import { ArrowRightIcon, ChevronLeftIcon, QrCodeIcon } from "@/components/icons";
import { Alert, PageHeader, cardClass } from "@/components/ui";

type UnitRow = { id_gudang: number; nama_gudang: string; inventory: { count: number }[] };

type InventoryRow = {
  id_inventory: number;
  qr_token: string;
  item: { nama: string; satuan_jual: string } | null;
  location: { nama_lokasi: string } | null;
};

const numberFormat = new Intl.NumberFormat("id-ID");

export default async function LabelsPage({ searchParams }: { searchParams: Promise<{ unit?: string }> }) {
  const { unit } = await searchParams;
  const supabase = await createClient();

  if (!unit || !/^\d+$/.test(unit)) {
    const { data, error } = await supabase
      .from("unit")
      .select("id_gudang, nama_gudang, inventory(count)")
      .order("nama_gudang");
    const units = (data ?? []) as unknown as UnitRow[];

    return (
      <>
        <PageHeader title="Label QR" description="Pilih unit untuk mencetak label QR item-itemnya." />

        {error && <Alert tone="danger">Gagal memuat unit: {error.message}</Alert>}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {units.map((u) => (
            <Link
              key={u.id_gudang}
              href={`/dashboard/labels?unit=${u.id_gudang}`}
              className={`${cardClass} group flex items-center gap-4 p-5 transition-colors hover:border-primary/40`}
            >
              <span className="grid size-11 place-items-center rounded-xl bg-primary/12 text-primary">
                <QrCodeIcon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{u.nama_gudang}</span>
                <span className="text-sm text-muted">{numberFormat.format(u.inventory[0]?.count ?? 0)} item</span>
              </span>
              <ArrowRightIcon className="size-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </Link>
          ))}
        </div>

        {!units.length && !error && (
          <p className={`${cardClass} p-10 text-center text-sm text-muted`}>Belum ada unit — impor data terlebih dahulu.</p>
        )}
      </>
    );
  }

  const [{ data, error }, { data: unitRow }] = await Promise.all([
    supabase
      .from("inventory")
      .select("id_inventory, qr_token, item:id_barang(nama, satuan_jual), location:id_lokasi(nama_lokasi)")
      .eq("id_gudang", unit)
      .order("id_inventory"),
    supabase.from("unit").select("nama_gudang").eq("id_gudang", unit).maybeSingle(),
  ]);

  const inventory = (data ?? []) as unknown as InventoryRow[];
  const labels: QrLabel[] = inventory.map((row) => ({
    id: row.id_inventory,
    token: row.qr_token,
    nama: row.item?.nama ?? "",
    lokasi: row.location?.nama_lokasi ?? "",
    satuan: row.item?.satuan_jual ?? "",
  }));

  return (
    <>
      <div className="print:hidden">
        <Link href="/dashboard/labels" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
          <ChevronLeftIcon className="size-4" /> Semua unit
        </Link>
        <PageHeader
          title={unitRow?.nama_gudang ?? "Label QR"}
          description={`${numberFormat.format(labels.length)} label QR — satu per item di lokasinya.`}
          actions={labels.length > 0 ? <PrintButton /> : undefined}
        />
      </div>

      {error && <Alert tone="danger">Gagal memuat item: {error.message}</Alert>}

      {labels.length > 0 ? (
        <QrLabelGrid labels={labels} />
      ) : (
        !error && <p className={`${cardClass} p-10 text-center text-sm text-muted`}>Unit ini belum punya item.</p>
      )}
    </>
  );
}
