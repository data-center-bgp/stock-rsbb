"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { importLookup, readImportFile } from "@/app/(app)/master-data/actions";
import {
  MAX_UPLOAD_BYTES,
  extractRows,
  guessIdColumn,
  guessNameColumn,
  planImport,
  summarize,
  type ExistingLookup,
  type ImportSummary,
  type LookupTable,
  type PlannedRow,
} from "@/lib/lookup-import";
import { SpinnerIcon, UploadIcon } from "@/components/icons";
import { Alert, fieldClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui";

type Props = { table: LookupTable; title: string; noun: string; existing: ExistingLookup[] };

type Sheet = { fileName: string; headers: string[]; rows: string[][] };

const STATUS: Record<PlannedRow["action"], { label: string; className: string }> = {
  add: { label: "Baru", className: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400" },
  rename: { label: "Ganti nama", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  link: { label: "Tautkan ID", className: "bg-sky-500/12 text-sky-700 dark:text-sky-400" },
  unchanged: { label: "Sudah ada", className: "bg-surface-muted text-muted" },
  skip: { label: "Dilewati", className: "bg-rose-500/12 text-rose-700 dark:text-rose-400" },
};

function describe(p: PlannedRow) {
  if (p.action === "rename") return `dari "${p.from}"`;
  if (p.action === "skip") return p.reason;
  if (p.action === "unchanged" && !p.is_active) return "nonaktif";
  return "";
}

function summaryText(s: ImportSummary) {
  return [
    s.added && `${s.added} ditambahkan`,
    s.renamed && `${s.renamed} diganti nama`,
    s.linked && `${s.linked} ditautkan ke ID`,
    s.unchanged && `${s.unchanged} sudah ada`,
    s.skipped && `${s.skipped} dilewati`,
  ]
    .filter(Boolean)
    .join(", ");
}

const selectClass = `${fieldClass} h-10 w-full px-3`;

// Upload an .xlsx/.csv export, pick which columns hold the name (and the
// hospital system's ID, if any), preview what happens to each row, import.
export function LookupImport({ table, title, noun, existing }: Props) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [nameCol, setNameCol] = useState(0);
  const [idCol, setIdCol] = useState(-1);
  const [busy, setBusy] = useState<"read" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<ImportSummary | null>(null);

  const plan = useMemo(
    () => (sheet ? planImport(extractRows(sheet.rows, nameCol, idCol), existing) : []),
    [sheet, nameCol, idCol, existing],
  );
  const summary = summarize(plan);
  const changes = summary.added + summary.renamed + summary.linked;

  function open() {
    setSheet(null);
    setError(null);
    setDone(null);
    dialogRef.current?.showModal();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // so picking the same file again still fires
    if (!file) return;
    setError(null);
    if (file.size > MAX_UPLOAD_BYTES) return setError("File terlalu besar (maksimal 3 MB).");

    setBusy("read");
    const formData = new FormData();
    formData.append("file", file);
    const result = await readImportFile(formData).catch(() => null);
    setBusy(null);
    if (!result) return setError("Tidak dapat terhubung ke server. Periksa koneksi Anda.");
    if (!result.ok) return setError(result.error);

    setSheet({ fileName: file.name, headers: result.headers, rows: result.rows });
    setNameCol(guessNameColumn(result.headers, result.rows));
    setIdCol(guessIdColumn(result.headers));
  }

  async function runImport() {
    if (!sheet) return;
    setBusy("import");
    setError(null);
    const result = await importLookup(table, extractRows(sheet.rows, nameCol, idCol)).catch(() => null);
    setBusy(null);
    if (!result) return setError("Tidak dapat terhubung ke server. Periksa koneksi Anda.");
    if (!result.ok) return setError(result.error);
    setDone(result.summary);
    router.refresh();
  }

  return (
    <>
      <button type="button" onClick={open} className={`${secondaryButtonClass} h-9 px-3 text-sm`}>
        <UploadIcon className="size-4" />
        Impor
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={`import-${table}-title`}
        className="m-auto w-[min(760px,calc(100vw-2rem))] rounded-2xl border border-border bg-surface p-0 text-foreground shadow-2xl backdrop:bg-black/50"
      >
        <div className="flex max-h-[calc(100dvh-4rem)] flex-col">
          <div className="border-b border-border p-5">
            <h2 id={`import-${table}-title`} className="text-lg font-semibold tracking-tight">
              Impor {title}
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              File .xlsx atau .csv dengan judul kolom di baris pertama. Nama yang sudah ada tidak ditambahkan lagi.
            </p>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
            {error && <Alert tone="danger">{error}</Alert>}

            {done ? (
              <Alert tone="success">Impor selesai: {summaryText(done)}.</Alert>
            ) : (
              <>
                <label
                  className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-5 text-sm text-muted transition-colors hover:border-primary hover:text-foreground ${busy ? "pointer-events-none opacity-60" : ""}`}
                >
                  {busy === "read" ? <SpinnerIcon className="size-4" /> : <UploadIcon className="size-4" />}
                  {busy === "read"
                    ? "Membaca file..."
                    : sheet
                      ? `${sheet.fileName} · ${sheet.rows.length} baris — pilih file lain`
                      : "Pilih file .xlsx atau .csv"}
                  <input type="file" accept=".xlsx,.csv" onChange={onFile} className="sr-only" />
                </label>

                {sheet && (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="flex flex-col gap-1.5 text-sm font-medium">
                        Kolom nama {noun}
                        <select value={nameCol} onChange={(e) => setNameCol(Number(e.target.value))} className={selectClass}>
                          {sheet.headers.map((h, i) => (
                            <option key={i} value={i}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col gap-1.5 text-sm font-medium">
                        Kolom ID sistem RS (opsional)
                        <select value={idCol} onChange={(e) => setIdCol(Number(e.target.value))} className={selectClass}>
                          <option value={-1}>Tidak ada</option>
                          {sheet.headers.map((h, i) => (
                            <option key={i} value={i}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="flex flex-wrap gap-1.5 text-xs">
                      {(["add", "rename", "link", "unchanged", "skip"] as const).map((a) => {
                        const n = plan.filter((p) => p.action === a).length;
                        return n ? (
                          <span key={a} className={`rounded-full px-2.5 py-1 font-medium ${STATUS[a].className}`}>
                            {n} {STATUS[a].label.toLowerCase()}
                          </span>
                        ) : null;
                      })}
                    </div>

                    <div className="overflow-hidden rounded-xl border border-border">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-surface-muted text-xs text-muted">
                          <tr>
                            <th className="px-3 py-2 font-medium">Nama</th>
                            <th className="w-24 px-3 py-2 font-medium">ID</th>
                            <th className="px-3 py-2 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {plan.map((p, i) => (
                            <tr key={i} className="border-t border-border">
                              <td className="px-3 py-2">{p.nama || <span className="text-muted">(kosong)</span>}</td>
                              <td className="px-3 py-2 tabular-nums text-muted">{p.source_id ?? "—"}</td>
                              <td className="px-3 py-2">
                                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS[p.action].className}`}>
                                  {STATUS[p.action].label}
                                </span>
                                {describe(p) && <span className="ml-2 text-xs text-muted">{describe(p)}</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-border p-4">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              disabled={busy === "import"}
              className={`${secondaryButtonClass} h-10 px-4 text-sm`}
            >
              {done ? "Tutup" : "Batal"}
            </button>
            {!done && (
              <button
                type="button"
                onClick={runImport}
                disabled={!changes || busy !== null}
                className={`${primaryButtonClass} h-10`}
              >
                {busy === "import" && <SpinnerIcon className="size-4" />}
                {changes ? `Impor ${changes} data` : "Tidak ada perubahan"}
              </button>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
