-- Mutasi for hospital units (needs 0012 to have run first).
--
-- A unit's stock now moves three ways besides Stock Opname:
--   - Pemakaian: unit staff record each use (out_usage), one at a time or in bulk.
--   - Penerimaan dari Farmasi: when the pharmacy records "Pengiriman ke Unit"
--     for a hospital unit, the unit's stock rises by the same amount (the item
--     is added to the unit if it's new there).
--   - Retur ke Farmasi: when the pharmacy records "Retur dari Unit", the unit's
--     stock falls by the same amount. Unit staff only see it; refused if the
--     unit doesn't hold that much.
-- The unit-side rows are written by a trigger, linked to the pharmacy's row
-- through transfer_group_id, so the two sides can't drift apart.

-- 1. current_qty and history know the new incoming type ------------------------

create or replace function stock_rsbb.apply_stock_transaction() returns trigger
language plpgsql
security definer
set search_path = stock_rsbb, pg_temp
as $$
declare
  delta integer;
begin
  delta := case
    when new.type in ('in_receipt', 'in_unit_return', 'in_pharmacy_delivery') then new.quantity
    else -new.quantity
  end;

  update inventory
  set current_qty = current_qty + delta
  where id_inventory = new.id_inventory;

  return new;
end;
$$;

create or replace view stock_rsbb.history_entry with (security_invoker = true) as
select
  'mutasi'::text as kind,
  t.id_transaction as id,
  t.id_inventory,
  inv.id_gudang,
  inv.qr_token,
  i.nama as item_nama,
  i.satuan_jual,
  u.nama_gudang,
  l.nama_lokasi,
  t.transaction_date as event_date,
  t.type::text as mutasi_type,
  t.quantity,
  case when t.type in ('in_receipt', 'in_unit_return', 'in_pharmacy_delivery') then t.quantity else -t.quantity end as delta,
  null::integer as system_qty,
  null::integer as counted_qty,
  null::integer as selisih,
  d.nama as distributor_nama,
  h.nama as hospital_unit_nama,
  t.batch_number,
  t.expiry_date,
  t.synced_offline,
  t.created_by,
  t.created_at
from stock_rsbb.stock_transaction t
join stock_rsbb.inventory inv on inv.id_inventory = t.id_inventory
join stock_rsbb.item i on i.id_barang = inv.id_barang
left join stock_rsbb.unit u on u.id_gudang = inv.id_gudang
left join stock_rsbb.location l on l.id_lokasi = inv.id_lokasi
left join stock_rsbb.distributor d on d.id_distributor = t.id_distributor
left join stock_rsbb.hospital_unit h on h.id_hospital_unit = t.id_hospital_unit

union all

select
  'opname'::text,
  c.id_opname_count,
  c.id_inventory,
  inv.id_gudang,
  inv.qr_token,
  i.nama,
  i.satuan_jual,
  u.nama_gudang,
  l.nama_lokasi,
  s.opname_date,
  null,
  null,
  null,
  c.system_qty_snapshot,
  c.counted_qty,
  c.selisih,
  null,
  null,
  null,
  null,
  false,
  c.created_by,
  c.created_at
from stock_rsbb.opname_count c
join stock_rsbb.opname_session s on s.id_opname_session = c.id_opname_session
join stock_rsbb.inventory inv on inv.id_inventory = c.id_inventory
join stock_rsbb.item i on i.id_barang = inv.id_barang
left join stock_rsbb.unit u on u.id_gudang = inv.id_gudang
left join stock_rsbb.location l on l.id_lokasi = inv.id_lokasi;

-- 2. Who may record what ---------------------------------------------------------
-- Pharmacy inventories: the five pharmacy types. Unit inventories: Pemakaian
-- only. The two pharmacy-linked unit types are never recorded by hand; the
-- trigger in section 4 writes them past this policy.

drop policy "record transactions" on stock_rsbb.stock_transaction;
create policy "record transactions" on stock_rsbb.stock_transaction for insert to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from stock_rsbb.inventory inv
      join stock_rsbb.unit u on u.id_gudang = inv.id_gudang
      where inv.id_inventory = stock_transaction.id_inventory
        and (
          (u.kind = 'farmasi' and stock_transaction.type in
            ('in_receipt', 'in_unit_return', 'out_unit_delivery', 'out_distributor_return', 'out_disposal'))
          or (u.kind = 'unit' and stock_transaction.type = 'out_usage')
        )
        and ((select stock_rsbb.my_role()) = 'master' or inv.id_gudang = (select stock_rsbb.my_staff_unit()))
    )
  );

