-- One timeline of everything that happened to stock: Mutasi and Stock
-- Opname counts side by side, so an item's history can be read (and paged)
-- as a single list. Names are joined in, which also makes the history
-- searchable by distributor and unit name.
--
-- security_invoker: the view runs with the caller's rights, so the RLS on
-- stock_transaction / opname_count / inventory still decides what each
-- person sees (staff: their inventory; manager and master: everything).

create view stock_rsbb.history_entry with (security_invoker = true) as
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
  case when t.type in ('in_receipt', 'in_unit_return') then t.quantity else -t.quantity end as delta,
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

grant select on stock_rsbb.history_entry to authenticated, service_role;

notify pgrst, 'reload schema';
