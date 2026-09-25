"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ensureOpnameSession } from "@/lib/opname";
import type { InventoryDetail } from "@/lib/types";

export function OpnameForm({ inventory }: { inventory: InventoryDetail }) {
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
      "Tidak ada koneksi. Sesi stock opname untuk unit ini perlu dibuka saat online terlebih dahulu.",
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <p className="text-sm text-zinc-600">
        Stok sistem: <span className="font-medium">{inventory.current_qty}</span>{" "}
        {inventory.item.satuan_jual}
      </p>

      <label className="flex flex-col gap-1 text-sm">
        Quantity hasil hitung ({inventory.item.satuan_jual})
        <input
          type="number"
          min={0}
          required
          value={countedQty}
          onChange={(e) => setCountedQty(e.target.value)}
          className="rounded border border-black/15 px-3 py-2 text-lg"
        />
      </label>

      <button
        type="submit"
        disabled={status === "saving"}
        className="rounded bg-black px-4 py-3 text-white disabled:opacity-50"
      >
        {status === "saving" ? "Menyimpan..." : "Simpan hasil hitung"}
      </button>

      {status === "saved" && <p className="text-sm text-green-700">Tersimpan.</p>}
      {status === "error" && errorMessage && (
        <p className="text-sm text-red-600">{errorMessage}</p>
      )}
    </form>
  );
}
