"use client";

import { useRouter } from "next/navigation";
import { SearchSelect } from "@/components/SearchSelect";

type Gudang = { id_gudang: number; nama_gudang: string; kind: string };

// Masters count in any inventory: pick which one (kept in the URL).
export function GudangPicker({ gudangs, value }: { gudangs: Gudang[]; value: number }) {
  const router = useRouter();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="gudang" className="text-sm font-medium">
        Inventori
      </label>
      <SearchSelect
        id="gudang"
        value={String(value)}
        onChange={(v) => router.replace(`/opname?gudang=${v}`)}
        placeholder="Pilih inventori..."
        options={gudangs.map((g) => ({
          value: String(g.id_gudang),
          label: g.kind === "farmasi" ? `${g.nama_gudang} (Farmasi)` : g.nama_gudang,
        }))}
      />
    </div>
  );
}