-- 3. A unit can't use or return more than it holds ---------------------------------

create function stock_rsbb.guard_unit_stock() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_nama text;
  v_qty integer;
begin
  select u.nama_gudang, inv.current_qty into v_nama, v_qty
  from stock_rsbb.inventory inv join stock_rsbb.unit u on u.id_gudang = inv.id_gudang
  where inv.id_inventory = new.id_inventory
  for update of inv;

  if new.quantity > v_qty then
    raise exception 'Jumlah melebihi stok di % (% tersedia). Minta unit melakukan stock opname jika stok fisik berbeda.', v_nama, v_qty;
  end if;
  return new;
end;
$$;

create trigger trg_guard_unit_stock
  before insert on stock_rsbb.stock_transaction
  for each row
  when (new.type in ('out_usage', 'out_pharmacy_return'))
  execute function stock_rsbb.guard_unit_stock();

-- 4. Pharmacy deliveries and returns move the unit's stock too ----------------------

create function stock_rsbb.mirror_unit_transaction() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_gudang bigint;
  v_kind text;
  v_nama text;
  v_barang bigint;
  v_inv bigint;
  v_lokasi bigint;
begin
  select h.id_gudang into v_gudang from stock_rsbb.hospital_unit h where h.id_hospital_unit = new.id_hospital_unit;
  select u.kind, u.nama_gudang into v_kind, v_nama from stock_rsbb.unit u where u.id_gudang = v_gudang;
  -- Not a hospital unit with its own inventory: nothing to mirror.
  if v_kind is distinct from 'unit' then
    return new;
  end if;

  select inv.id_barang into v_barang from stock_rsbb.inventory inv where inv.id_inventory = new.id_inventory;
  select inv.id_inventory into v_inv from stock_rsbb.inventory inv
  where inv.id_gudang = v_gudang and inv.id_barang = v_barang
  limit 1;

  if v_inv is null then
    if new.type = 'in_unit_return' then
      raise exception 'Item ini belum tercatat di stok %. Minta unit melakukan stock opname dulu.', v_nama;
    end if;
    -- First delivery of this item to the unit: it joins the unit's inventory.
    select l.id_lokasi into v_lokasi from stock_rsbb.location l where l.id_gudang = v_gudang order by l.id_lokasi limit 1;
    if v_lokasi is null then
      insert into stock_rsbb.location (id_gudang, nama_lokasi) values (v_gudang, v_nama) returning id_lokasi into v_lokasi;
    end if;
    insert into stock_rsbb.inventory (id_barang, id_gudang, id_lokasi) values (v_barang, v_gudang, v_lokasi)
    returning id_inventory into v_inv;
  end if;

  insert into stock_rsbb.stock_transaction
    (id_inventory, type, quantity, transaction_date, transfer_group_id, created_by, created_at, synced_offline)
  values (
    v_inv,
    (case new.type when 'out_unit_delivery' then 'in_pharmacy_delivery' else 'out_pharmacy_return' end)::stock_rsbb.stock_transaction_type,
    new.quantity, new.transaction_date, new.id_transaction, new.created_by, new.created_at, new.synced_offline
  );
  return new;
end;
$$;

create trigger trg_mirror_unit_transaction
  after insert on stock_rsbb.stock_transaction
  for each row
  when (new.type in ('out_unit_delivery', 'in_unit_return'))
  execute function stock_rsbb.mirror_unit_transaction();

revoke execute on function stock_rsbb.guard_unit_stock() from public, anon, authenticated;
revoke execute on function stock_rsbb.mirror_unit_transaction() from public, anon, authenticated;

-- 5. A unit's first count is the starting stock only if nothing else has moved it ----
-- Once the pharmacy has delivered an item (or it has been used), the system
-- knows the stock, so a count is compared with it.

create or replace function stock_rsbb.unit_opname_snapshot() returns trigger
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
    new.system_qty_snapshot := case
      when exists (select 1 from stock_rsbb.opname_count c where c.id_inventory = new.id_inventory)
        or exists (select 1 from stock_rsbb.stock_transaction t where t.id_inventory = new.id_inventory)
      then v_qty
      else new.counted_qty
    end;
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';
