// Mirrors the ERD in the PRD doc. Keep in sync with supabase/migrations/0001_init.sql.

export type Producer = {
  id_produsen: number;
  nama: string;
};

export type Item = {
  id_barang: number;
  nama: string;
  id_produsen: number;
  satuan_jual: string;
};

export type Unit = {
  id_gudang: number;
  nama_gudang: string;
};

export type Location = {
  id_lokasi: number;
  id_gudang: number;
  nama_lokasi: string;
};

export type Inventory = {
  id_inventory: number;
  id_barang: number;
  id_gudang: number;
  id_lokasi: number;
  qr_token: string;
  harga_pokok_jual: number;
  harga_pokok: number;
  quantity_awal: number;
  current_qty: number;
};

export type StockTransactionType =
  | "in_procurement"
  | "in_return"
  | "in_transfer"
  | "out_transfer"
  | "out_other";

export type StockTransaction = {
  id_transaction: string;
  id_inventory: number;
  type: StockTransactionType;
  quantity: number;
  transfer_group_id: string | null;
  note: string | null;
  created_by: string;
  created_at: string;
  synced_offline: boolean;
};

export type OpnameSessionStatus = "in_progress" | "completed";

export type OpnameSession = {
  id_opname_session: string;
  id_gudang: number;
  opname_date: string;
  status: OpnameSessionStatus;
  created_by: string;
  created_at: string;
};

export type OpnameCount = {
  id_opname_count: string;
  id_opname_session: string;
  id_inventory: number;
  system_qty_snapshot: number;
  counted_qty: number;
  selisih: number;
};

export type ProfileRole = "staff" | "admin";

export type Profile = {
  id: string; // = auth.users.id
  email: string;
  full_name: string | null;
  role: ProfileRole;
  id_gudang: number | null; // home unit, set by an admin
  created_at: string;
  updated_at: string;
};

// Item + Inventory + Unit + Location joined — what the /i/[token] scan screen shows.
export type InventoryDetail = Inventory & {
  item: Pick<Item, "nama" | "satuan_jual">;
  unit: Pick<Unit, "nama_gudang">;
  location: Pick<Location, "nama_lokasi">;
};
