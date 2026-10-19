"use client";

import Link from "next/link";
import { useState } from "react";
import { todayInAppZone } from "@/lib/dates";
import { saveStockTransaction } from "@/lib/save-transaction";
import { USAGE_HOME, scanHref } from "@/lib/input-mode";
import { ScanLineIcon, SearchIcon, SpinnerIcon } from "@/components/icons";
import { Alert, fieldClass, inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import type { InventoryDetail } from "@/lib/types";

// A hospital unit's Mutasi: it only records what it uses (out_usage). Stock
// comes in and goes back through the pharmacy, which the database mirrors
// into the unit (0013_unit_usage.sql).
export function UsageForm({
  inventory,
  onSaved,
}: {
  inventory: InventoryDetail;
  onSaved?: (delta: number) => void;
}) {
  const today = todayInAppZone();
  const [quantity, setQuantity] = useState("1");
  const [date, setDate] = useState(today);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "queued" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const unit = inventory.item.satuan_jual;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const qty = Number(quantity);
    const problem =
      !Number.isInteger(qty) || qty <= 0
        ? "Jumlah harus bilangan bulat lebih dari 0."
        : qty > inventory.current_qty
          ? `Jumlah melebihi stok unit (${inventory.current_qty} ${unit}). Lakukan stock opname jika stok fisik berbeda.`
          : !date || date > today
            ? "Tanggal pemakaian tidak boleh setelah hari ini."
            : null;
    if (problem) {
      setStatus("error");
      setErrorMessage(problem);
      return;
    }

    setStatus("saving");
    setErrorMessage(null);
    const result = await saveStockTransaction({
      id_inventory: inventory.id_inventory,
      type: "out_usage",
      quantity: qty,
      transaction_date: date,
      id_distributor: null,
      id_hospital_unit: null,
      batch_number: null,
      expiry_date: null,
    });
    if (result.status === "error") {
      setStatus("error");
      setErrorMessage(result.message);
      return;
    }
    setStatus(result.status);
    setQuantity("1");
    // A queued row isn't in the database yet, so the stock shown stays as it was.
    if (result.status === "saved") onSaved?.(-qty);
  }

  if (status === "saved" || status === "queued") {
    return (
      <div className="flex flex-col gap-3">
        {status === "saved" ? (
          <Alert tone="success">Pemakaian tersimpan.</Alert>
        ) : (
          <Alert tone="warning">Tidak ada koneksi — pemakaian disimpan di HP dan akan tersinkron otomatis.</Alert>
        )}
        <Link href={scanHref("pemakaian")} className={`${primaryButtonClass} w-full`}>
          <ScanLineIcon className="size-4" /> Scan item berikutnya
        </Link>
        <Link href={USAGE_HOME} className={`${secondaryButtonClass} h-11 w-full px-4 text-sm`}>
          <SearchIcon className="size-4" /> Cari item lain
        </Link>
        <button type="button" onClick={() => setStatus("idle")} className={`${secondaryButtonClass} h-11 px-4 text-sm`}>
          Catat pemakaian lagi untuk item ini
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="quantity" className="text-sm font-medium">
          Jumlah dipakai ({unit})
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
        <p className="text-xs text-muted">
          Stok unit: {inventory.current_qty} {unit}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="date" className="text-sm font-medium">
          Tanggal Pemakaian
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

      <button type="submit" disabled={status === "saving"} className={`${primaryButtonClass} w-full`}>
        {status === "saving" && <SpinnerIcon className="size-4" />}
        {status === "saving" ? "Menyimpan..." : "Simpan Pemakaian"}
      </button>

      {status === "error" && errorMessage && <Alert tone="danger">{errorMessage}</Alert>}
    </form>
  );
}
