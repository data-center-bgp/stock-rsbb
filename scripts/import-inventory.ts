// Imports one unit's template (e.g. template-stock-opname-352.xlsx) into
// the stock_rsbb schema, from two sheets with the same 14 columns:
//   - "daftar referensi inventories" (the fuller catalog) -> Producer/Item
//     only, no Inventory row for an item that isn't also in the sheet below.
//   - "daftar inventories" (the unit's actual stocked items) -> Producer/
//     Item (redundant with the above, harmless) plus Unit/Location/
//     Inventory.
//
// Usage:
//   npm run import:inventory -- "D:\path\to\template-stock-opname-XXX.xlsx"
//
// Safe to re-run: producer/item/unit/location are upserted (refreshed) by
// their source ID from the spreadsheet; inventory rows are inserted once
// and then left alone on re-run (id_inventory_source), so a repeat import
// never clobbers live quantity/current_qty after the app has started
// recording transactions against them.
//
// Requires SUPABASE_SERVICE_ROLE_KEY (bypasses RLS — this is an admin
// tool, not something the app itself uses) alongside the usual
// NEXT_PUBLIC_SUPABASE_URL in .env.local.

import { createClient } from "@supabase/supabase-js";
import { readSourceRows, INVENTORY_SHEET, REFERENCE_SHEET, type SourceRow } from "./lib/read-source-rows";

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: npm run import:inventory -- "path/to/template.xlsx"');
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (.env.local).");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, { db: { schema: "stock_rsbb" } });

  console.log(`Reading ${filePath} ...`);
  const catalogRows = await readSourceRows(filePath, REFERENCE_SHEET);
  const stockedRows = await readSourceRows(filePath, INVENTORY_SHEET);
  console.log(`Found ${catalogRows.length} rows in "${REFERENCE_SHEET}", ${stockedRows.length} in "${INVENTORY_SHEET}".`);

  // --- producer (from the fuller catalog, so items not currently stocked still get a producer) ---
  const producerBySource = new Map(catalogRows.map((r) => [r.idProdusen, { id_produsen_source: r.idProdusen, nama: r.produsen }]));
  const { data: producerRes, error: producerErr } = await supabase
    .from("producer")
    .upsert(Array.from(producerBySource.values()), { onConflict: "id_produsen_source" })
    .select("id_produsen, id_produsen_source");
  if (producerErr) throw producerErr;
  const producerIdBySource = new Map(producerRes!.map((p) => [p.id_produsen_source as number, p.id_produsen as number]));
  console.log(`Producers: ${producerIdBySource.size}`);

  // --- item (from the fuller catalog — this is what "referensi" is for: items this unit could stock later) ---
  const itemBySource = new Map(
    catalogRows.map((r) => [
      r.idBarang,
      {
        id_barang_source: r.idBarang,
        nama: r.nama,
        satuan_jual: r.satuanJual,
        id_produsen: producerIdBySource.get(r.idProdusen),
      },
    ]),
  );
  const { data: itemRes, error: itemErr } = await supabase
    .from("item")
    .upsert(Array.from(itemBySource.values()), { onConflict: "id_barang_source" })
    .select("id_barang, id_barang_source");
  if (itemErr) throw itemErr;
  const itemIdBySource = new Map(itemRes!.map((i) => [i.id_barang_source as number, i.id_barang as number]));
  console.log(`Items: ${itemIdBySource.size} (from the catalog; only ${stockedRows.length} of these get an Inventory row below)`);

  // --- unit (from the unit's actual stocked rows) ---
  const unitBySource = new Map(stockedRows.map((r: SourceRow) => [r.idGudang, { id_gudang_source: r.idGudang, nama_gudang: r.gudang }]));
  const { data: unitRes, error: unitErr } = await supabase
    .from("unit")
    .upsert(Array.from(unitBySource.values()), { onConflict: "id_gudang_source" })
    .select("id_gudang, id_gudang_source");
  if (unitErr) throw unitErr;
  const unitIdBySource = new Map(unitRes!.map((u) => [u.id_gudang_source as number, u.id_gudang as number]));
  console.log(`Units: ${unitIdBySource.size}`);

  // --- location (unique per unit, not globally) ---
  const locationByKey = new Map(
    stockedRows.map((r) => [
      `${r.idGudang}:${r.idLokasi}`,
      {
        id_gudang: unitIdBySource.get(r.idGudang),
        id_lokasi_source: r.idLokasi,
        nama_lokasi: r.lokasi,
      },
    ]),
  );
  const { data: locationRes, error: locationErr } = await supabase
    .from("location")
    .upsert(Array.from(locationByKey.values()), { onConflict: "id_gudang,id_lokasi_source" })
    .select("id_lokasi, id_gudang, id_lokasi_source");
  if (locationErr) throw locationErr;
  const locationIdByKey = new Map(
    locationRes!.map((l) => [`${l.id_gudang}:${l.id_lokasi_source}`, l.id_lokasi as number]),
  );
  console.log(`Locations: ${locationIdByKey.size}`);

  // --- inventory (insert-once: ignoreDuplicates so re-running never touches live stock) ---
  const inventoryRows = stockedRows.map((r) => {
    const id_gudang = unitIdBySource.get(r.idGudang)!;
    return {
      id_inventory_source: r.idInventory,
      id_barang: itemIdBySource.get(r.idBarang),
      id_gudang,
      id_lokasi: locationIdByKey.get(`${id_gudang}:${r.idLokasi}`),
      harga_pokok_jual: r.hargaPokokJual,
      harga_pokok: r.hargaPokok,
      quantity_awal: r.quantityAwal,
    };
  });
  const { data: inventoryRes, error: inventoryErr } = await supabase
    .from("inventory")
    .upsert(inventoryRows, { onConflict: "id_inventory_source", ignoreDuplicates: true })
    .select("id_inventory");
  if (inventoryErr) throw inventoryErr;
  console.log(`Inventory rows inserted this run: ${inventoryRes!.length} (existing rows were left untouched).`);

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
