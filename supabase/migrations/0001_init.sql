-- Initial schema, matching the ERD in the PRD doc.
-- v1: no roles/approval workflow — any authenticated user can write.
--
-- Everything lives in its own `stock_rsbb` schema instead of `public`, so it
-- stays clearly separated from Supabase-managed schemas (auth, storage, ...)
-- and from anything else that ends up in this project later.
--
-- IMPORTANT — after running this migration, `stock_rsbb` also needs to be
-- added to Supabase's exposed schemas before the client can query it:
-- Project Settings -> Data API -> "Exposed schemas" -> add `stock_rsbb`,
-- then reload the schema cache. This is a dashboard/project setting, not
-- something a SQL migration can do.

create schema if not exists stock_rsbb;

create table stock_rsbb.producer (
  id_produsen bigint generated always as identity primary key,
  nama text not null
);

create table stock_rsbb.item (
  id_barang bigint generated always as identity primary key,
  nama text not null,
  id_produsen bigint not null references stock_rsbb.producer (id_produsen),
  satuan_jual text not null
);

create table stock_rsbb.unit (
  id_gudang bigint generated always as identity primary key,
  nama_gudang text not null
);

create table stock_rsbb.location (
  id_lokasi bigint generated always as identity primary key,
  id_gudang bigint not null references stock_rsbb.unit (id_gudang),
  nama_lokasi text not null
);

create table stock_rsbb.inventory (
  id_inventory bigint generated always as identity primary key,
  id_barang bigint not null references stock_rsbb.item (id_barang),
  id_gudang bigint not null references stock_rsbb.unit (id_gudang),
  id_lokasi bigint not null references stock_rsbb.location (id_lokasi),
  qr_token uuid not null default gen_random_uuid() unique,
  harga_pokok_jual numeric(14, 2) not null default 0,
  harga_pokok numeric(14, 2) not null default 0,
  quantity_awal integer not null default 0,
  current_qty integer not null default 0,
  created_at timestamptz not null default now()
);

create type stock_rsbb.stock_transaction_type as enum (
  'in_procurement',
  'in_return',
  'in_transfer',
  'out_transfer',
  'out_other'
);

create table stock_rsbb.stock_transaction (
  id_transaction uuid primary key default gen_random_uuid(),
  id_inventory bigint not null references stock_rsbb.inventory (id_inventory),
  type stock_rsbb.stock_transaction_type not null,
  quantity integer not null check (quantity > 0),
  transfer_group_id uuid,
  note text,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  synced_offline boolean not null default false
);

create type stock_rsbb.opname_session_status as enum ('in_progress', 'completed');

create table stock_rsbb.opname_session (
  id_opname_session uuid primary key default gen_random_uuid(),
  id_gudang bigint not null references stock_rsbb.unit (id_gudang),
  opname_date date not null default current_date,
  status stock_rsbb.opname_session_status not null default 'in_progress',
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  -- one opname session per unit per day; the app upserts on this to
  -- reuse today's session instead of creating duplicates
  unique (id_gudang, opname_date)
);

create table stock_rsbb.opname_count (
  id_opname_count uuid primary key default gen_random_uuid(),
  id_opname_session uuid not null references stock_rsbb.opname_session (id_opname_session),
  id_inventory bigint not null references stock_rsbb.inventory (id_inventory),
  system_qty_snapshot integer not null,
  counted_qty integer not null,
  selisih integer generated always as (counted_qty - system_qty_snapshot) stored
);

-- Keep inventory.current_qty in sync with stock_transaction inserts, so the
-- app never has to sum transaction history on every read.
-- `set search_path = stock_rsbb, pg_temp` makes the function's own table
-- references resolve correctly regardless of the calling session's search_path.
create function stock_rsbb.apply_stock_transaction() returns trigger
language plpgsql
set search_path = stock_rsbb, pg_temp
as $$
declare
  delta integer;
begin
  delta := case
    when new.type in ('in_procurement', 'in_return', 'in_transfer') then new.quantity
    else -new.quantity
  end;

  update inventory
  set current_qty = current_qty + delta
  where id_inventory = new.id_inventory;

  return new;
end;
$$;

create trigger trg_apply_stock_transaction
  after insert on stock_rsbb.stock_transaction
  for each row execute function stock_rsbb.apply_stock_transaction();

-- Seed current_qty from quantity_awal whenever a new inventory row is created.
create function stock_rsbb.seed_current_qty() returns trigger
language plpgsql
set search_path = stock_rsbb, pg_temp
as $$
begin
  new.current_qty := new.quantity_awal;
  return new;
end;
$$;

create trigger trg_seed_current_qty
  before insert on stock_rsbb.inventory
  for each row execute function stock_rsbb.seed_current_qty();

-- RLS: any authenticated user can read/write, per the v1 "no approval workflow" decision.
-- Tighten this per-unit once roles are introduced (see PRD Open Questions).
alter table stock_rsbb.item enable row level security;
alter table stock_rsbb.producer enable row level security;
alter table stock_rsbb.unit enable row level security;
alter table stock_rsbb.location enable row level security;
alter table stock_rsbb.inventory enable row level security;
alter table stock_rsbb.stock_transaction enable row level security;
alter table stock_rsbb.opname_session enable row level security;
alter table stock_rsbb.opname_count enable row level security;

create policy "authenticated read/write" on stock_rsbb.item for all to authenticated using (true) with check (true);
create policy "authenticated read/write" on stock_rsbb.producer for all to authenticated using (true) with check (true);
create policy "authenticated read/write" on stock_rsbb.unit for all to authenticated using (true) with check (true);
create policy "authenticated read/write" on stock_rsbb.location for all to authenticated using (true) with check (true);
create policy "authenticated read/write" on stock_rsbb.inventory for all to authenticated using (true) with check (true);
create policy "authenticated read/write" on stock_rsbb.stock_transaction for all to authenticated using (true) with check (true);
create policy "authenticated read/write" on stock_rsbb.opname_session for all to authenticated using (true) with check (true);
create policy "authenticated read/write" on stock_rsbb.opname_count for all to authenticated using (true) with check (true);

-- A custom schema isn't reachable by Supabase's API roles by default —
-- RLS alone isn't enough, the roles also need USAGE on the schema and
-- privileges on its objects (RLS then still governs row-level access).
grant usage on schema stock_rsbb to authenticated, service_role;

grant all on all tables in schema stock_rsbb to authenticated, service_role;
grant all on all sequences in schema stock_rsbb to authenticated, service_role;
grant execute on all functions in schema stock_rsbb to authenticated, service_role;

alter default privileges in schema stock_rsbb
  grant all on tables to authenticated, service_role;
alter default privileges in schema stock_rsbb
  grant all on sequences to authenticated, service_role;
alter default privileges in schema stock_rsbb
  grant execute on functions to authenticated, service_role;
