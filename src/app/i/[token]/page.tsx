"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { offlineDb } from "@/lib/offline/db";
import { TransactionForm } from "@/components/scan/TransactionForm";
import { OpnameForm } from "@/components/scan/OpnameForm";
import type { InventoryDetail } from "@/lib/types";

type Mode = "transaction" | "opname";

export default function ScanResolvePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

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

  if (loading) {
    return <PageShell>Memuat...</PageShell>;
  }

  if (notFound || !inventory) {
    return (
      <PageShell>
        QR tidak dikenali. Coba scan ulang, atau sambungkan ke internet lalu coba lagi.
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-lg font-semibold">{inventory.item.nama}</h1>
          <p className="text-sm text-zinc-600">
            {inventory.unit.nama_gudang} · {inventory.location.nama_lokasi}
          </p>
        </div>

        <div className="flex gap-2">
          <ModeButton active={mode === "transaction"} onClick={() => setMode("transaction")}>
            Stok Harian
          </ModeButton>
          <ModeButton active={mode === "opname"} onClick={() => setMode("opname")}>
            Stock Opname
          </ModeButton>
        </div>

        {mode === "transaction" ? (
          <TransactionForm inventory={inventory} />
        ) : (
          <OpnameForm inventory={inventory} />
        )}
      </div>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 max-w-md mx-auto w-full p-4">{children}</div>;
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
      onClick={onClick}
      className={`flex-1 rounded px-3 py-2 text-sm font-medium ${
        active ? "bg-black text-white" : "bg-black/5 text-black"
      }`}
    >
      {children}
    </button>
  );
}
