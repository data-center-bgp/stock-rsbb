"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { offlineDb, type QueuedStockTransaction } from "@/lib/offline/db";
import { formatDate } from "@/lib/dates";
import { mutasiType } from "@/lib/mutasi";
import { ClockIcon } from "@/components/icons";
import { SignedQty } from "@/components/history/parts";

type Pending = QueuedStockTransaction & { itemName: string; unit: string };

// Mutasi saved on this device while offline aren't in the database yet, so
// the history can't show them — list them here until they sync.
export function PendingMutasi({ inventoryId = null }: { inventoryId?: number | null }) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending[]>([]);
  const lastCount = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const queued = (await offlineDb.stockTransactions.where("synced").equals(0).toArray()).filter(
        (q) => inventoryId === null || q.id_inventory === inventoryId,
      );
      const cached = await offlineDb.inventoryCache.bulkGet(queued.map((q) => q.id_inventory));
      if (cancelled) return;
      setPending(
        queued
          .map((q, i) => ({ ...q, itemName: cached[i]?.item.nama ?? "Item", unit: cached[i]?.item.satuan_jual ?? "" }))
          .sort((a, b) => b.created_at.localeCompare(a.created_at)),
      );
      // Some just synced: reload the history so they appear there instead.
      if (lastCount.current !== null && queued.length < lastCount.current) router.refresh();
      lastCount.current = queued.length;
    }
    load().catch(() => {});
    const id = setInterval(() => load().catch(() => {}), 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [router, inventoryId]);

  if (!pending.length) return null;

  return (
    <div className="border-b border-border bg-amber-500/8 px-4 py-3 lg:px-5">
      <p className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
        <ClockIcon className="size-4" />
        {pending.length} mutasi menunggu sinkron
      </p>
      <p className="mt-0.5 text-xs text-muted">Tersimpan di perangkat ini dan akan terkirim otomatis saat online.</p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {pending.map((p) => {
          const spec = mutasiType(p.type);
          return (
            <li key={p.local_id} className="flex items-center gap-3 text-sm">
              <span className="min-w-0 flex-1 truncate">
                {p.itemName} <span className="text-xs text-muted">· {spec.label} · {formatDate(p.transaction_date)}</span>
              </span>
              <SignedQty value={spec.direction === "in" ? p.quantity : -p.quantity} unit={p.unit} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
