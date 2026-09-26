// Riwayat: Mutasi (stock_transaction) and Stock Opname (opname_count),
// newest first, read through the history_entry view (0009) so both can be
// shown as one timeline. RLS still applies through the view — staff get
// their own inventory, managers and masters everything.

import { MUTASI_TYPES, isMutasiType } from "@/lib/mutasi";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { StockTransactionType } from "@/lib/types";

export const HISTORY_PAGE_SIZE = 25;

// "semua" = both, interleaved by time.
export type HistoryTab = "semua" | "mutasi" | "opname";

export type HistoryFilters = {
  tab: HistoryTab;
  q: string; // item, distributor or unit name
  unit: string | null; // id_gudang
  inv: string | null; // one inventory row (from the item screen)
  jenis: "masuk" | "keluar" | StockTransactionType | null; // Mutasi tab only
  selisih: "ada" | "sesuai" | null; // Opname tab only
  from: string | null; // YYYY-MM-DD, inclusive
  to: string | null;
  mine: boolean; // only what I recorded
  page: number;
};

export type HistorySearchParams = Partial<Record<keyof HistoryFilters, string>>;

const isDate = (v: string | undefined): v is string => /^\d{4}-\d{2}-\d{2}$/.test(v ?? "");
const isId = (v: string | undefined): v is string => /^\d+$/.test(v ?? "");

export function parseHistoryFilters(params: HistorySearchParams): HistoryFilters {
  const tab = params.tab === "mutasi" || params.tab === "opname" ? params.tab : "semua";
  const jenis = params.jenis === "masuk" || params.jenis === "keluar" || isMutasiType(params.jenis) ? params.jenis : null;
  const selisih = params.selisih === "ada" || params.selisih === "sesuai" ? params.selisih : null;
  return {
    tab,
    q: (params.q ?? "").trim().slice(0, 100),
    unit: isId(params.unit) ? params.unit : null,
    inv: isId(params.inv) ? params.inv : null,
    jenis: tab === "mutasi" ? jenis : null,
    selisih: tab === "opname" ? selisih : null,
    from: isDate(params.from) ? params.from : null,
    to: isDate(params.to) ? params.to : null,
    mine: params.mine === "1",
    page: Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1),
  };
}

// One row of stock_rsbb.history_entry. Mutasi rows fill the mutasi_type ..
// expiry_date columns, opname rows the system_qty .. selisih ones.
type EntryBase = {
  id: string;
  id_inventory: number;
  qr_token: string;
  item_nama: string;
  satuan_jual: string;
  nama_gudang: string | null;
  nama_lokasi: string | null;
  event_date: string; // transaction_date / opname_date
  created_by: string;
  created_at: string;
};

export type MutasiEntry = EntryBase & {
  kind: "mutasi";
  mutasi_type: StockTransactionType;
  quantity: number;
  delta: number; // +quantity for incoming, −quantity for outgoing
  distributor_nama: string | null;
  hospital_unit_nama: string | null;
  batch_number: string | null;
  expiry_date: string | null;
  synced_offline: boolean;
};

export type OpnameEntry = EntryBase & {
  kind: "opname";
  system_qty: number;
  counted_qty: number;
  selisih: number;
};

export type HistoryEntry = MutasiEntry | OpnameEntry;

export type HistoryResult = {
  entries: HistoryEntry[];
  total: number;
  recorders: Record<string, string>; // created_by → name (or email)
  error: { message: string; code?: string } | null;
};

// A PostgREST or() value, quoted so commas or brackets typed in the search
// can't break the filter, with LIKE wildcards escaped to match literally.
function orLike(q: string) {
  const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  return `"${like.replace(/["\\]/g, "\\$&")}"`;
}

// Names of whoever recorded the rows. created_by points at auth.users, so
// this is a second lookup rather than a join. Staff can read the profiles
// of their own inventory's people (RLS); anyone else shows as "—".
async function loadRecorders(supabase: AppSupabaseClient, ids: string[]) {
  const unique = [...new Set(ids)];
  if (!unique.length) return {};
  const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", unique);
  return Object.fromEntries((data ?? []).map((p) => [p.id, p.full_name || p.email]));
}

export async function loadHistory(
  supabase: AppSupabaseClient,
  f: HistoryFilters,
  userId: string,
): Promise<HistoryResult> {
  const from = (f.page - 1) * HISTORY_PAGE_SIZE;
  let query = supabase.from("history_entry").select("*", { count: "exact" });

  if (f.tab !== "semua") query = query.eq("kind", f.tab);
  if (f.q) {
    const v = orLike(f.q);
    query = query.or(`item_nama.ilike.${v},distributor_nama.ilike.${v},hospital_unit_nama.ilike.${v}`);
  }
  if (f.unit) query = query.eq("id_gudang", f.unit);
  if (f.inv) query = query.eq("id_inventory", f.inv);
  if (f.jenis === "masuk" || f.jenis === "keluar") {
    const direction = f.jenis === "masuk" ? "in" : "out";
    query = query.in("mutasi_type", MUTASI_TYPES.filter((t) => t.direction === direction).map((t) => t.value));
  } else if (f.jenis) query = query.eq("mutasi_type", f.jenis);
  if (f.selisih === "ada") query = query.neq("selisih", 0);
  if (f.selisih === "sesuai") query = query.eq("selisih", 0);
  if (f.from) query = query.gte("event_date", f.from);
  if (f.to) query = query.lte("event_date", f.to);
  if (f.mine) query = query.eq("created_by", userId);

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .order("id") // stable order for entries saved in the same instant
    .range(from, from + HISTORY_PAGE_SIZE - 1);
  const entries = (data ?? []) as HistoryEntry[];
  return {
    entries,
    total: count ?? 0,
    recorders: await loadRecorders(supabase, entries.map((e) => e.created_by)),
    error,
  };
}
