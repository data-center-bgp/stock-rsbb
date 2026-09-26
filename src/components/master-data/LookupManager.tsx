"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SpinnerIcon } from "@/components/icons";
import { Alert, cardClass, fieldClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui";

export type LookupEntry = { id: number; nama: string; is_active: boolean };

type Props = {
  table: "distributor" | "hospital_unit";
  idColumn: "id_distributor" | "id_hospital_unit";
  title: string;
  noun: string; // e.g. "distributor", "unit"
  entries: LookupEntry[];
};

function friendlyError(message: string, code: string | undefined, noun: string) {
  if (code === "23505") return `Nama ${noun} itu sudah ada.`;
  return message;
}

const smallButton = `${secondaryButtonClass} h-8 px-2.5 text-xs`;

// Entries are deactivated rather than deleted: past transactions keep
// pointing at them. Inactive ones just drop out of the Mutasi dropdowns.
export function LookupManager({ table, idColumn, title, noun, entries }: Props) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [busy, setBusy] = useState<string | null>(null); // "add" or an entry id
  const [error, setError] = useState<string | null>(null);

  async function run(key: string, action: () => PromiseLike<{ error: { message: string; code?: string } | null }>) {
    setBusy(key);
    setError(null);
    const { error } = await action();
    setBusy(null);
    if (error) {
      setError(friendlyError(error.message, error.code, noun));
      return false;
    }
    router.refresh();
    return true;
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const nama = newName.trim();
    if (!nama) return;
    if (await run("add", () => createClient().from(table).insert({ nama }))) setNewName("");
  }

  async function rename(entry: LookupEntry) {
    const nama = editName.trim();
    if (!nama || nama === entry.nama) return setEditingId(null);
    if (await run(String(entry.id), () => createClient().from(table).update({ nama }).eq(idColumn, entry.id)))
      setEditingId(null);
  }

  function toggle(entry: LookupEntry) {
    return run(String(entry.id), () =>
      createClient().from(table).update({ is_active: !entry.is_active }).eq(idColumn, entry.id),
    );
  }

  const activeCount = entries.filter((e) => e.is_active).length;

  return (
    <section className={cardClass}>
      <div className="border-b border-border p-5">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="mt-0.5 text-sm text-muted">
          {activeCount} aktif{entries.length > activeCount ? ` · ${entries.length - activeCount} nonaktif` : ""}
        </p>
        <form onSubmit={add} className="mt-4 flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={`Nama ${noun} baru`}
            aria-label={`Nama ${noun} baru`}
            className={`${fieldClass} h-10 min-w-0 flex-1 px-3`}
          />
          <button type="submit" disabled={!newName.trim() || busy === "add"} className={`${primaryButtonClass} h-10`}>
            {busy === "add" ? <SpinnerIcon className="size-4" /> : "Tambah"}
          </button>
        </form>
        {error && (
          <div className="mt-3">
            <Alert tone="danger">{error}</Alert>
          </div>
        )}
      </div>

      <ul>
        {entries.map((entry) => {
          const editing = editingId === entry.id;
          const rowBusy = busy === String(entry.id);
          return (
            <li key={entry.id} className="flex items-center gap-3 border-b border-border px-5 py-3 last:border-b-0">
              {editing ? (
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") rename(entry);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  autoFocus
                  aria-label={`Ubah nama ${entry.nama}`}
                  className={`${fieldClass} h-9 min-w-0 flex-1 px-3`}
                />
              ) : (
                <span className={`min-w-0 flex-1 truncate text-sm ${entry.is_active ? "" : "text-muted line-through"}`}>
                  {entry.nama}
                </span>
              )}
              {!entry.is_active && !editing && (
                <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] text-muted">Nonaktif</span>
              )}
              {rowBusy ? (
                <SpinnerIcon className="size-4 text-muted" />
              ) : editing ? (
                <>
                  <button type="button" onClick={() => rename(entry)} className={smallButton}>
                    Simpan
                  </button>
                  <button type="button" onClick={() => setEditingId(null)} className={smallButton}>
                    Batal
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(entry.id);
                      setEditName(entry.nama);
                    }}
                    className={smallButton}
                  >
                    Ubah
                  </button>
                  <button type="button" onClick={() => toggle(entry)} className={smallButton}>
                    {entry.is_active ? "Nonaktifkan" : "Aktifkan"}
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>

      {entries.length === 0 && <p className="px-5 py-10 text-center text-sm text-muted">Belum ada data.</p>}
    </section>
  );
}
