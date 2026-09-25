import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";

type StockRow = {
  id_inventory: number;
  current_qty: number;
  item: { nama: string; satuan_jual: string } | null;
  unit: { nama_gudang: string } | null;
  location: { nama_lokasi: string } | null;
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("inventory")
    .select(
      "id_inventory, current_qty, item:id_barang(nama, satuan_jual), unit:id_gudang(nama_gudang), location:id_lokasi(nama_lokasi)",
    )
    .order("id_inventory")
    .limit(50);

  const inventory = data as unknown as StockRow[] | null;

  return (
    <div className="flex-1 flex flex-col">
      <AppNav />
      <div className="p-6">
        <h1 className="text-xl font-semibold mb-1">Stok Saat Ini</h1>
        <p className="text-sm text-zinc-600 mb-4">
          Monitoring lintas unit — untuk input cepat, gunakan aplikasi mobile via scan QR.
        </p>

        {error && <p className="text-sm text-red-600">{error.message}</p>}

        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b border-black/10">
              <th className="py-2 pr-4">Item</th>
              <th className="py-2 pr-4">Unit</th>
              <th className="py-2 pr-4">Lokasi</th>
              <th className="py-2 pr-4">Quantity</th>
            </tr>
          </thead>
          <tbody>
            {inventory?.map((row) => (
              <tr key={row.id_inventory} className="border-b border-black/5">
                <td className="py-2 pr-4">
                  {row.item?.nama} ({row.item?.satuan_jual})
                </td>
                <td className="py-2 pr-4">{row.unit?.nama_gudang}</td>
                <td className="py-2 pr-4">{row.location?.nama_lokasi}</td>
                <td className="py-2 pr-4">{row.current_qty}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {!inventory?.length && !error && (
          <p className="text-sm text-zinc-500 mt-4">
            Belum ada data — jalankan migrasi Supabase dan impor data awal terlebih dahulu.
          </p>
        )}
      </div>
    </div>
  );
}
