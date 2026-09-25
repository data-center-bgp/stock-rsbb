import type { SupabaseClient } from "@supabase/supabase-js";

// No generated Database type yet (see README), and the client is pinned to
// the "stock_rsbb" schema rather than the default "public" one, so a plain
// `SupabaseClient` doesn't line up — this is the shared, loosely-typed
// stand-in used anywhere a Supabase client is passed around.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AppSupabaseClient = SupabaseClient<any, any, any>;
