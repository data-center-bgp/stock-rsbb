"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ensureOpnameSession } from "@/lib/opname";
import { ScanLineIcon, SpinnerIcon } from "@/components/icons";
import { Alert, fieldClass, primaryButtonClass } from "@/components/ui";
import type { InventoryDetail } from "@/lib/types";

export function OpnameForm({ inventory, nextScanHref }: { inventory: InventoryDetail; nextScanHref: string }) {
  const [countedQty, setCountedQty] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "queued" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (countedQty === "") return;

    const counted = Number(countedQty);
    setStatus("saving");
    setErrorMessage(null);
    const localId = crypto.randomUUID();

    if (navigator.onLine) {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Sesi login sudah habis, silakan masuk kembali.");

        const sessionId = await ensureOpnameSession(supabase, inventory.id_gudang, user.id);

        const { error } = await supabase.from("opname_count").insert({
          id_opname_count: localId,
          id_opname_session: sessionId,
          id_inventory: inventory.id_inventory,
          system_qty_snapshot: inventory.current_qty,
          counted_qty: counted,
        });
        if (error) throw error;

        setStatus("saved");
        setCountedQty("");
        return;
      } catch (err) {
        // Online but the write failed for a reason other than connectivity
        // (e.g. no opname session yet, auth expired) — surface it instead
        // of silently queueing, since a queued count still needs a real
        // session id once it syncs.
        setStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "Gagal menyimpan.");
        return;
      }
    }

    setStatus("error");
    setErrorMessage(
      "Tidak ada koneksi. Sesi stock opname untuk inventori ini perlu dibuka saat online terlebih dahulu.",
    );
  }

  const variance = countedQty === "" ? null : Number(countedQty) - inventory.current_qty;

  if (status === "saved") {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="success">Hasil hitung tersimpan.</Alert>
        <Link href={nextScanHref} className={`${primaryButtonClass} w-full`}>
          <ScanLineIcon className="size-4" /> Scan item berikutnya
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
          required
          value={countedQty}
          onChange={(e) => setCountedQty(e.target.value)}
          className={`${fieldClass} h-12 w-full px-3.5 text-lg font-semibold tabular-nums`}
        />
      </div>

      <div className="flex items-center justify-between rounded-xl bg-surface-muted px-4 py-3 text-sm">
        <span className="text-muted">Selisih dengan stok sistem</span>
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

      <button type="submit" disabled={status === "saving"} className={`${primaryButtonClass} w-full`}>
        {status === "saving" && <SpinnerIcon className="size-4" />}
        {status === "saving" ? "Menyimpan..." : "Simpan hasil hitung"}
      </button>

      {status === "error" && errorMessage && <Alert tone="danger">{errorMessage}</Alert>}
    </form>
  );
}
