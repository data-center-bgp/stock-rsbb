-- Source IDs for the distributor and hospital-unit lists, so a list exported
-- from the hospital system can be re-imported: rows with a known source ID
-- are matched (and renamed if the name changed) instead of added again.
-- Text rather than a number, in case a list comes with codes like "D-012".

alter table stock_rsbb.distributor add column source_id text check (btrim(source_id) <> '');
alter table stock_rsbb.hospital_unit add column source_id text check (btrim(source_id) <> '');

create unique index distributor_source_id_uniq on stock_rsbb.distributor (source_id);
create unique index hospital_unit_source_id_uniq on stock_rsbb.hospital_unit (source_id);

-- The real unit list is being imported, so the [TEST] units from 0006 go:
-- deleted if nothing used them, deactivated if a test mutasi did.
delete from stock_rsbb.hospital_unit h
where h.nama like '[TEST]%'
  and not exists (select 1 from stock_rsbb.stock_transaction t where t.id_hospital_unit = h.id_hospital_unit);
update stock_rsbb.hospital_unit set is_active = false where nama like '[TEST]%';

notify pgrst, 'reload schema';
