import Dexie, { type EntityTable } from "dexie";
import type { InventoryDetail, StockTransactionType } from "@/lib/types";

// Queued writes made while offline, flushed to Supabase on reconnect.
// Append-only inserts only — no edits to existing rows — so sync never
// needs merge/conflict handling, just "send what's queued".

export type QueuedStockTransaction = {
  local_id: string; // client-generated UUID, becomes id_transaction on sync
  id_inventory: number;
  type: StockTransactionType;
  quantity: number;
  transfer_group_id: string | null;
  note: string | null;
  created_at: string;
  // IndexedDB keys can't be boolean, so this is indexed as 0 (pending) / 1 (synced).
  synced: 0 | 1;
};

export type QueuedOpnameCount = {
  local_id: string; // client-generated UUID, becomes id_opname_count on sync
  id_opname_session: string;
  id_inventory: number;
  system_qty_snapshot: number;
  counted_qty: number;
  created_at: string;
  synced: 0 | 1;
};

// Cached lookup so a QR scan resolves to item info even with no signal.
// Synced from Supabase on login and periodically while online.
export type CachedInventory = InventoryDetail;

class OfflineDB extends Dexie {
  stockTransactions!: EntityTable<QueuedStockTransaction, "local_id">;
  opnameCounts!: EntityTable<QueuedOpnameCount, "local_id">;
  inventoryCache!: EntityTable<CachedInventory, "id_inventory">;

  constructor() {
    super("stock-rsbb-offline");
    this.version(1).stores({
      stockTransactions: "local_id, synced",
      opnameCounts: "local_id, synced",
      inventoryCache: "id_inventory, qr_token",
    });
  }
}

export const offlineDb = new OfflineDB();
