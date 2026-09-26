// Bulk import for the distributor / hospital-unit lists. Pure functions, so
// the Data Master preview (browser) and the import itself (server action)
// decide each row the same way.

export type LookupTable = "distributor" | "hospital_unit";

export type ExistingLookup = { id: number; nama: string; source_id: string | null; is_active: boolean };

export type ImportRow = { nama: string; source_id: string | null };

export type PlannedRow = ImportRow &
  (
    | { action: "add" }
    | { action: "rename"; id: number; from: string } // same source ID, new name
    | { action: "link"; id: number } // same name, gets the source ID it lacked
    | { action: "unchanged"; id: number; is_active: boolean }
    | { action: "skip"; reason: string }
  );

export const MAX_IMPORT_ROWS = 5000;
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024; // under next.config's 4mb Server Action limit

// "-", "—" etc. are how the hospital exports write "no value".
export function cleanCell(value: string | null | undefined) {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  return /^[-–—]*$/.test(text) ? "" : text;
}

const key = (nama: string) => nama.toLowerCase();

// Best guess for the name column: the one with the most distinct text values.
// For the hospital unit export that's GUDANG — UNIT repeats names and uses
// "-" for some rows. A header mentioning "nama" wins a tie.
export function guessNameColumn(headers: string[], rows: string[][]) {
  let best = 0;
  let bestScore = -1;
  headers.forEach((header, col) => {
    const values = new Set<string>();
    for (const row of rows) {
      const v = cleanCell(row[col]);
      if (v && !/^\d+$/.test(v)) values.add(key(v));
    }
    const score = values.size * 2 + (/nama|name/i.test(header) ? 1 : 0);
    if (score > bestScore) [best, bestScore] = [col, score];
  });
  return best;
}

// An "ID" / "Kode" column, if there is one; -1 for none.
export function guessIdColumn(headers: string[]) {
  return headers.findIndex((h) => /^(id|kode|code)\b/i.test(h.trim()));
}

export function extractRows(rows: string[][], nameCol: number, idCol: number): ImportRow[] {
  return rows.map((row) => ({
    nama: cleanCell(row[nameCol]),
    source_id: idCol >= 0 ? cleanCell(row[idCol]) || null : null,
  }));
}

export function planImport(rows: ImportRow[], existing: ExistingLookup[]): PlannedRow[] {
  const byName = new Map(existing.map((e) => [key(e.nama), e]));
  const bySource = new Map(existing.filter((e) => e.source_id).map((e) => [e.source_id!, e]));
  const seenNames = new Set<string>();
  const seenSources = new Set<string>();

  return rows.map((row): PlannedRow => {
    if (!row.nama) return { ...row, action: "skip", reason: "Nama kosong" };
    const k = key(row.nama);
    if (seenNames.has(k)) return { ...row, action: "skip", reason: "Nama ganda di file" };
    if (row.source_id && seenSources.has(row.source_id))
      return { ...row, action: "skip", reason: "ID ganda di file" };
    seenNames.add(k);
    if (row.source_id) seenSources.add(row.source_id);

    const sameSource = row.source_id ? bySource.get(row.source_id) : undefined;
    const sameName = byName.get(k);

    if (sameSource) {
      if (key(sameSource.nama) === k)
        return { ...row, action: "unchanged", id: sameSource.id, is_active: sameSource.is_active };
      if (sameName) return { ...row, action: "skip", reason: `Nama sudah dipakai oleh ID lain` };
      return { ...row, action: "rename", id: sameSource.id, from: sameSource.nama };
    }
    if (sameName) {
      if (row.source_id && !sameName.source_id) return { ...row, action: "link", id: sameName.id };
      if (row.source_id && sameName.source_id !== row.source_id)
        return { ...row, action: "skip", reason: `Nama sudah ada dengan ID ${sameName.source_id}` };
      return { ...row, action: "unchanged", id: sameName.id, is_active: sameName.is_active };
    }
    return { ...row, action: "add" };
  });
}

export type ImportSummary = { added: number; renamed: number; linked: number; unchanged: number; skipped: number };

export function summarize(plan: PlannedRow[]): ImportSummary {
  const count = (a: PlannedRow["action"]) => plan.filter((p) => p.action === a).length;
  return {
    added: count("add"),
    renamed: count("rename"),
    linked: count("link"),
    unchanged: count("unchanged"),
    skipped: count("skip"),
  };
}
