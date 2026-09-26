import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRole } from "@/lib/types";

export type CurrentProfile = {
  full_name: string | null;
  role: ProfileRole | null;
  id_gudang: number | null;
  unit: { nama_gudang: string } | null;
};

// One auth + profile lookup per request, shared by the (app) layout and the
// pages under it (React's cache() is scoped to a single server request).
export const getSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { supabase, user: null, profile: null };

  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, role, id_gudang, unit:id_gudang(nama_gudang)")
    .eq("id", user.id)
    .maybeSingle();

  // First visit: create the user's own profile. It starts with no role, i.e.
  // waiting for a master to approve (see 0004/0005 migrations).
  if (!data && !error) {
    await supabase.from("profiles").insert({ id: user.id });
  }

  return { supabase, user, profile: (data as unknown as CurrentProfile | null) ?? null };
});

export const ROLE_LABELS: Record<ProfileRole, string> = {
  master: "Master",
  manager: "Manajer",
  staff: "Staf",
};
