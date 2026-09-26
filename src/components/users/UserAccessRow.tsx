"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SpinnerIcon } from "@/components/icons";
import { Alert, fieldClass, primaryButtonClass } from "@/components/ui";
import type { ProfileRole } from "@/lib/types";

export type ManagedUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: ProfileRole | null;
  id_gudang: number | null;
};

type Unit = { id_gudang: number; nama_gudang: string };

const ROLE_OPTIONS: { value: ProfileRole | ""; label: string }[] = [
  { value: "", label: "Belum disetujui" },
  { value: "staff", label: "Staf" },
  { value: "manager", label: "Manajer" },
  { value: "master", label: "Master" },
];

const selectClass = `${fieldClass} h-10 w-full cursor-pointer pl-3 pr-8 disabled:cursor-not-allowed disabled:opacity-50`;

export function UserAccessRow({ user, units, isSelf }: { user: ManagedUser; units: Unit[]; isSelf: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(user.full_name ?? "");
  const [role, setRole] = useState<ProfileRole | "">(user.role ?? "");
  const [unit, setUnit] = useState(user.id_gudang ? String(user.id_gudang) : "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const dirty =
    name.trim() !== (user.full_name ?? "") ||
    role !== (user.role ?? "") ||
    (role === "staff" && unit !== (user.id_gudang ? String(user.id_gudang) : ""));
  const missingUnit = role === "staff" && !unit;

  async function save() {
    setStatus("saving");
    setError(null);
    const { error } = await createClient().rpc("set_user_access", {
      target: user.id,
      new_role: role || null,
      new_unit: role === "staff" ? Number(unit) : null,
      new_full_name: name,
    });
    if (error) {
      setStatus("error");
      setError(error.message);
      return;
    }
    setStatus("saved");
    router.refresh();
  }

  return (
    <li className="flex flex-col gap-3 border-b border-border px-5 py-4 last:border-b-0">
      <div className="grid items-center gap-3 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_150px_minmax(0,190px)_auto]">
        <div className="min-w-0">
          <p className="truncate font-medium">{user.email}</p>
          <p className="mt-0.5 text-xs">
            {isSelf ? (
              <span className="text-muted">Akun Anda</span>
            ) : !user.role ? (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-medium text-amber-700 dark:text-amber-400">
                Menunggu persetujuan
              </span>
            ) : (
              <span className="text-muted">Aktif</span>
            )}
          </p>
        </div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isSelf}
          placeholder="Nama lengkap"
          aria-label={`Nama untuk ${user.email}`}
          className={`${fieldClass} h-10 w-full px-3 disabled:opacity-50`}
        />

        <select
          value={role}
          onChange={(e) => setRole(e.target.value as ProfileRole | "")}
          disabled={isSelf}
          aria-label={`Peran untuk ${user.email}`}
          className={selectClass}
        >
          {ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          value={role === "staff" ? unit : ""}
          onChange={(e) => setUnit(e.target.value)}
          disabled={isSelf || role !== "staff"}
          aria-label={`Inventori untuk ${user.email}`}
          className={selectClass}
        >
          <option value="">{role === "staff" ? "Pilih inventori..." : "Semua inventori"}</option>
          {units.map((u) => (
            <option key={u.id_gudang} value={u.id_gudang}>
              {u.nama_gudang}
            </option>
          ))}
        </select>

        {isSelf ? (
          <span className="text-center text-xs text-muted md:w-24">Ubah lewat SQL</span>
        ) : (
          <button
            type="button"
            onClick={save}
            disabled={!dirty || missingUnit || status === "saving"}
            className={`${primaryButtonClass} h-10 md:w-24`}
          >
            {status === "saving" ? <SpinnerIcon className="size-4" /> : "Simpan"}
          </button>
        )}
      </div>

      {missingUnit && <p className="text-xs text-amber-700 dark:text-amber-400">Staf harus diberi inventori.</p>}
      {status === "saved" && !dirty && <Alert tone="success">Akses {user.email} tersimpan.</Alert>}
      {status === "error" && error && <Alert tone="danger">{error}</Alert>}
    </li>
  );
}
