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

## Structure

- `src/app/login` — email/password login.
- `src/app/scan` — mobile camera scanner (`src/components/scan/QrScanner.tsx`, `html5-qrcode`); on a successful decode, routes to `/i/[token]`.
- `src/app/i/[token]` — the QR-scan landing page: resolves an `Inventory` row by its `qr_token` (from Supabase online, from the Dexie cache offline), then shows either the daily stock-transaction form or the stock-opname count form.
- `src/app/dashboard` — web monitoring: current stock across units.
- `src/app/dashboard/labels` — pick a unit, print its items' QR labels. The QR images are generated in the browser (`src/components/QrLabelGrid.tsx` + `src/lib/qr.ts`), encoding whatever origin the page was opened on.
- `src/lib/types.ts` — TypeScript types mirroring the ERD; keep in sync with the SQL migrations.
- `supabase/migrations/0001_init.sql` — the `stock_rsbb` schema: `item`, `producer`, `unit`, `location`, `inventory`, `stock_transaction`, `opname_session`, `opname_count`, plus a trigger that keeps `inventory.current_qty` in sync with transactions.
- `supabase/migrations/0002_source_ids.sql` — adds `*_source` columns (the original IDs from the unit spreadsheets) so imports are idempotent — see the import script below.
- `scripts/lib/read-source-rows.ts` — shared xlsx-parsing logic for the two import paths below.
- `scripts/import-inventory.ts` (`npm run import:inventory`) — reads both sheets of a unit's template and upserts via the Supabase API: `producer`/`item` come from the fuller "daftar referensi inventories" catalog (so items not currently stocked still exist for later), while `unit`/`location`/`inventory` come only from "daftar inventories" (the unit's actual stocked items — no Inventory row, no QR code, for a catalog item this unit doesn't have). `inventory` rows are inserted once and then left alone on re-run, so it never overwrites live stock once transactions exist.
- `scripts/generate-import-sql.ts` (`npm run generate-import-sql`) — same upsert logic as above, but writes a `.sql` file to run directly in the SQL Editor instead of going through the API. No Supabase credentials needed to generate it.
- `scripts/verify-import.ts` (`npm run verify:import`) — prints row counts per table after either import path.

## Not done yet (scaffold, not a finished app)

- No PWA icons (`public/icon-192.png` / `icon-512.png` referenced in `public/manifest.json` don't exist yet).
- Stock-opname offline queueing is intentionally not implemented: starting a unit's opname session requires connectivity once per day (see the comment in `src/lib/opname.ts`); only daily stock transactions queue fully offline.
- No roles/approval workflow (v1 decision — any authenticated user can post directly).
- No user-signup UI — test users are created directly in the Supabase dashboard for now.
