"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { offlineDb } from "@/lib/offline/db";
import type { InventoryDetail, StockTransactionType } from "@/lib/types";

const REASONS: { value: StockTransactionType; label: string }[] = [
  { value: "in_procurement", label: "Masuk — Procurement" },
  { value: "in_return", label: "Masuk — Retur" },
  { value: "out_transfer", label: "Keluar — Diberikan ke unit lain" },
  { value: "out_other", label: "Keluar — Lainnya" },
];

export function TransactionForm({ inventory }: { inventory: InventoryDetail }) {
  const [type, setType] = useState<StockTransactionType>("out_transfer");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "queued" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const qty = Number(quantity);
    if (!qty || qty <= 0) return;

    setStatus("saving");
    setErrorMessage(null);
    const localId = crypto.randomUUID();

    if (navigator.onLine) {
      const supabase = createClient();
      const { error } = await supabase.from("stock_transaction").insert({
        id_transaction: localId,
        id_inventory: inventory.id_inventory,
        type,
        quantity: qty,
        note: note || null,
      });

      if (!error) {
        setStatus("saved");
        setQuantity("");
        setNote("");
        return;
      }

      // Only a failed request (lost signal mid-save) belongs in the offline
      // queue. A rejection from the database would just fail again on sync,
      // so show it instead.
      if (!/fetch|network/i.test(error.message)) {
        setStatus("error");
        setErrorMessage(error.message);
        return;
      }
    }

    // Offline, or the request never reached the server — queue it locally and sync later.
    await offlineDb.stockTransactions.add({
      local_id: localId,
      id_inventory: inventory.id_inventory,
      type,
      quantity: qty,
      transfer_group_id: null,
      note: note || null,
      created_at: new Date().toISOString(),
      synced: 0,
    });
    setStatus("queued");
    setQuantity("");
    setNote("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Jenis
        <select
          value={type}
          onChange={(e) => setType(e.target.value as StockTransactionType)}
          className="rounded border border-black/15 px-3 py-2"
        >
          {REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Quantity ({inventory.item.satuan_jual})
        <input
          type="number"
          min={1}
          required
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="rounded border border-black/15 px-3 py-2 text-lg"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Catatan (opsional)
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="rounded border border-black/15 px-3 py-2"
        />
      </label>

      <button
        type="submit"
        disabled={status === "saving"}
        className="rounded bg-black px-4 py-3 text-white disabled:opacity-50"
      >
        {status === "saving" ? "Menyimpan..." : "Simpan"}
      </button>

      {status === "saved" && <p className="text-sm text-green-700">Tersimpan.</p>}
      {status === "queued" && (
        <p className="text-sm text-amber-700">
          Tidak ada koneksi — disimpan di HP, akan tersinkron otomatis.
        </p>
      )}
      {status === "error" && errorMessage && (
        <p className="text-sm text-red-600">Gagal menyimpan: {errorMessage}</p>
      )}
    </form>
  );
}
