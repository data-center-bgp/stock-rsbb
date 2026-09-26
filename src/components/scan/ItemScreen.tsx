"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { offlineDb } from "@/lib/offline/db";
import { TransactionForm } from "@/components/scan/TransactionForm";
import { OpnameForm } from "@/components/scan/OpnameForm";
import { ChevronLeftIcon, EyeIcon, MapPinIcon, PackageXIcon, ScanLineIcon, SpinnerIcon } from "@/components/icons";
import { StockStatus, cardClass, primaryButtonClass } from "@/components/ui";
import type { InventoryDetail } from "@/lib/types";

type Mode = "transaction" | "opname";

const numberFormat = new Intl.NumberFormat("id-ID");

// `canInput` is false for managers (read-only). The database rejects their
// writes regardless; this just doesn't offer forms that would fail.
export function ItemScreen({ token, canInput }: { token: string; canInput: boolean }) {
  const [inventory, setInventory] = useState<InventoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [mode, setMode] = useState<Mode>("transaction");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setNotFound(false);

      if (typeof navigator !== "undefined" && navigator.onLine) {
        const supabase = createClient();
        const { data } = await supabase
          .from("inventory")
          .select(
            "id_inventory, id_barang, id_gudang, id_lokasi, qr_token, harga_pokok_jual, harga_pokok, quantity_awal, current_qty, item:id_barang(nama, satuan_jual), unit:id_gudang(nama_gudang), location:id_lokasi(nama_lokasi)",
          )
          .eq("qr_token", token)
          .maybeSingle();

        if (data) {
          const detail = data as unknown as InventoryDetail;
          if (!cancelled) setInventory(detail);
          await offlineDb.inventoryCache.put(detail);
          if (!cancelled) setLoading(false);
          return;
        }
      }

      // Offline, or not found online — fall back to the local cache synced
      // earlier (on login / while online).
      const cached = await offlineDb.inventoryCache.where("qr_token").equals(token).first();
      if (cancelled) return;
      if (cached) {
        setInventory(cached);
      } else {
        setNotFound(true);
      }
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Reflect a saved transaction immediately (the database trigger applies the same delta).
  function applyDelta(delta: number) {
    setInventory((prev) => (prev ? { ...prev, current_qty: prev.current_qty + delta } : prev));
  }

  if (loading) {
    return (
      <PageShell>
        <p className="flex items-center justify-center gap-2 py-24 text-sm text-muted">
          <SpinnerIcon className="size-4" /> Memuat item...
        </p>
      </PageShell>
    );
  }

  if (notFound || !inventory) {
    return (
      <PageShell>
        <div className={`${cardClass} flex flex-col items-center px-6 py-12 text-center`}>
          <span className="grid size-12 place-items-center rounded-2xl bg-rose-500/12 text-rose-600 dark:text-rose-400">
            <PackageXIcon className="size-6" />
          </span>
          <h1 className="mt-4 text-lg font-semibold">QR tidak dikenali</h1>
          <p className="mt-1 max-w-xs text-sm text-muted">
            Coba scan ulang, atau sambungkan ke internet lalu coba lagi.
          </p>
          <Link href="/scan" className={`${primaryButtonClass} mt-6`}>
            <ScanLineIcon className="size-4" /> Scan ulang
          </Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className={`${cardClass} p-5`}>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-lg font-semibold leading-snug tracking-tight">{inventory.item.nama}</h1>
          <StockStatus qty={inventory.current_qty} />
        </div>
        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted">
          <MapPinIcon className="size-4 shrink-0" />
          {inventory.location.nama_lokasi} · {inventory.unit.nama_gudang}
        </p>
        <div className="mt-4 rounded-xl bg-surface-muted px-4 py-3">
          <p className="text-xs text-muted">Stok sistem</p>
          <p className="text-2xl font-semibold tracking-tight tabular-nums">
            {numberFormat.format(inventory.current_qty)}{" "}
            <span className="text-sm font-normal text-muted">{inventory.item.satuan_jual}</span>
          </p>
        </div>
      </div>

      {!canInput ? (
        <div className={`${cardClass} mt-4 flex items-start gap-3 p-5 text-sm text-muted`}>
          <EyeIcon className="mt-0.5 size-4 shrink-0" />
          Akun manajer hanya dapat melihat data. Pencatatan stok dan stock opname dilakukan oleh staf unit.
        </div>
      ) : (
        <>
          <div className="my-4 grid grid-cols-2 gap-1 rounded-xl border border-border bg-surface-muted p-1" role="tablist">
            <ModeButton active={mode === "transaction"} onClick={() => setMode("transaction")}>
              Stok Harian
            </ModeButton>
            <ModeButton active={mode === "opname"} onClick={() => setMode("opname")}>
              Stock Opname
            </ModeButton>
          </div>

          <div className={`${cardClass} p-5`}>
            {mode === "transaction" ? (
              <TransactionForm inventory={inventory} onSaved={applyDelta} />
            ) : (
              <OpnameForm inventory={inventory} />
            )}
          </div>
        </>
      )}
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-lg">
      <Link href="/scan" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ChevronLeftIcon className="size-4" /> Scan lagi
      </Link>
      {children}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-surface font-semibold text-primary shadow-sm ring-1 ring-border"
          : "font-medium text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
