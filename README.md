# Stock RSBB

Stock transaction + stock opname app. One Next.js PWA for both the mobile
input flow (scan QR → view item → record a count or a movement) and the web
monitoring dashboard. Backend is Supabase (hosted).

Full PRD, ERD and decisions live in the Claude Doc from planning:
https://claude.ai/artifact/KnPDEWNnH3jULDxhCey3iZ

## Stack

- Next.js (App Router) + Tailwind, PWA via Serwist (`src/app/sw.ts`, wired in `next.config.ts`)
- Supabase: Postgres + Auth (`src/lib/supabase/client.ts` for the browser, `server.ts` for server components) — both are pinned to the `stock_rsbb` schema via `db: { schema: "stock_rsbb" }`, so `.from("item")` etc. resolve there instead of `public`
- Offline queue for mobile input: Dexie/IndexedDB (`src/lib/offline/db.ts`), flushed on reconnect (`src/lib/offline/sync.ts`)
- QR: `qrcode` to generate labels (`/dashboard/labels`), `html5-qrcode` for the camera scanner (`/scan`)

## Setup

1. Create a Supabase project, then run everything in `supabase/migrations/` against it, in order (SQL editor, or `supabase db push` once you've `supabase link`ed). Tables live in a `stock_rsbb` schema, not `public`.
2. In the dashboard: **Project Settings → Data API → Exposed schemas**, add `stock_rsbb` (then reload the schema cache). Without this the API can't see the schema even though the migration ran fine.
3. Copy `.env.local.example` to `.env.local` and fill in the project URL + anon key. (The service role key in there is only needed for the import script below, not for running the app.)
4. `npm install`
5. `npm run dev`
6. Create at least one test user: dashboard → **Authentication → Users → Add user** (there's no self-signup flow — see Structure below).
7. Seed real data from a unit's template spreadsheet — two ways to do this, same result:
   - Via the API: `npm run import:inventory -- "D:\template-stock-opname-352.xlsx"` (needs step 2 done and PostgREST to have picked it up).
   - Straight into Postgres, bypassing the API entirely: `npm run generate-import-sql -- "D:\template-stock-opname-352.xlsx" supabase/seed-352.sql`, then paste that file's contents into the SQL Editor and run it. Useful if step 2 is lagging (exposed-schema changes don't always propagate instantly) — the SQL Editor talks directly to Postgres either way.
   - Repeat per unit file; both are safe to re-run on the same file.
   - `npm run verify:import` afterward prints row counts per table plus one sample row, either way.

## Deploying

Production runs on the company VPS (Node + PM2 behind Nginx, HTTPS via Let's Encrypt) at https://stock-rsbb.barokahperkasagroup.com. Step-by-step setup and updates: [DEPLOY.md](DEPLOY.md).

## Structure

- `src/app/login` — email/password login (accounts are created by an admin in Supabase; no sign-up). Redirects to the dashboard if already signed in.
- `src/app/(app)/layout.tsx` — the signed-in app shell: redirects to `/login` without a session, sidebar on desktop, bottom tab bar on phones (`src/components/shell/`).
- `src/app/(app)/scan` — mobile camera scanner (`src/components/scan/QrScanner.tsx`, `html5-qrcode`); on a successful decode, routes to `/i/[token]`.
- `src/app/(app)/i/[token]` — the QR-scan landing page: resolves an `Inventory` row by its `qr_token` (from Supabase online, from the Dexie cache offline), then shows either the daily stock-transaction form or the stock-opname count form.
- `src/app/(app)/dashboard` — summary cards (total items, out of stock, today's mutasi, today's opname variances); each links to the list behind it.
- `src/app/(app)/stok` — Data Stok: the stock table (search, status/inventory filters, paging via URL params).
- `src/app/(app)/dashboard/labels` — pick a unit, print its items' QR labels. The QR images are generated in the browser (`src/components/QrLabelGrid.tsx` + `src/lib/qr.ts`), encoding whatever origin the page was opened on.
- `src/components/ui.tsx` — shared input/button/card/alert styles; theme tokens live in `src/app/globals.css` (light/dark via a `dark` class on `<html>`).
- `src/lib/dates.ts` — the app's time zone (`Asia/Jakarta`), used for "today" in dashboard stats and the day's opname session.
- `src/lib/types.ts` — TypeScript types mirroring the ERD; keep in sync with the SQL migrations.
- `supabase/migrations/0001_init.sql` — the `stock_rsbb` schema: `item`, `producer`, `unit`, `location`, `inventory`, `stock_transaction`, `opname_session`, `opname_count`, plus a trigger that keeps `inventory.current_qty` in sync with transactions.
- `supabase/migrations/0002_source_ids.sql` — adds `*_source` columns (the original IDs from the unit spreadsheets) so imports are idempotent — see the import script below.
- `supabase/migrations/0003_created_by_default.sql` — `created_by` defaults to the signed-in user.
- `supabase/migrations/0005_roles_and_access.sql` — roles and per-inventory access, enforced with RLS: `staff` see and record only their unit (`profiles.id_gudang`), `manager` see everything read-only, `master` see everything and manage users via `set_user_access()`. A profile with no role is waiting for approval and sees nothing. After running it, make the first master in SQL: `update stock_rsbb.profiles set role = 'master' where email = '...'`.
- `src/app/(app)/users` — master-only "Pengguna" page: approve new sign-ins and set each person's name, role and inventory.
- `supabase/migrations/0006_mutasi.sql` — pharmacy Mutasi types (Penerimaan Barang, Retur dari Unit, Pengiriman ke Unit, Retur ke Distributor, Pemusnahan) with per-type required fields enforced by CHECK constraints, plus the `distributor` and `hospital_unit` lists (seeded with `[TEST]` entries).
- `src/app/(app)/input` — the phone home: pick Mutasi or Stock Opname, then scan (`/scan?mode=...` → `/i/[token]?mode=...`). Phones (< 1024px) get only this flow; desktop pages redirect them here (`src/components/shell/DesktopOnly.tsx`).
- `src/app/(app)/riwayat` — history (Riwayat) of every Mutasi and Stock Opname count, newest first, with filters in the URL (`src/lib/history.ts`). Tabs: Semua (both, interleaved by time), Mutasi, Stock Opname; search matches item, distributor and unit names. `?inv=<id_inventory>` is one item's history ("Riwayat item ini" on the item screen). One page, two layouts: phones get a brief list whose rows expand to the details (reached from the `/input` home), desktop gets full tables (sidebar). Mutasi saved offline on this device show above the list until they sync.
- `supabase/migrations/0008_history.sql` — who and when (`created_by`, `created_at`) on `opname_count`, like `stock_transaction` already has, plus indexes for the newest-first lists. Both tables are append-only, so they double as the log.
- `supabase/migrations/0009_history_view.sql` — `history_entry`, one view over both logs (with item, location, distributor and unit names joined in) that Riwayat reads; `security_invoker`, so the tables' RLS still applies.
- `supabase/migrations/0010_unit_inventories.sql` — hospital units hold pharmacy stock too. Every Data Master unit gets its own inventory (`unit.kind = 'unit'`, linked by `hospital_unit.id_gudang`, matched on the hospital's gudang ID; new units get one automatically). Units only do Stock Opname for now (Mutasi is refused on them): they start empty, staff add catalog items as they count them (`add_unit_item()`), an item's first count is its starting stock, and each count after that is compared with the previous one and becomes the unit's stock.
- `src/app/(app)/opname` — where Stock Opname starts: scan a label, or search the inventory's items by name (in a unit, also the pharmacy catalog to add items). Masters pick the inventory; staff count in their own.
- `src/app/(app)/master-data` — master-only: add, rename and deactivate distributors and hospital units, or bulk-import them from an .xlsx/.csv export (**Impor**: pick the name column and, optionally, the hospital system's ID column; preview, then import). Matching logic is in `src/lib/lookup-import.ts`.
- `supabase/migrations/0007_lookup_source_ids.sql` — `source_id` (the hospital system's ID) on distributors and hospital units, so re-importing an updated export renames entries by ID instead of duplicating them; removes the `[TEST]` hospital units.
- `supabase/migrations/0004_profiles.sql` — `profiles` (name, role, home unit per user). Created by the app on a user's first visit rather than by a trigger on `auth.users`, since auth is shared with other apps on this Supabase project; `role` and `id_gudang` are admin-only.
- `scripts/lib/read-source-rows.ts` — shared xlsx-parsing logic for the two import paths below.
- `scripts/import-inventory.ts` (`npm run import:inventory`) — reads both sheets of a unit's template and upserts via the Supabase API: `producer`/`item` come from the fuller "daftar referensi inventories" catalog (so items not currently stocked still exist for later), while `unit`/`location`/`inventory` come only from "daftar inventories" (the unit's actual stocked items — no Inventory row, no QR code, for a catalog item this unit doesn't have). `inventory` rows are inserted once and then left alone on re-run, so it never overwrites live stock once transactions exist.
- `scripts/generate-import-sql.ts` (`npm run generate-import-sql`) — same upsert logic as above, but writes a `.sql` file to run directly in the SQL Editor instead of going through the API. No Supabase credentials needed to generate it.
- `scripts/verify-import.ts` (`npm run verify:import`) — prints row counts per table after either import path.

## Not done yet (scaffold, not a finished app)

- Stock-opname offline queueing is intentionally not implemented: starting a unit's opname session requires connectivity once per day (see the comment in `src/lib/opname.ts`); only daily stock transactions queue fully offline.
- No roles/approval workflow (v1 decision — any authenticated user can post directly).
- No user-signup UI — test users are created directly in the Supabase dashboard for now.
