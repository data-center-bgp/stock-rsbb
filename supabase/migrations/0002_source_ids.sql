-- Tracks the original IDs from the source spreadsheets (ID Produsen, ID
-- Barang, ID Gudang, ID Lokasi penyimpanan, ID Inventory), so the import
-- script can upsert instead of blindly inserting. Without this, importing
-- the same unit twice — or importing two units that share a producer/item
-- from the shared catalog — would create duplicate rows.
--
-- Location IDs are only assumed unique *within* a unit (not globally), so
-- that one is a composite unique constraint on (id_gudang, id_lokasi_source)
-- rather than a plain unique column.

alter table stock_rsbb.producer
  add column id_produsen_source integer unique;

alter table stock_rsbb.item
  add column id_barang_source integer unique;

alter table stock_rsbb.unit
  add column id_gudang_source integer unique;

alter table stock_rsbb.location
  add column id_lokasi_source integer,
  add constraint location_unit_source_uniq unique (id_gudang, id_lokasi_source);

alter table stock_rsbb.inventory
  add column id_inventory_source integer unique;
