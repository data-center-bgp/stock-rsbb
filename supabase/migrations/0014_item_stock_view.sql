-- Data Stok > Semua Stok: one row per item with its stock summed over every
-- inventory that holds it, split into pharmacy inventories and hospital
-- units. The per-inventory breakdown is read from `inventory` itself.
--
-- security_invoker: runs with the caller's rights, so the inventory/item RLS
-- still decides what each person can see (master and manager: everything).

create view stock_rsbb.item_stock with (security_invoker = true) as
select
  i.id_barang,
  i.nama as item_nama,
  i.satuan_jual,
  coalesce(sum(inv.current_qty), 0)::integer as total_qty,
  coalesce(sum(inv.current_qty) filter (where u.kind = 'farmasi'), 0)::integer as farmasi_qty,
  coalesce(sum(inv.current_qty) filter (where u.kind = 'unit'), 0)::integer as unit_qty,
  (count(*) filter (where u.kind = 'unit'))::integer as unit_count
from stock_rsbb.item i
join stock_rsbb.inventory inv on inv.id_barang = i.id_barang
join stock_rsbb.unit u on u.id_gudang = inv.id_gudang
group by i.id_barang, i.nama, i.satuan_jual;

grant select on stock_rsbb.item_stock to authenticated, service_role;

notify pgrst, 'reload schema';
