-- Fix for 0010: add_unit_item's access check let callers with no role
-- through. For an unapproved account my_role() is NULL, the whole condition
-- became NULL, and `if NULL then raise` doesn't raise. Now anything but
-- "master, or staff of this inventory" is refused.

create or replace function stock_rsbb.add_unit_item(p_id_gudang bigint, p_id_barang bigint)
returns table (id_inventory bigint, qr_token uuid)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_kind text;
  v_lokasi bigint;
begin
  if not coalesce(
    stock_rsbb.my_role() = 'master'
      or (stock_rsbb.my_role() = 'staff' and stock_rsbb.my_staff_unit() = p_id_gudang),
    false
  ) then
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

notify pgrst, 'reload schema';
