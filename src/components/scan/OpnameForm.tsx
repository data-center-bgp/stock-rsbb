"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ensureOpnameSession } from "@/lib/opname";
import { OPNAME_HOME, scanHref } from "@/lib/input-mode";
import { ScanLineIcon, SearchIcon, SpinnerIcon } from "@/components/icons";
import { Alert, fieldClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import type { InventoryDetail } from "@/lib/types";

// `isUnit`: a hospital unit's inventory. There the database compares the
// count with the previous count (the first one has nothing to compare with
// and becomes the starting stock), then sets the stock to what was counted
// (0010_unit_inventories.sql). `firstCount` = never counted before.
export function OpnameForm({
  inventory,
  isUnit = false,
  firstCount = false,
  onSaved,
}: {
  inventory: InventoryDetail;
  isUnit?: boolean;
  firstCount?: boolean;
  onSaved?: (counted: number) => void;
}) {
  const [countedQty, setCountedQty] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (countedQty === "") return;

    const counted = Number(countedQty);
    if (!Number.isInteger(counted) || counted < 0) {
      setStatus("error");
      setErrorMessage("Jumlah harus bilangan bulat 0 atau lebih.");
      return;
    }
    setStatus("saving");
    setErrorMessage(null);

    if (!navigator.onLine) {
      setStatus("error");
      setErrorMessage("Tidak ada koneksi. Stock opname perlu disimpan saat online.");
      return;
    }

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesi login sudah habis, silakan masuk kembali.");

      const sessionId = await ensureOpnameSession(supabase, inventory.id_gudang, user.id);

      const { error } = await supabase.from("opname_count").insert({
        id_opname_count: crypto.randomUUID(),
        id_opname_session: sessionId,
        id_inventory: inventory.id_inventory,
        // Units: the database fills this in itself (see above).
        system_qty_snapshot: inventory.current_qty,
        counted_qty: counted,
      });
      if (error) throw error;

      setStatus("saved");
      setCountedQty("");
      onSaved?.(counted);
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Gagal menyimpan.");
    }
  }

  const variance = countedQty === "" || firstCount ? null : Number(countedQty) - inventory.current_qty;

  if (status === "saved") {
    return (
      <div className="flex flex-col gap-3">
        <Alert tone="success">Hasil hitung tersimpan.</Alert>
        <Link href={scanHref("opname")} className={`${primaryButtonClass} w-full`}>
          <ScanLineIcon className="size-4" /> Scan item berikutnya
        </Link>
        <Link href={OPNAME_HOME} className={`${secondaryButtonClass} h-11 w-full px-4 text-sm`}>
          <SearchIcon className="size-4" /> Cari item lain
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="counted" className="text-sm font-medium">
          Jumlah hasil hitung fisik ({inventory.item.satuan_jual})
        </label>
        <input
          id="counted"
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          required
          value={countedQty}
          onChange={(e) => setCountedQty(e.target.value)}
          className={`${fieldClass} h-12 w-full px-3.5 text-lg font-semibold tabular-nums`}
        />
      </div>

      {firstCount ? (
        <p className="rounded-xl bg-surface-muted px-4 py-3 text-sm text-muted">
          Hitungan pertama item ini di unit: jumlahnya menjadi stok awal, tanpa selisih.
        </p>
      ) : (
        <div className="flex items-center justify-between rounded-xl bg-surface-muted px-4 py-3 text-sm">
          <span className="text-muted">{isUnit ? "Selisih dengan hitungan terakhir" : "Selisih dengan stok sistem"}</span>
          <span
            className={`font-semibold tabular-nums ${
              variance === null || variance === 0
                ? "text-muted"
                : variance > 0
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-rose-700 dark:text-rose-400"
            }`}
          >
            {variance === null ? "—" : variance > 0 ? `+${variance}` : variance}
          </span>
        </div>
      )}

      <button type="submit" disabled={status === "saving"} className={`${primaryButtonClass} w-full`}>
        {status === "saving" && <SpinnerIcon className="size-4" />}
        {status === "saving" ? "Menyimpan..." : "Simpan hasil hitung"}
      </button>

      {status === "error" && errorMessage && <Alert tone="danger">{errorMessage}</Alert>}
    </form>
  );
}
