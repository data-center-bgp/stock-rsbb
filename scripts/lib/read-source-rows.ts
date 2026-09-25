// Shared by import-inventory.ts (writes via the Supabase API) and
// generate-import-sql.ts (writes a .sql file for the SQL Editor) — same
// parsing logic, two different ways of getting the data into Supabase.

import ExcelJS from "exceljs";

// The unit's actual stocked items (what gets Inventory/Location/Unit rows).
export const INVENTORY_SHEET = "daftar inventories";
// The fuller catalog for this unit — same columns, superset of rows. Only
// used to enrich the Item/Producer catalog; items only in here (not also in
// INVENTORY_SHEET) don't get an Inventory row, since they aren't actually
// stocked at this unit (see the PRD's decision on this).
export const REFERENCE_SHEET = "daftar referensi inventories";

export type SourceRow = {
  idInventory: number;
  idBarang: number;
  nama: string;
  idProdusen: number;
  produsen: string;
  idGudang: number;
  gudang: string;
  idLokasi: number;
  lokasi: string;
  hargaPokokJual: number;
  hargaPokok: number;
  satuanJual: string;
  quantityAwal: number;
};

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "result" in value) {
    return Number((value as { result: unknown }).result);
  }
  return Number(value);
}

function toStr(value: unknown): string {
  if (value && typeof value === "object" && "result" in value) {
    return String((value as { result: unknown }).result).trim();
  }
  return String(value ?? "").trim();
}

export async function readSourceRows(filePath: string, sheetName: string): Promise<SourceRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) {
    throw new Error(
      `Sheet "${sheetName}" not found. Sheets in this file: ${workbook.worksheets.map((s) => s.name).join(", ")}`,
    );
  }

  const rows: SourceRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const v = row.values as unknown[]; // 1-indexed; v[0] is unused
    if (v[1] == null) return; // blank trailing row

    rows.push({
      idInventory: toNumber(v[1]),
      idBarang: toNumber(v[2]),
      nama: toStr(v[3]),
      idProdusen: toNumber(v[4]),
      produsen: toStr(v[5]),
      idGudang: toNumber(v[6]),
      gudang: toStr(v[7]),
      idLokasi: toNumber(v[8]),
      lokasi: toStr(v[9]),
      hargaPokokJual: toNumber(v[10]),
      hargaPokok: toNumber(v[11]),
      satuanJual: toStr(v[12]),
      quantityAwal: toNumber(v[13]),
    });
  });

  return rows;
}
