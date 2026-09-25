import type { AppSupabaseClient } from "@/lib/supabase/types";
import { todayInAppZone } from "@/lib/dates";

// One opname session per unit per day (see the unique constraint in
// 0001_init.sql). Reuses today's session if a supervisor/staff already
// started one, otherwise starts it.
//
// Requires connectivity — offline-first bootstrap of a brand-new session
// isn't handled yet (TODO), so start today's session at least once while
// online before counting offline.
export async function ensureOpnameSession(
  supabase: AppSupabaseClient,
  idGudang: number,
  userId: string,
) {
  const today = todayInAppZone();

  const { data, error } = await supabase
    .from("opname_session")
    .upsert(
      { id_gudang: idGudang, opname_date: today, created_by: userId },
      { onConflict: "id_gudang,opname_date" },
    )
    .select("id_opname_session")
    .single();

  if (error) throw error;
  return data.id_opname_session as string;
}
