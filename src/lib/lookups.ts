import { createClient } from "@/lib/supabase/client";
import { offlineDb } from "@/lib/offline/db";
import type { Distributor, HospitalUnit } from "@/lib/types";

export type Lookups = { distributors: Distributor[]; units: HospitalUnit[] };

const byName = <T extends { nama: string }>(a: T, b: T) => a.nama.localeCompare(b.nama, "id");

// Active distributors and hospital units for the Mutasi form. Refreshed from
// Supabase when online (and cached), read from the cache when offline.
export async function loadLookups(): Promise<Lookups> {
  if (navigator.onLine) {
    try {
      const supabase = createClient();
      const [d, u] = await Promise.all([
        supabase.from("distributor").select("id_distributor, nama, is_active").eq("is_active", true),
        supabase.from("hospital_unit").select("id_hospital_unit, nama, is_active").eq("is_active", true),
      ]);
      if (!d.error && !u.error) {
        const distributors = (d.data as Distributor[]).sort(byName);
        const units = (u.data as HospitalUnit[]).sort(byName);
        await offlineDb.transaction("rw", offlineDb.distributors, offlineDb.hospitalUnits, async () => {
          await offlineDb.distributors.clear();
          await offlineDb.distributors.bulkPut(distributors);
          await offlineDb.hospitalUnits.clear();
          await offlineDb.hospitalUnits.bulkPut(units);
        });
        return { distributors, units };
      }
    } catch {
      // Network hiccup mid-request — fall through to the cache.
    }
  }

  const [distributors, units] = await Promise.all([offlineDb.distributors.toArray(), offlineDb.hospitalUnits.toArray()]);
  return { distributors: distributors.sort(byName), units: units.sort(byName) };
}
