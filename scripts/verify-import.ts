// Prints row counts per table plus one sample inventory row — a quick
// sanity check after running import-inventory.ts or a generated
// seed-*.sql file in the SQL Editor.
//
// Usage: npm run verify:import

import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (.env.local).");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, { db: { schema: "stock_rsbb" } });

  for (const table of ["producer", "item", "unit", "location", "inventory"]) {
    const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
    if (error) {
      console.error(`${table}: ERROR`, JSON.stringify(error, null, 2));
    } else {
      console.log(`${table}: ${count} rows`);
    }
  }

  const { data: sample } = await supabase
    .from("inventory")
    .select("id_inventory, qr_token, item:id_barang(nama)")
    .limit(1)
    .maybeSingle();
  console.log("sample inventory row:", sample);
}

main();
