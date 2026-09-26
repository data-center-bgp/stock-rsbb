import type { StockTransactionType } from "@/lib/types";

// The five pharmacy Mutasi types (0006_mutasi.sql): what each one needs on
// the form and how it's labelled — shared by the form and the history.

export type MutasiNeeds = "distributor" | "unit" | "none";

export type MutasiTypeSpec = {
  value: StockTransactionType;
  direction: "in" | "out";
  label: string;
  needs: MutasiNeeds;
  dateLabel: string;
  unitLabel?: string;
};

export const MUTASI_TYPES: MutasiTypeSpec[] = [
  { value: "in_receipt", direction: "in", label: "Penerimaan Barang", needs: "distributor", dateLabel: "Tanggal Penerimaan" },
  { value: "in_unit_return", direction: "in", label: "Retur dari Unit", needs: "unit", dateLabel: "Tanggal Retur", unitLabel: "Unit Asal" },
  { value: "out_unit_delivery", direction: "out", label: "Pengiriman ke Unit", needs: "unit", dateLabel: "Tanggal Pengiriman", unitLabel: "Unit Tujuan" },
  { value: "out_distributor_return", direction: "out", label: "Retur ke Distributor", needs: "distributor", dateLabel: "Tanggal Retur" },
  { value: "out_disposal", direction: "out", label: "Pemusnahan", needs: "none", dateLabel: "Tanggal Pemusnahan" },
];

export function mutasiType(value: StockTransactionType): MutasiTypeSpec {
  return MUTASI_TYPES.find((t) => t.value === value)!;
}

export function isMutasiType(value: string | undefined): value is StockTransactionType {
  return MUTASI_TYPES.some((t) => t.value === value);
}
