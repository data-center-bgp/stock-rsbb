"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ListFilterIcon, SearchIcon } from "@/components/icons";
import { fieldClass, secondaryButtonClass } from "@/components/ui";
import { MUTASI_TYPES } from "@/lib/mutasi";
import type { HistoryTab } from "@/lib/history";

type Unit = { id_gudang: number; nama_gudang: string };

const controlClass = `${fieldClass} h-10 px-3`;
const selectClass = `${fieldClass} h-10 cursor-pointer pl-3 pr-8`;

// Filters live in the URL (like the dashboard), so a filtered history can be
// shared or reloaded. Phones see the search box; the rest folds behind "Filter".
export function HistoryFilters({
  tab,
  units,
  canRecord,
}: {
  tab: HistoryTab;
  units: Unit[];
  canRecord: boolean; // managers never record, so "Hanya saya" is pointless for them
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [open, setOpen] = useState(false);
  const firstRender = useRef(true);

  function update(changes: Record<string, string>) {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page"); // any filter change starts from the first page
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  // Debounce typing so each keystroke doesn't trigger a server render.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const id = setTimeout(() => update({ q: query.trim() }), 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the typed query changes
  }, [query]);

  const get = (key: string) => searchParams.get(key) ?? "";
  const activeCount = ["jenis", "selisih", "unit", "from", "to", "mine"].filter((k) => get(k)).length;

  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1 lg:w-64 lg:flex-none">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari item, distributor, unit..."
            aria-label="Cari nama item, distributor, atau unit"
            className={`${fieldClass} h-10 w-full pl-9 pr-3`}
          />
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={`${secondaryButtonClass} h-10 shrink-0 px-3 text-sm lg:hidden`}
        >
          <ListFilterIcon className="size-4" />
          Filter{activeCount ? ` (${activeCount})` : ""}
        </button>
      </div>

      <div className={`${open ? "grid" : "hidden"} grid-cols-2 gap-2 lg:flex lg:flex-wrap lg:items-center`}>
        {tab === "mutasi" && (
          <select
            aria-label="Filter jenis mutasi"
            value={get("jenis")}
            onChange={(e) => update({ jenis: e.target.value })}
            className={`${selectClass} col-span-2`}
          >
            <option value="">Semua jenis</option>
            <option value="masuk">Semua barang masuk</option>
            <option value="keluar">Semua barang keluar</option>
            {MUTASI_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        )}
        {tab === "opname" && (
          <select
            aria-label="Filter selisih"
            value={get("selisih")}
            onChange={(e) => update({ selisih: e.target.value })}
            className={`${selectClass} col-span-2`}
          >
            <option value="">Semua hasil</option>
            <option value="ada">Ada selisih</option>
            <option value="sesuai">Sesuai</option>
          </select>
        )}
        {units.length > 1 && (
          <select
            aria-label="Filter inventori"
            value={get("unit")}
            onChange={(e) => update({ unit: e.target.value })}
            className={`${selectClass} col-span-2`}
          >
            <option value="">Semua inventori</option>
            {units.map((u) => (
              <option key={u.id_gudang} value={u.id_gudang}>
                {u.nama_gudang}
              </option>
            ))}
          </select>
        )}
        <label className="flex flex-col gap-1 text-xs text-muted lg:flex-row lg:items-center lg:gap-2">
          Dari
          <input
            type="date"
            value={get("from")}
            max={get("to") || undefined}
            onChange={(e) => update({ from: e.target.value })}
            className={controlClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted lg:flex-row lg:items-center lg:gap-2">
          Sampai
          <input
            type="date"
            value={get("to")}
            min={get("from") || undefined}
            onChange={(e) => update({ to: e.target.value })}
            className={controlClass}
          />
        </label>
        {canRecord && (
          <label className="col-span-2 flex h-10 cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={get("mine") === "1"}
              onChange={(e) => update({ mine: e.target.checked ? "1" : "" })}
              className="size-4 accent-(--primary)"
            />
            Hanya yang saya catat
          </label>
        )}
        {activeCount > 0 && (
          <button
            type="button"
            onClick={() => update({ jenis: "", selisih: "", unit: "", from: "", to: "", mine: "" })}
            className="col-span-2 h-10 text-left text-sm font-medium text-primary hover:underline"
          >
            Hapus filter
          </button>
        )}
      </div>
    </div>
  );
}
