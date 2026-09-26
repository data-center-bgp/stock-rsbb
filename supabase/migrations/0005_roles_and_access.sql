-- Roles and per-inventory access, enforced in the database (RLS), since the
-- app queries Supabase straight from the browser — hiding things in the UI
-- alone would not stop a signed-in user from reading another inventory.
--
--   master  : sees everything, can input, manages users
--   manager : sees everything, read-only
--   staff   : sees and inputs only for their own unit (profiles.id_gudang)
--   null    : signed in but not approved yet — sees nothing
--
-- Each inventory (General, Pharmacy) is one unit. Accounts are still created
-- in Supabase Auth; a master approves them and sets role/unit in the app,
-- through stock_rsbb.set_user_access() below.

-- 1. Roles ------------------------------------------------------------------

alter table stock_rsbb.profiles drop constraint profiles_role_check;
alter table stock_rsbb.profiles alter column role drop default;
alter table stock_rsbb.profiles alter column role drop not null;

-- Carry existing rows over: 'admin' becomes 'master'; the old default
-- ('staff' with no unit) becomes "waiting for approval".
update stock_rsbb.profiles set role = 'master' where role = 'admin';
update stock_rsbb.profiles set role = null where role = 'staff' and id_gudang is null;

alter table stock_rsbb.profiles
  add constraint profiles_role_check check (role in ('master', 'manager', 'staff')),
  add constraint profiles_staff_unit_check check (role is distinct from 'staff' or id_gudang is not null);

-- 2. Helpers used by the policies ---------------------------------------------
-- security definer so they can read profiles regardless of its own RLS.
-- Policies call them as `(select ...)`, which Postgres evaluates once per
-- query instead of once per row.

create function stock_rsbb.my_role() returns text
language sql stable security definer set search_path = ''
as $$
  select role from stock_rsbb.profiles where id = auth.uid()
$$;

-- The caller's unit, but only if they're staff (null for everyone else).
create function stock_rsbb.my_staff_unit() returns bigint
language sql stable security definer set search_path = ''
as $$
  select id_gudang from stock_rsbb.profiles where id = auth.uid() and role = 'staff'
$$;

revoke execute on function stock_rsbb.my_role(), stock_rsbb.my_staff_unit() from public, anon;
grant execute on function stock_rsbb.my_role(), stock_rsbb.my_staff_unit() to authenticated;

-- 3. Replace the old "any signed-in user can do anything" policies -----------

drop policy "authenticated read/write" on stock_rsbb.producer;
drop policy "authenticated read/write" on stock_rsbb.item;
drop policy "authenticated read/write" on stock_rsbb.unit;
drop policy "authenticated read/write" on stock_rsbb.location;
drop policy "authenticated read/write" on stock_rsbb.inventory;
drop policy "authenticated read/write" on stock_rsbb.stock_transaction;
drop policy "authenticated read/write" on stock_rsbb.opname_session;
drop policy "authenticated read/write" on stock_rsbb.opname_count;

-- Master data: master writes; everyone reads only what's in their scope.
-- (Imports use the service role, which bypasses RLS.)

create policy "read units" on stock_rsbb.unit for select to authenticated
  using ((select stock_rsbb.my_role()) in ('master', 'manager') or id_gudang = (select stock_rsbb.my_staff_unit()));
create policy "master manages units" on stock_rsbb.unit for all to authenticated
  using ((select stock_rsbb.my_role()) = 'master') with check ((select stock_rsbb.my_role()) = 'master');

create policy "read locations" on stock_rsbb.location for select to authenticated
  using ((select stock_rsbb.my_role()) in ('master', 'manager') or id_gudang = (select stock_rsbb.my_staff_unit()));
create policy "master manages locations" on stock_rsbb.location for all to authenticated
  using ((select stock_rsbb.my_role()) = 'master') with check ((select stock_rsbb.my_role()) = 'master');

create policy "read inventory" on stock_rsbb.inventory for select to authenticated
  using ((select stock_rsbb.my_role()) in ('master', 'manager') or id_gudang = (select stock_rsbb.my_staff_unit()));
create policy "master manages inventory" on stock_rsbb.inventory for all to authenticated
  using ((select stock_rsbb.my_role()) = 'master') with check ((select stock_rsbb.my_role()) = 'master');

-- Catalog is separated too: staff only see items stocked in their unit.
create policy "read items" on stock_rsbb.item for select to authenticated
  using (
    (select stock_rsbb.my_role()) in ('master', 'manager')
    or exists (
      select 1 from stock_rsbb.inventory inv
      where inv.id_barang = item.id_barang and inv.id_gudang = (select stock_rsbb.my_staff_unit())
    )
  );
create policy "master manages items" on stock_rsbb.item for all to authenticated
  using ((select stock_rsbb.my_role()) = 'master') with check ((select stock_rsbb.my_role()) = 'master');

create policy "read producers" on stock_rsbb.producer for select to authenticated
  using (
    (select stock_rsbb.my_role()) in ('master', 'manager')
    or exists (
      select 1 from stock_rsbb.item it
      join stock_rsbb.inventory inv on inv.id_barang = it.id_barang
      where it.id_produsen = producer.id_produsen and inv.id_gudang = (select stock_rsbb.my_staff_unit())
    )
  );
