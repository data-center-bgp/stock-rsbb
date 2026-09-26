"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import {
  MAX_IMPORT_ROWS,
  MAX_UPLOAD_BYTES,
  planImport,
  summarize,
  type ExistingLookup,
  type ImportSummary,
  type LookupTable,
} from "@/lib/lookup-import";

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

const ID_COLUMN = { distributor: "id_distributor", hospital_unit: "id_hospital_unit" } as const;

async function requireMaster() {
  const session = await getSession();
  return session.profile?.role === "master" ? session : null;
}

// Minimal CSV reader: quoted fields, "" escapes, and ";" as the separator when
// the header uses it (Excel's CSV export on Indonesian-locale Windows).
function parseCsv(text: string): string[][] {
  const header = text.split(/\r?\n/, 1)[0];
  const sep = header.split(";").length > header.split(",").length ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c !== '"') field += c;
      else if (text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = false;
    } else if (c === '"') {
      quoted = true;
    } else if (c === sep) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field || row.length) rows.push([...row, field]);
  return rows;
}

async function parseXlsx(buffer: ArrayBuffer): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  // First sheet that has anything on it.
  const sheet = workbook.worksheets.find((s) => s.actualRowCount > 0);
  if (!sheet) return [];
  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    for (let c = 1; c <= sheet.columnCount; c++) {
      const cell = row.getCell(c);
      // A merged range repeats its value in every cell; keep it once, in the
      // top-left one (the hospital exports merge each entry over two rows).
      cells.push(cell.isMerged && cell.master !== cell ? "" : (cell.text ?? ""));
    }
    rows.push(cells);
  });
  return rows;
}

export async function readImportFile(
  formData: FormData,
): Promise<Result<{ headers: string[]; rows: string[][] }>> {
  if (!(await requireMaster())) return { ok: false, error: "Hanya master yang dapat mengimpor data." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Pilih file terlebih dahulu." };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "File terlalu besar (maksimal 3 MB)." };

  const name = file.name.toLowerCase();
  let table: string[][];
  try {
    if (name.endsWith(".xlsx")) table = await parseXlsx(await file.arrayBuffer());
    else if (name.endsWith(".csv")) table = parseCsv((await file.text()).replace(/^﻿/, ""));
    else return { ok: false, error: "Format tidak didukung. Gunakan file .xlsx atau .csv (file .xls: simpan ulang sebagai .xlsx)." };
  } catch {
    return { ok: false, error: "File tidak dapat dibaca. Pastikan file tidak rusak atau terkunci kata sandi." };
  }

  // Drop blank rows (the hospital exports leave one between every entry).
  const nonEmpty = table.map((r) => r.map((c) => c.trim())).filter((r) => r.some(Boolean));
  if (nonEmpty.length < 2) return { ok: false, error: "File tidak berisi data (butuh baris judul kolom dan minimal satu baris data)." };

  const [headerRow, ...rows] = nonEmpty;
  const width = Math.max(...nonEmpty.map((r) => r.length));
  const headers = Array.from({ length: width }, (_, i) => headerRow[i] || `Kolom ${i + 1}`);
  if (rows.length > MAX_IMPORT_ROWS)
    return { ok: false, error: `Terlalu banyak baris (${rows.length}); maksimal ${MAX_IMPORT_ROWS} per impor.` };

  return { ok: true, headers, rows: rows.map((r) => headers.map((_, i) => r[i] ?? "")) };
}

const rowsSchema = z
  .array(z.object({ nama: z.string().max(200), source_id: z.string().max(100).nullable() }))
  .max(MAX_IMPORT_ROWS);

export async function importLookup(table: LookupTable, input: unknown): Promise<Result<{ summary: ImportSummary }>> {
  const session = await requireMaster();
  if (!session) return { ok: false, error: "Hanya master yang dapat mengimpor data." };
  if (!(table in ID_COLUMN)) return { ok: false, error: "Tabel tidak dikenal." };
  const parsed = rowsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Data impor tidak valid." };

  const { supabase } = session;
  const idColumn = ID_COLUMN[table];

  // Re-plan against the current data rather than trusting the preview, in
  // case someone edited the list in the meantime.
  const { data, error } = await supabase.from(table).select(`${idColumn}, nama, source_id, is_active`);
  if (error) return { ok: false, error: error.message };
  const existing: ExistingLookup[] = (data as Record<string, unknown>[]).map((r) => ({
    id: r[idColumn] as number,
    nama: r.nama as string,
    source_id: r.source_id as string | null,
    is_active: r.is_active as boolean,
  }));
  const plan = planImport(parsed.data, existing);

  const adds = plan.filter((p) => p.action === "add").map(({ nama, source_id }) => ({ nama, source_id }));
  if (adds.length) {
    // One insert: if any row is rejected, none are added.
    const { error } = await supabase.from(table).insert(adds);
    if (error)
      return {
        ok: false,
        error: error.code === "23505" ? "Sebagian nama atau ID sudah ada. Muat ulang halaman dan coba lagi." : error.message,
      };
  }

  for (const p of plan) {
    if (p.action !== "rename" && p.action !== "link") continue;
    const patch = p.action === "rename" ? { nama: p.nama } : { source_id: p.source_id };
    const { error } = await supabase.from(table).update(patch).eq(idColumn, p.id);
    if (error) return { ok: false, error: `Gagal memperbarui "${p.nama}": ${error.message}` };
  }

  revalidatePath("/master-data");
  return { ok: true, summary: summarize(plan) };
}
