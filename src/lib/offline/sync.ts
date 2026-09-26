import type { AppSupabaseClient } from "@/lib/supabase/types";
import { offlineDb } from "@/lib/offline/db";

// Flushes the local queue to Supabase. Safe to call repeatedly (e.g. on
// mount and on every "online" event) — already-synced rows are skipped.
export async function flushOfflineQueue(supabase: AppSupabaseClient) {
  const pendingTransactions = await offlineDb.stockTransactions
    .where("synced")
    .equals(0)
    .toArray();

  for (const tx of pendingTransactions) {
    const { error } = await supabase.from("stock_transaction").insert({
      id_transaction: tx.local_id,
      id_inventory: tx.id_inventory,
      type: tx.type,
      quantity: tx.quantity,
      transaction_date: tx.transaction_date,
      id_distributor: tx.id_distributor,
      id_hospital_unit: tx.id_hospital_unit,
      batch_number: tx.batch_number,
      expiry_date: tx.expiry_date,
      synced_offline: true,
    });
    if (!error) {
      await offlineDb.stockTransactions.delete(tx.local_id);
    }
  }

  const pendingCounts = await offlineDb.opnameCounts
    .where("synced")
    .equals(0)
    .toArray();

  for (const count of pendingCounts) {
    const { error } = await supabase.from("opname_count").insert({
      id_opname_count: count.local_id,
      id_opname_session: count.id_opname_session,
      id_inventory: count.id_inventory,
      system_qty_snapshot: count.system_qty_snapshot,
      counted_qty: count.counted_qty,
    });
    if (!error) {
      await offlineDb.opnameCounts.delete(count.local_id);
    }
  }
}
