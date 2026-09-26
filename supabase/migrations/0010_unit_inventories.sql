-- Hospital units (UGD, ICU, Poli ...) hold pharmacy stock too, and count it.
--
-- Each hospital unit (Data Master) gets its own inventory (stock_rsbb.unit,
-- a "gudang"), matched on the hospital system's gudang ID, so unit staff are
-- assigned and scoped exactly like pharmacy staff. For now units only do
-- Stock Opname:
--   - they start empty; staff add items from the pharmacy catalog as they
--     count them (add_unit_item)
--   - an item's first count is its starting stock (no selisih); later counts
--     are compared with the previous one, and the unit's stock follows the
--     latest count
--   - Mutasi stays pharmacy-only (enforced below)

-- 1. Which kind of inventory ------------------------------------------------

alter table stock_rsbb.unit
  add column kind text not null default 'farmasi' check (kind in ('farmasi', 'unit'));
comment on column stock_rsbb.unit.kind is
  'farmasi: pharmacy inventory (Mutasi + Opname). unit: a hospital unit''s own stock (Opname only for now).';

-- 2. A hospital unit's inventory ---------------------------------------------

alter table stock_rsbb.hospital_unit
  add column id_gudang bigint unique references stock_rsbb.unit (id_gudang);

-- The unit's inventory: the existing gudang with the same hospital ID if
-- there is one, otherwise a new one with a single location named after it.
create function stock_rsbb.unit_gudang_for(p_nama text, p_source_id text) returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  v_source integer := case when p_source_id ~ '^\d{1,9}$' then p_source_id::integer end;
  v_gudang bigint;
begin
  if v_source is not null then
    select id_gudang into v_gudang from stock_rsbb.unit where id_gudang_source = v_source;
  end if;
  if v_gudang is null then
    insert into stock_rsbb.unit (nama_gudang, id_gudang_source, kind)
    values (p_nama, v_source, 'unit')
    returning id_gudang into v_gudang;
    insert into stock_rsbb.location (id_gudang, nama_lokasi) values (v_gudang, p_nama);
  end if;
  return v_gudang;
end;
$$;

create function stock_rsbb.link_hospital_unit() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.id_gudang := coalesce(new.id_gudang, stock_rsbb.unit_gudang_for(new.nama, new.source_id));
  elsif new.nama is distinct from old.nama then
    -- Renamed in Data Master: rename its inventory too (units only).
    update stock_rsbb.unit set nama_gudang = new.nama where id_gudang = new.id_gudang and kind = 'unit';
  end if;
  return new;
end;
$$;

create trigger trg_link_hospital_unit
  before insert or update of nama on stock_rsbb.hospital_unit
  for each row execute function stock_rsbb.link_hospital_unit();

-- The 35 units already imported.
update stock_rsbb.hospital_unit
set id_gudang = stock_rsbb.unit_gudang_for(nama, source_id)
where id_gudang is null;

-- 3. Unit staff can browse the catalog --------------------------------------
-- To add items they hold. (Only the pharmacy catalog exists so far.)

create function stock_rsbb.my_unit_kind() returns text
language sql stable security definer set search_path = ''
as $$
  select u.kind from stock_rsbb.unit u where u.id_gudang = stock_rsbb.my_staff_unit()
$$;

drop policy "read items" on stock_rsbb.item;
create policy "read items" on stock_rsbb.item for select to authenticated
  using (
    (select stock_rsbb.my_role()) in ('master', 'manager')
    or (select stock_rsbb.my_unit_kind()) = 'unit'
    or exists (
      select 1 from stock_rsbb.inventory inv
      where inv.id_barang = item.id_barang and inv.id_gudang = (select stock_rsbb.my_staff_unit())
    )
  );

-- Add a catalog item to a unit's inventory (or return it if already there).
-- Staff can't insert inventory rows directly, hence security definer.
create function stock_rsbb.add_unit_item(p_id_gudang bigint, p_id_barang bigint)
returns table (id_inventory bigint, qr_token uuid)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_kind text;
  v_lokasi bigint;
