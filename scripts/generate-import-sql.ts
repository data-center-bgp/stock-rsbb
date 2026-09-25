// Generates a plain .sql file from a unit's template, for pasting into the
// Supabase SQL Editor. Does the exact same upserts as import-inventory.ts
// (see that file's header for the referensi-vs-inventories split), but runs
// directly against Postgres instead of through the Supabase REST API —
// useful when PostgREST hasn't picked up a schema/config change yet (the
// SQL Editor talks straight to Postgres).
//
// Usage:
//   npm run generate-import-sql -- "D:\path\to\template-stock-opname-XXX.xlsx" out.sql
//
// No Supabase credentials needed — this only reads the spreadsheet and
// writes a .sql file; you run that file yourself in the SQL Editor.

import { writeFile } from "node:fs/promises";
import { readSourceRows, INVENTORY_SHEET, REFERENCE_SHEET, type SourceRow } from "./lib/read-source-rows";

function sqlStr(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlNum(value: number): string {
  if (!Number.isFinite(value)) throw new Error(`Non-finite number in source data: ${value}`);
  return value.toString();
}

function rowValuesLine(r: SourceRow): string {
  return `(${sqlNum(r.idInventory)}, ${sqlNum(r.idBarang)}, ${sqlStr(r.nama)}, ${sqlNum(r.idProdusen)}, ${sqlStr(r.produsen)}, ${sqlNum(r.idGudang)}, ${sqlStr(r.gudang)}, ${sqlNum(r.idLokasi)}, ${sqlStr(r.lokasi)}, ${sqlNum(r.hargaPokokJual)}, ${sqlNum(r.hargaPokok)}, ${sqlStr(r.satuanJual)}, ${sqlNum(r.quantityAwal)})`;
}

const ROW_COLUMNS = `
  id_inventory_source, id_barang_source, nama, id_produsen_source, produsen,
  id_gudang_source, gudang, id_lokasi_source, lokasi,
  harga_pokok_jual, harga_pokok, satuan_jual, quantity_awal`;

function insertStatements(tableName: string, rows: SourceRow[]): string {
  const chunkSize = 500;
  const chunks: string[] = [];
  for (let i = 0; i < rows.length; i += chunkSize) {
    chunks.push(rows.slice(i, i + chunkSize).map(rowValuesLine).join(",\n  "));
  }
  return chunks
    .map((chunk) => `insert into ${tableName} (${ROW_COLUMNS}) values\n  ${chunk};`)
    .join("\n\n");
}

function buildSql(catalogRows: SourceRow[], stockedRows: SourceRow[]): string {
  return `-- Generated from "${REFERENCE_SHEET}" (${catalogRows.length} rows) and
-- "${INVENTORY_SHEET}" (${stockedRows.length} rows) by scripts/generate-import-sql.ts.
-- Run this whole file in the Supabase SQL Editor. Safe to re-run: producer/
-- item/unit/location are refreshed by their source ID, inventory rows are
-- inserted once and then left alone (so a repeat run never touches live
-- stock once transactions exist against it). Items only present in the
-- catalog (not also in the stocked list) get a Producer/Item row but no
-- Inventory row, since this unit doesn't actually stock them.

begin;

create temporary table _catalog_rows (
  id_inventory_source integer,
  id_barang_source integer,
  nama text,
  id_produsen_source integer,
  produsen text,
  id_gudang_source integer,
  gudang text,
  id_lokasi_source integer,
  lokasi text,
  harga_pokok_jual numeric,
  harga_pokok numeric,
  satuan_jual text,
  quantity_awal integer
) on commit drop;

create temporary table _stocked_rows (like _catalog_rows) on commit drop;

${insertStatements("_catalog_rows", catalogRows)}

${insertStatements("_stocked_rows", stockedRows)}

insert into stock_rsbb.producer (id_produsen_source, nama)
select distinct id_produsen_source, produsen from _catalog_rows
on conflict (id_produsen_source) do update set nama = excluded.nama;

insert into stock_rsbb.item (id_barang_source, nama, satuan_jual, id_produsen)
select distinct r.id_barang_source, r.nama, r.satuan_jual, p.id_produsen
from _catalog_rows r
join stock_rsbb.producer p on p.id_produsen_source = r.id_produsen_source
on conflict (id_barang_source) do update set nama = excluded.nama, satuan_jual = excluded.satuan_jual;

insert into stock_rsbb.unit (id_gudang_source, nama_gudang)
select distinct id_gudang_source, gudang from _stocked_rows
on conflict (id_gudang_source) do update set nama_gudang = excluded.nama_gudang;

insert into stock_rsbb.location (id_gudang, id_lokasi_source, nama_lokasi)
select distinct u.id_gudang, r.id_lokasi_source, r.lokasi
from _stocked_rows r
join stock_rsbb.unit u on u.id_gudang_source = r.id_gudang_source
on conflict (id_gudang, id_lokasi_source) do update set nama_lokasi = excluded.nama_lokasi;

insert into stock_rsbb.inventory (id_inventory_source, id_barang, id_gudang, id_lokasi, harga_pokok_jual, harga_pokok, quantity_awal)
select r.id_inventory_source, i.id_barang, u.id_gudang, l.id_lokasi, r.harga_pokok_jual, r.harga_pokok, r.quantity_awal
from _stocked_rows r
join stock_rsbb.item i on i.id_barang_source = r.id_barang_source
join stock_rsbb.unit u on u.id_gudang_source = r.id_gudang_source
join stock_rsbb.location l on l.id_gudang = u.id_gudang and l.id_lokasi_source = r.id_lokasi_source
on conflict (id_inventory_source) do nothing;

commit;

select 'producer' as table_name, count(*) from stock_rsbb.producer
union all select 'item', count(*) from stock_rsbb.item
union all select 'unit', count(*) from stock_rsbb.unit
union all select 'location', count(*) from stock_rsbb.location
union all select 'inventory', count(*) from stock_rsbb.inventory;
`;
}

async function main() {
  const filePath = process.argv[2];
  const outPath = process.argv[3];
  if (!filePath || !outPath) {
    console.error('Usage: npm run generate-import-sql -- "path/to/template.xlsx" out.sql');
    process.exit(1);
  }

  console.log(`Reading ${filePath} ...`);
  const catalogRows = await readSourceRows(filePath, REFERENCE_SHEET);
  const stockedRows = await readSourceRows(filePath, INVENTORY_SHEET);
  console.log(`Found ${catalogRows.length} rows in "${REFERENCE_SHEET}", ${stockedRows.length} in "${INVENTORY_SHEET}".`);

  const sql = buildSql(catalogRows, stockedRows);
  await writeFile(outPath, sql, "utf-8");
  console.log(`Wrote ${outPath} (${(sql.length / 1024).toFixed(0)} KB). Paste its contents into the Supabase SQL Editor and run it.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