create policy "master manages producers" on stock_rsbb.producer for all to authenticated
  using ((select stock_rsbb.my_role()) = 'master') with check ((select stock_rsbb.my_role()) = 'master');

-- Transactions: append-only. Master records anywhere, staff only in their
-- unit, managers never. created_by must be the caller (it defaults to them).

create policy "read transactions" on stock_rsbb.stock_transaction for select to authenticated
  using (
    (select stock_rsbb.my_role()) in ('master', 'manager')
    or exists (
      select 1 from stock_rsbb.inventory inv
      where inv.id_inventory = stock_transaction.id_inventory and inv.id_gudang = (select stock_rsbb.my_staff_unit())
    )
  );
create policy "record transactions" on stock_rsbb.stock_transaction for insert to authenticated
  with check (
    created_by = auth.uid()
    and (
      (select stock_rsbb.my_role()) = 'master'
      or exists (
        select 1 from stock_rsbb.inventory inv
        where inv.id_inventory = stock_transaction.id_inventory and inv.id_gudang = (select stock_rsbb.my_staff_unit())
      )
    )
  );

-- Opname sessions: the app upserts today's session, so insert + update.

create policy "read opname sessions" on stock_rsbb.opname_session for select to authenticated
  using ((select stock_rsbb.my_role()) in ('master', 'manager') or id_gudang = (select stock_rsbb.my_staff_unit()));
create policy "start opname sessions" on stock_rsbb.opname_session for insert to authenticated
  with check (
    created_by = auth.uid()
    and ((select stock_rsbb.my_role()) = 'master' or id_gudang = (select stock_rsbb.my_staff_unit()))
  );
create policy "update opname sessions" on stock_rsbb.opname_session for update to authenticated
  using ((select stock_rsbb.my_role()) = 'master' or id_gudang = (select stock_rsbb.my_staff_unit()))
  with check ((select stock_rsbb.my_role()) = 'master' or id_gudang = (select stock_rsbb.my_staff_unit()));

-- Opname counts: the counted item must belong to the session's unit, and
-- that unit must be the caller's (or the caller is master).

create policy "read opname counts" on stock_rsbb.opname_count for select to authenticated
  using (
    (select stock_rsbb.my_role()) in ('master', 'manager')
    or exists (
      select 1 from stock_rsbb.opname_session s
      where s.id_opname_session = opname_count.id_opname_session and s.id_gudang = (select stock_rsbb.my_staff_unit())
    )
  );
create policy "record opname counts" on stock_rsbb.opname_count for insert to authenticated
  with check (
    exists (
      select 1 from stock_rsbb.opname_session s
      join stock_rsbb.inventory inv on inv.id_gudang = s.id_gudang
      where s.id_opname_session = opname_count.id_opname_session
        and inv.id_inventory = opname_count.id_inventory
        and ((select stock_rsbb.my_role()) = 'master' or s.id_gudang = (select stock_rsbb.my_staff_unit()))
    )
  );

-- Recording a transaction updates inventory.current_qty through this
-- trigger. Staff can't update inventory directly any more, so the trigger
-- runs as its owner; the insert policy above already vetted the transaction.
alter function stock_rsbb.apply_stock_transaction() security definer;

-- 4. Profiles: who can see whom ---------------------------------------------

drop policy "read profiles" on stock_rsbb.profiles;
create policy "read profiles" on stock_rsbb.profiles for select to authenticated
  using (
    id = auth.uid()
    or (select stock_rsbb.my_role()) in ('master', 'manager')
    or id_gudang = (select stock_rsbb.my_staff_unit())
  );

-- 5. Master assigns access ----------------------------------------------------
-- Column grants only let users edit their own name, so role/unit changes go
-- through this function, which checks the caller is master.

create function stock_rsbb.set_user_access(
  target uuid,
  new_role text,
  new_unit bigint,
  new_full_name text
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if stock_rsbb.my_role() is distinct from 'master' then
    raise exception 'Hanya master yang dapat mengatur akses pengguna.' using errcode = '42501';
  end if;
  -- Guards against a master locking themselves out; change your own role in SQL.
  if target = auth.uid() then
    raise exception 'Akses akun sendiri tidak dapat diubah dari aplikasi.' using errcode = '42501';
  end if;
  if new_role = 'staff' and new_unit is null then
    raise exception 'Staf harus memiliki inventori.' using errcode = '22023';
  end if;

  update stock_rsbb.profiles
  set role = new_role,
      id_gudang = case when new_role = 'staff' then new_unit end,
      full_name = nullif(trim(new_full_name), '')
  where id = target;

  if not found then
    raise exception 'Pengguna tidak ditemukan.' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function stock_rsbb.set_user_access(uuid, text, bigint, text) from public, anon;
grant execute on function stock_rsbb.set_user_access(uuid, text, bigint, text) to authenticated;

notify pgrst, 'reload schema';