begin
  if not (stock_rsbb.my_role() = 'master' or (stock_rsbb.my_role() = 'staff' and stock_rsbb.my_staff_unit() = p_id_gudang)) then
    raise exception 'Tidak ada akses ke inventori ini.' using errcode = '42501';
  end if;
  select u.kind into v_kind from stock_rsbb.unit u where u.id_gudang = p_id_gudang;
  if v_kind is distinct from 'unit' then
    raise exception 'Item hanya dapat ditambahkan ke inventori unit.' using errcode = '22023';
  end if;
  if not exists (select 1 from stock_rsbb.item it where it.id_barang = p_id_barang) then
    raise exception 'Item tidak ditemukan di katalog.' using errcode = 'P0002';
  end if;

  return query
    select inv.id_inventory, inv.qr_token from stock_rsbb.inventory inv
    where inv.id_gudang = p_id_gudang and inv.id_barang = p_id_barang
    limit 1;
  if found then
    return;
  end if;

  select l.id_lokasi into v_lokasi from stock_rsbb.location l where l.id_gudang = p_id_gudang order by l.id_lokasi limit 1;
  if v_lokasi is null then
    insert into stock_rsbb.location (id_gudang, nama_lokasi)
    select p_id_gudang, u.nama_gudang from stock_rsbb.unit u where u.id_gudang = p_id_gudang
    returning id_lokasi into v_lokasi;
  end if;

  return query
    insert into stock_rsbb.inventory (id_barang, id_gudang, id_lokasi)
    values (p_id_barang, p_id_gudang, v_lokasi)
    returning inventory.id_inventory, inventory.qr_token;
end;
$$;

revoke execute on function stock_rsbb.add_unit_item(bigint, bigint) from public, anon;
revoke execute on function stock_rsbb.unit_gudang_for(text, text) from public, anon, authenticated;

-- 4. Unit counts: first count = starting stock, stock follows the count -----

create function stock_rsbb.unit_opname_snapshot() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_kind text;
  v_qty integer;
begin
  select u.kind, inv.current_qty into v_kind, v_qty
  from stock_rsbb.inventory inv join stock_rsbb.unit u on u.id_gudang = inv.id_gudang
  where inv.id_inventory = new.id_inventory;

  if v_kind = 'unit' then
    -- Compared with the stock as the database knows it, not what the phone
    -- last saw; an item never counted before has nothing to compare with.
    new.system_qty_snapshot := case
      when exists (select 1 from stock_rsbb.opname_count c where c.id_inventory = new.id_inventory) then v_qty
      else new.counted_qty
    end;
  end if;
  return new;
end;
$$;

create trigger trg_unit_opname_snapshot
  before insert on stock_rsbb.opname_count
  for each row execute function stock_rsbb.unit_opname_snapshot();

create function stock_rsbb.unit_opname_apply() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update stock_rsbb.inventory inv
  set current_qty = new.counted_qty
  from stock_rsbb.unit u
  where inv.id_inventory = new.id_inventory and u.id_gudang = inv.id_gudang and u.kind = 'unit';
  return new;
end;
$$;

create trigger trg_unit_opname_apply
  after insert on stock_rsbb.opname_count
  for each row execute function stock_rsbb.unit_opname_apply();

-- 5. Mutasi stays pharmacy-only -----------------------------------------------

drop policy "record transactions" on stock_rsbb.stock_transaction;
create policy "record transactions" on stock_rsbb.stock_transaction for insert to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from stock_rsbb.inventory inv
      join stock_rsbb.unit u on u.id_gudang = inv.id_gudang
      where inv.id_inventory = stock_transaction.id_inventory
        and u.kind = 'farmasi'
        and ((select stock_rsbb.my_role()) = 'master' or inv.id_gudang = (select stock_rsbb.my_staff_unit()))
    )
  );

notify pgrst, 'reload schema';
