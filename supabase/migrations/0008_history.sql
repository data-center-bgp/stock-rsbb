-- History (Riwayat) for Mutasi and Stock Opname.
--
-- stock_transaction already is the Mutasi log: append-only (no update or
-- delete policy), with who (created_by) and when (created_at). opname_count
-- only had its session's date, so it gets the same two columns. A recount
-- of an item adds a row rather than overwriting, so every count stays.

alter table stock_rsbb.opname_count
  add column created_by uuid references auth.users (id) default auth.uid(),
  add column created_at timestamptz not null default now();

-- Counts saved before this migration: credit them to whoever started the session.
update stock_rsbb.opname_count c
set created_by = s.created_by, created_at = s.created_at
from stock_rsbb.opname_session s
where s.id_opname_session = c.id_opname_session and c.created_by is null;

alter table stock_rsbb.opname_count alter column created_by set not null;

-- Same rule as transactions: a count is always recorded as the caller.
drop policy "record opname counts" on stock_rsbb.opname_count;
create policy "record opname counts" on stock_rsbb.opname_count for insert to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from stock_rsbb.opname_session s
      join stock_rsbb.inventory inv on inv.id_gudang = s.id_gudang
      where s.id_opname_session = opname_count.id_opname_session
        and inv.id_inventory = opname_count.id_inventory
        and ((select stock_rsbb.my_role()) = 'master' or s.id_gudang = (select stock_rsbb.my_staff_unit()))
    )
  );

-- History lists are newest first; per-item lookups filter by inventory.
create index stock_transaction_created_at_idx on stock_rsbb.stock_transaction (created_at desc);
create index stock_transaction_inventory_idx on stock_rsbb.stock_transaction (id_inventory, created_at desc);
create index opname_count_created_at_idx on stock_rsbb.opname_count (created_at desc);
create index opname_count_inventory_idx on stock_rsbb.opname_count (id_inventory, created_at desc);

notify pgrst, 'reload schema';
