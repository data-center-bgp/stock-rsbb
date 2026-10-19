-- Mutasi for hospital units: three new transaction types.
--
--   out_usage            Pemakaian               unit staff record each use
--   in_pharmacy_delivery Penerimaan dari Farmasi  created automatically when the
--                                                 pharmacy records Pengiriman ke Unit
--   out_pharmacy_return  Retur ke Farmasi         created automatically when the
--                                                 pharmacy records Retur dari Unit
--
-- Run this file on its own, before 0013: a new enum value can't be used in
-- the transaction that adds it.

alter type stock_rsbb.stock_transaction_type add value if not exists 'out_usage';
alter type stock_rsbb.stock_transaction_type add value if not exists 'in_pharmacy_delivery';
alter type stock_rsbb.stock_transaction_type add value if not exists 'out_pharmacy_return';
