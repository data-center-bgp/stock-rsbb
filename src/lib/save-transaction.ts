import { createClient } from "@/lib/supabase/client";
import { offlineDb } from "@/lib/offline/db";
import type { StockTransactionType } from "@/lib/types";

export type NewStockTransaction = {
  id_inventory: number;
  type: StockTransactionType;
  quantity: number;
  transaction_date: string;
  id_distributor: number | null;
  id_hospital_unit: number | null;
  batch_number: string | null;
  expiry_date: string | null;
};

export type SaveResult = { status: "saved" | "queued" } | { status: "error"; message: string };

// Saves a Mutasi / Pemakaian row, or queues it on this device when there's no
// signal (flushed by lib/offline/sync.ts).
export async function saveStockTransaction(record: NewStockTransaction): Promise<SaveResult> {
  const localId = crypto.randomUUID();

  if (navigator.onLine) {
    const { error } = await createClient()
      .from("stock_transaction")
      .insert({ id_transaction: localId, ...record });
    if (!error) return { status: "saved" };
    // Only a failed request (lost signal mid-save) belongs in the offline
    // queue; a database rejection would just fail again on sync.
    if (!/fetch|network/i.test(error.message)) {
      return { status: "error", message: `Gagal menyimpan: ${error.message}` };
    }
  }

  await offlineDb.stockTransactions.add({
    local_id: localId,
    ...record,
    created_at: new Date().toISOString(),
    synced: 0,
  });
  return { status: "queued" };
}
