"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchIcon } from "@/components/icons";
import { fieldClass } from "@/components/ui";

type Unit = { id_gudang: number; nama_gudang: string };

const selectClass = `${fieldClass} h-10 cursor-pointer pl-3 pr-8`;

export function InventoryFilters({ units }: { units: Unit[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
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

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-64">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari nama item..."
          aria-label="Cari nama item"
          className={`${fieldClass} h-10 w-full pl-9 pr-3`}
        />
      </div>
      <select
        aria-label="Filter status stok"
        value={searchParams.get("status") ?? ""}
        onChange={(e) => update({ status: e.target.value })}
        className={selectClass}
      >
        <option value="">Semua status</option>
        <option value="tersedia">Tersedia</option>
        <option value="habis">Habis</option>
      </select>
      {units.length > 1 && (
        <select
          aria-label="Filter unit"
          value={searchParams.get("unit") ?? ""}
          onChange={(e) => update({ unit: e.target.value })}
          className={selectClass}
        >
          <option value="">Semua unit</option>
          {units.map((u) => (
            <option key={u.id_gudang} value={u.id_gudang}>
              {u.nama_gudang}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
