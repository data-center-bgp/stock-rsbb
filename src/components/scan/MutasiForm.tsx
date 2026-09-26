"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { offlineDb } from "@/lib/offline/db";
import { loadLookups, type Lookups } from "@/lib/lookups";
import { todayInAppZone } from "@/lib/dates";
import { ScanLineIcon, SpinnerIcon } from "@/components/icons";
import { Alert, fieldClass, inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import type { InventoryDetail, StockTransactionType } from "@/lib/types";

type Needs = "distributor" | "unit" | "none";

const TYPES: {
  value: StockTransactionType;
  direction: "in" | "out";
  label: string;
  needs: Needs;
  dateLabel: string;
  unitLabel?: string;
}[] = [
  { value: "in_receipt", direction: "in", label: "Penerimaan Barang", needs: "distributor", dateLabel: "Tanggal Penerimaan" },
  { value: "in_unit_return", direction: "in", label: "Retur dari Unit", needs: "unit", dateLabel: "Tanggal Retur", unitLabel: "Unit Asal" },
  { value: "out_unit_delivery", direction: "out", label: "Pengiriman ke Unit", needs: "unit", dateLabel: "Tanggal Pengiriman", unitLabel: "Unit Tujuan" },
  { value: "out_distributor_return", direction: "out", label: "Retur ke Distributor", needs: "distributor", dateLabel: "Tanggal Retur" },
  { value: "out_disposal", direction: "out", label: "Pemusnahan", needs: "none", dateLabel: "Tanggal Pemusnahan" },
];

// Type, date, distributor and unit carry over to the next scanned item
// (receiving one delivery = many items from one distributor on one date).
const LAST_KEY = "mutasi:last";
type Last = { type: StockTransactionType | null; date: string; distributorId: string; unitId: string };

function readLast(): Last | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(sessionStorage.getItem(LAST_KEY) ?? "null");
  } catch {
    return null;
  }
}

const labelClass = "text-sm font-medium";
const selectClass = `${inputClass} cursor-pointer pl-3.5 pr-8`;

