-- Per-user data for this app (name, role, home unit), keyed by the Supabase
-- Auth user id.
--
-- No trigger on auth.users: this Supabase project's auth is shared with the
-- company's other apps, so a trigger would create a stock_rsbb profile for
-- every user of every app (and a failing trigger would block sign-ups for all
-- of them). Instead the app inserts a user's own profile the first time they
-- open it; an admin then sets role / id_gudang (Table Editor or SQL).

create table stock_rsbb.profiles (
  id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  -- Taken from the login token, not from the client, so it can't be spoofed.
  -- It's a copy: it won't follow a later change to the auth email by itself.
  email text not null default (auth.jwt() ->> 'email'),
  full_name text,
  role text not null default 'staff' check (role in ('staff', 'admin')),
  id_gudang bigint references stock_rsbb.unit (id_gudang) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function stock_rsbb.set_updated_at() returns trigger
language plpgsql
set search_path = stock_rsbb, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on stock_rsbb.profiles
  for each row execute function stock_rsbb.set_updated_at();

alter table stock_rsbb.profiles enable row level security;

-- Everyone signed in can see names (e.g. who recorded a transaction).
create policy "read profiles" on stock_rsbb.profiles
  for select to authenticated using (true);

-- A user can create and edit only their own row...
create policy "insert own profile" on stock_rsbb.profiles
  for insert to authenticated with check (id = auth.uid());

create policy "update own profile" on stock_rsbb.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ...and only these columns: role and id_gudang are admin-only. 0001's
-- default privileges gave `authenticated` everything on new tables, so
-- narrow that back down here.
revoke all on stock_rsbb.profiles from authenticated;
grant select on stock_rsbb.profiles to authenticated;
grant insert (id, full_name) on stock_rsbb.profiles to authenticated;
grant update (full_name) on stock_rsbb.profiles to authenticated;

-- Make the API see the new table immediately.
notify pgrst, 'reload schema';
