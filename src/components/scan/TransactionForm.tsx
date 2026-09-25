"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { offlineDb } from "@/lib/offline/db";
import { SpinnerIcon } from "@/components/icons";
import { Alert, fieldClass, inputClass, primaryButtonClass } from "@/components/ui";
import type { InventoryDetail, StockTransactionType } from "@/lib/types";

const TYPES: { value: StockTransactionType; direction: "in" | "out"; label: string; detail: string }[] = [
  { value: "in_procurement", direction: "in", label: "Masuk", detail: "Procurement" },
  { value: "in_return", direction: "in", label: "Masuk", detail: "Retur" },
  { value: "out_transfer", direction: "out", label: "Keluar", detail: "Ke unit lain" },
  { value: "out_other", direction: "out", label: "Keluar", detail: "Lainnya" },
];

export function TransactionForm({
  inventory,
  onSaved,
}: {
  inventory: InventoryDetail;
  onSaved?: (delta: number) => void;
}) {
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
        onSaved?.(type.startsWith("in_") ? qty : -qty);
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Jenis transaksi</legend>
        <div className="grid grid-cols-2 gap-2">
          {TYPES.map((t) => {
            const selected = type === t.value;
            return (
              <label
                key={t.value}
                className={`cursor-pointer rounded-xl border px-3 py-2.5 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-primary ${
                  selected ? "border-primary bg-primary/8" : "border-border hover:bg-surface-muted"
                }`}
              >
                <input
                  type="radio"
                  name="type"
                  value={t.value}
                  checked={selected}
                  onChange={() => setType(t.value)}
                  className="sr-only"
                />
                <span
                  className={`block text-sm font-semibold ${
                    t.direction === "in" ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
                  }`}
                >
                  {t.direction === "in" ? "+ " : "− "}
                  {t.label}
                </span>
                <span className="block text-xs text-muted">{t.detail}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="quantity" className="text-sm font-medium">
          Jumlah ({inventory.item.satuan_jual})
        </label>
        <input
          id="quantity"
          type="number"
          inputMode="numeric"
          min={1}
          required
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className={`${fieldClass} h-12 w-full px-3.5 text-lg font-semibold tabular-nums`}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="note" className="text-sm font-medium">
          Catatan <span className="font-normal text-muted">(opsional)</span>
        </label>
        <input
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={`${inputClass} px-3.5`}
        />
      </div>

      <button type="submit" disabled={status === "saving"} className={`${primaryButtonClass} w-full`}>
        {status === "saving" && <SpinnerIcon className="size-4" />}
        {status === "saving" ? "Menyimpan..." : "Simpan"}
      </button>

      {status === "saved" && <Alert tone="success">Transaksi tersimpan.</Alert>}
      {status === "queued" && (
        <Alert tone="warning">Tidak ada koneksi — disimpan di HP, akan tersinkron otomatis.</Alert>
      )}
      {status === "error" && errorMessage && <Alert tone="danger">Gagal menyimpan: {errorMessage}</Alert>}
    </form>
  );
}