export function MutasiForm({
  inventory,
  nextScanHref,
  onSaved,
}: {
  inventory: InventoryDetail;
  nextScanHref: string;
  onSaved?: (delta: number) => void;
}) {
  const today = todayInAppZone();
  // Only ever rendered in the browser (after the item loads), so reading
  // sessionStorage for the initial state is safe.
  const [last] = useState(readLast);
  const [type, setType] = useState<StockTransactionType | null>(last?.type ?? null);
  const [quantity, setQuantity] = useState("");
  const [date, setDate] = useState(last?.date && last.date <= today ? last.date : today);
  const [distributorId, setDistributorId] = useState(last?.distributorId ?? "");
  const [unitId, setUnitId] = useState(last?.unitId ?? "");
  const [batch, setBatch] = useState("");
  const [expiry, setExpiry] = useState("");
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "queued" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadLookups().then(setLookups);
  }, []);

  const spec = TYPES.find((t) => t.value === type) ?? null;
  const unit = inventory.item.satuan_jual;

  function validate(qty: number): string | null {
    if (!spec) return "Pilih jenis mutasi.";
    if (!Number.isInteger(qty) || qty <= 0) return "Jumlah harus bilangan bulat lebih dari 0.";
    if (spec.direction === "out" && qty > inventory.current_qty)
      return `Jumlah melebihi stok sistem (${inventory.current_qty} ${unit}). Lakukan stock opname jika stok fisik berbeda.`;
    if (!date || date > today) return `${spec.dateLabel} tidak boleh setelah hari ini.`;
    if (spec.needs === "distributor") {
      if (!distributorId) return "Pilih distributor.";
      if (!batch.trim()) return "Isi nomor batch.";
      if (!expiry) return "Isi tanggal kedaluwarsa.";
    }
    if (spec.needs === "unit" && !unitId) return `Pilih ${spec.unitLabel?.toLowerCase()}.`;
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const qty = Number(quantity);
    const problem = validate(qty);
    if (problem || !spec) {
      setStatus("error");
      setErrorMessage(problem);
      return;
    }

    setStatus("saving");
    setErrorMessage(null);
    const record = {
      id_inventory: inventory.id_inventory,
      type: spec.value,
      quantity: qty,
      transaction_date: date,
      id_distributor: spec.needs === "distributor" ? Number(distributorId) : null,
      id_hospital_unit: spec.needs === "unit" ? Number(unitId) : null,
      batch_number: spec.needs === "distributor" ? batch.trim() : null,
      expiry_date: spec.needs === "distributor" ? expiry : null,
    };
    const localId = crypto.randomUUID();

    try {
      sessionStorage.setItem(LAST_KEY, JSON.stringify({ type, date, distributorId, unitId } satisfies Last));
    } catch {
      // Private mode etc. — just no carry-over.
    }

    if (navigator.onLine) {
      const { error } = await createClient()
        .from("stock_transaction")
        .insert({ id_transaction: localId, ...record });
      if (!error) {
        setStatus("saved");
        setQuantity("");
        setBatch("");
        setExpiry("");
        onSaved?.(spec.direction === "in" ? qty : -qty);
        return;
      }
      // Only a failed request (lost signal mid-save) belongs in the offline
      // queue; a database rejection would just fail again on sync.
      if (!/fetch|network/i.test(error.message)) {
        setStatus("error");
        setErrorMessage(`Gagal menyimpan: ${error.message}`);
        return;
      }
    }

    await offlineDb.stockTransactions.add({
      local_id: localId,
      ...record,
      created_at: new Date().toISOString(),
      synced: 0,
    });
    setStatus("queued");
    setQuantity("");
    setBatch("");
    setExpiry("");
  }

  if (status === "saved" || status === "queued") {
    return (
      <div className="flex flex-col gap-4">
        {status === "saved" ? (
          <Alert tone="success">Mutasi {spec?.label.toLowerCase()} tersimpan.</Alert>
        ) : (
          <Alert tone="warning">Tidak ada koneksi — mutasi disimpan di HP dan akan tersinkron otomatis.</Alert>
        )}
        <Link href={nextScanHref} className={`${primaryButtonClass} w-full`}>
          <ScanLineIcon className="size-4" /> Scan item berikutnya
        </Link>
        <button type="button" onClick={() => setStatus("idle")} className={`${secondaryButtonClass} h-11 px-4 text-sm`}>
          Catat mutasi lain untuk item ini
        </button>
      </div>
    );
  }

  const noDistributors = lookups !== null && lookups.distributors.length === 0;
  const noUnits = lookups !== null && lookups.units.length === 0;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      {(["in", "out"] as const).map((direction) => (
        <fieldset key={direction}>
          <legend className="mb-2 text-sm font-medium">{direction === "in" ? "Barang Masuk" : "Barang Keluar"}</legend>
          <div className="grid grid-cols-2 gap-2">
            {TYPES.filter((t) => t.direction === direction).map((t) => {
              const selected = type === t.value;
              return (
                <label
                  key={t.value}
                  className={`cursor-pointer rounded-xl border px-3 py-3 text-sm font-semibold transition-colors has-focus-visible:outline-2 has-focus-visible:outline-primary ${
                    selected ? "border-primary bg-primary/8" : "border-border hover:bg-surface-muted"
                  } ${direction === "in" ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}
                >
                  <input
                    type="radio"
                    name="type"
                    value={t.value}
                    checked={selected}
                    onChange={() => {
                      setType(t.value);
                      setStatus("idle");
                      setErrorMessage(null);
                    }}
                    className="sr-only"
                  />
                  {direction === "in" ? "+ " : "− "}
                  {t.label}
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}

      {spec && (
        <>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="quantity" className={labelClass}>
              Jumlah ({unit})
            </label>
            <input
              id="quantity"
              type="number"
              inputMode="numeric"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className={`${fieldClass} h-12 w-full px-3.5 text-lg font-semibold tabular-nums`}
            />
            {spec.direction === "out" && (
              <p className="text-xs text-muted">
                Stok sistem: {inventory.current_qty} {unit}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="date" className={labelClass}>
              {spec.dateLabel}
            </label>
            <input
              id="date"
              type="date"
              max={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`${inputClass} px-3.5`}
            />
          </div>

          {spec.needs === "distributor" && (
            <>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="distributor" className={labelClass}>
                  Nama Distributor
                </label>
                <select
                  id="distributor"
                  value={distributorId}
                  onChange={(e) => setDistributorId(e.target.value)}
                  className={selectClass}
                >
                  <option value="">{lookups ? "Pilih distributor..." : "Memuat..."}</option>
                  {lookups?.distributors.map((d) => (
                    <option key={d.id_distributor} value={d.id_distributor}>
                      {d.nama}
                    </option>
                  ))}
                </select>
                {noDistributors && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Belum ada data distributor. Minta master menambahkannya di Data Master.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="batch" className={labelClass}>
                    Nomor Batch
                  </label>
                  <input
                    id="batch"
                    value={batch}
                    onChange={(e) => setBatch(e.target.value)}
                    autoCapitalize="characters"
                    className={`${inputClass} px-3.5`}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="expiry" className={labelClass}>
                    Expire Date
                  </label>
                  <input
                    id="expiry"
                    type="date"
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                    className={`${inputClass} px-3`}
                  />
                </div>
              </div>
            </>
          )}

          {spec.needs === "unit" && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="unit" className={labelClass}>
                {spec.unitLabel}
              </label>
              <select id="unit" value={unitId} onChange={(e) => setUnitId(e.target.value)} className={selectClass}>
                <option value="">{lookups ? "Pilih unit..." : "Memuat..."}</option>
                {lookups?.units.map((u) => (
                  <option key={u.id_hospital_unit} value={u.id_hospital_unit}>
                    {u.nama}
                  </option>
                ))}
              </select>
              {noUnits && (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Belum ada data unit. Minta master menambahkannya di Data Master.
                </p>
              )}
            </div>
          )}

          <button type="submit" disabled={status === "saving"} className={`${primaryButtonClass} w-full`}>
            {status === "saving" && <SpinnerIcon className="size-4" />}
            {status === "saving" ? "Menyimpan..." : "Simpan Mutasi"}
          </button>
        </>
      )}

      {status === "error" && errorMessage && <Alert tone="danger">{errorMessage}</Alert>}
    </form>
  );
}
