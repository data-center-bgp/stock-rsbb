-- Stamp who recorded each row from the request's own login (the JWT),
-- instead of trusting the client to send it. Covers inserts made online and
-- ones flushed later from the offline queue (those still run under the
-- user's session).

alter table stock_rsbb.stock_transaction
  alter column created_by set default auth.uid();

alter table stock_rsbb.opname_session
  alter column created_by set default auth.uid();
