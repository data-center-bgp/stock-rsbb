-- Pharmacy "Mutasi": the five ways stock moves, each with its own required
-- details, plus the distributor and hospital-unit lists they refer to.
--
--   masuk  : in_receipt             Penerimaan Barang     distributor, batch, expiry
--            in_unit_return         Retur dari Unit       hospital unit
--   keluar : out_unit_delivery      Pengiriman ke Unit    hospital unit
--            out_distributor_return Retur ke Distributor  distributor, batch, expiry
--            out_disposal           Pemusnahan            (date + quantity only)
--
-- "Unit" here means a hospital unit (IGD, ICU, ...) — not stock_rsbb.unit,
-- which is an inventory (gudang) and is labelled "Inventori" in the app.

-- 1. Lookup lists -------------------------------------------------------------

create table stock_rsbb.distributor (
  id_distributor bigint generated always as identity primary key,
  nama text not null check (btrim(nama) <> ''),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index distributor_nama_uniq on stock_rsbb.distributor (lower(btrim(nama)));

create table stock_rsbb.hospital_unit (
  id_hospital_unit bigint generated always as identity primary key,
  nama text not null check (btrim(nama) <> ''),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index hospital_unit_nama_uniq on stock_rsbb.hospital_unit (lower(btrim(nama)));

alter table stock_rsbb.distributor enable row level security;
alter table stock_rsbb.hospital_unit enable row level security;

-- Any approved user can read them (for the Mutasi dropdowns); only a master
-- edits them. Entries are deactivated rather than deleted, since
-- transactions keep referring to them.
create policy "read distributors" on stock_rsbb.distributor for select to authenticated
  using ((select stock_rsbb.my_role()) is not null);
create policy "master manages distributors" on stock_rsbb.distributor for all to authenticated
  using ((select stock_rsbb.my_role()) = 'master') with check ((select stock_rsbb.my_role()) = 'master');

create policy "read hospital units" on stock_rsbb.hospital_unit for select to authenticated
  using ((select stock_rsbb.my_role()) is not null);
create policy "master manages hospital units" on stock_rsbb.hospital_unit for all to authenticated
  using ((select stock_rsbb.my_role()) = 'master') with check ((select stock_rsbb.my_role()) = 'master');

-- Placeholders so every Mutasi type can be tested before the real lists are
-- loaded. Deactivate or delete them once the real data is in.
insert into stock_rsbb.distributor (nama) values
  ('[TEST] PT Distributor Contoh A'),
  ('[TEST] PT Distributor Contoh B');
insert into stock_rsbb.hospital_unit (nama) values
  ('[TEST] IGD'),
  ('[TEST] Rawat Inap'),
  ('[TEST] ICU');

-- 2. New transaction types -----------------------------------------------------
-- No transactions exist yet, so the old enum can simply be swapped out.

alter type stock_rsbb.stock_transaction_type rename to stock_transaction_type_old;
create type stock_rsbb.stock_transaction_type as enum (
  'in_receipt',
  'in_unit_return',
  'out_unit_delivery',
  'out_distributor_return',
  'out_disposal'
);
alter table stock_rsbb.stock_transaction
  alter column type type stock_rsbb.stock_transaction_type
  using type::text::stock_rsbb.stock_transaction_type;
drop type stock_rsbb.stock_transaction_type_old;

-- 3. Per-type details on the transaction ---------------------------------------

alter table stock_rsbb.stock_transaction
  -- The business date staff enter (Tanggal Penerimaan / Pengiriman / ...),
  -- as opposed to created_at, which is when it was recorded.
  add column transaction_date date not null default (now() at time zone 'Asia/Jakarta')::date,
  add column id_distributor bigint references stock_rsbb.distributor (id_distributor),
  add column id_hospital_unit bigint references stock_rsbb.hospital_unit (id_hospital_unit),
  add column batch_number text,
  add column expiry_date date,
  -- Distributor types need distributor + batch + expiry; nothing else may carry them.
  add constraint stock_transaction_distributor_fields check (
    case
      when type in ('in_receipt', 'out_distributor_return') then
        id_distributor is not null and nullif(btrim(batch_number), '') is not null and expiry_date is not null
      else
        id_distributor is null and batch_number is null and expiry_date is null
    end
  ),
  -- Unit types need a hospital unit; nothing else may carry one.
  add constraint stock_transaction_unit_fields check (
    case
      when type in ('in_unit_return', 'out_unit_delivery') then id_hospital_unit is not null
      else id_hospital_unit is null
    end
  );

-- 4. Keep current_qty in sync with the new type names ---------------------------
-- (create or replace resets the definition, so security definer is restated.)

create or replace function stock_rsbb.apply_stock_transaction() returns trigger
language plpgsql
security definer
set search_path = stock_rsbb, pg_temp
as $$
declare
  delta integer;
begin
  delta := case
    when new.type in ('in_receipt', 'in_unit_return') then new.quantity
    else -new.quantity
  end;

  update inventory
  set current_qty = current_qty + delta
  where id_inventory = new.id_inventory;

  return new;
end;
$$;

notify pgrst, 'reload schema';
