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

// Pharmacy "Mutasi" types (0006_mutasi.sql).
export type StockTransactionType =
  | "in_receipt" // Penerimaan Barang: distributor, batch, expiry
  | "in_unit_return" // Retur dari Unit: hospital unit
  | "out_unit_delivery" // Pengiriman ke Unit: hospital unit
  | "out_distributor_return" // Retur ke Distributor: distributor, batch, expiry
  | "out_disposal"; // Pemusnahan: date + quantity only

export type StockTransaction = {
  id_transaction: string;
  id_inventory: number;
  type: StockTransactionType;
  quantity: number;
  transaction_date: string; // YYYY-MM-DD, the date staff enter
  id_distributor: number | null;
  id_hospital_unit: number | null;
  batch_number: string | null;
  expiry_date: string | null;
  transfer_group_id: string | null;
  note: string | null;
  created_by: string;
  created_at: string;
  synced_offline: boolean;
};

export type Distributor = { id_distributor: number; nama: string; is_active: boolean };
export type HospitalUnit = { id_hospital_unit: number; nama: string; is_active: boolean };

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
  created_by: string;
  created_at: string;
};

// master: everything + user management; manager: read-only, all units;
// staff: read/write own unit only. null = signed in, not approved yet.
// Enforced by RLS in 0005_roles_and_access.sql — the UI only follows it.
export type ProfileRole = "master" | "manager" | "staff";

export type Profile = {
  id: string; // = auth.users.id
  email: string;
  full_name: string | null;
  role: ProfileRole | null;
  id_gudang: number | null; // staff's unit, set by a master
  created_at: string;
  updated_at: string;
};

// Item + Inventory + Unit + Location joined — what the /i/[token] scan screen shows.
export type InventoryDetail = Inventory & {
  item: Pick<Item, "nama" | "satuan_jual">;
  unit: Pick<Unit, "nama_gudang">;
  location: Pick<Location, "nama_lokasi">;
};
