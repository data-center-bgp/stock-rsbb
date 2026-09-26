"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { ChevronLeftIcon, SpinnerIcon } from "@/components/icons";
import { PageHeader, cardClass } from "@/components/ui";
import { INPUT_MODE_LABELS, type InputMode } from "@/lib/input-mode";

// html5-qrcode touches browser-only APIs (camera, DOM) at module load time,
// so this can't be part of the server-rendered bundle.
const QrScanner = dynamic(() => import("@/components/scan/QrScanner").then((m) => m.QrScanner), {
  ssr: false,
  loading: () => (
    <p className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
      <SpinnerIcon className="size-4" /> Memuat kamera...
    </p>
  ),
});

const TIPS = [
  "Arahkan kamera ke label QR di rak atau lokasi penyimpanan.",
  "Jaga jarak sekitar 15–20 cm sampai kode terbaca.",
  "Kalau membaca dari layar, naikkan kecerahan layarnya.",
];

export function ScanScreen({ mode }: { mode: InputMode | null }) {
  return (
    <div className="mx-auto w-full max-w-lg">
      <Link href="/input" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ChevronLeftIcon className="size-4" /> {mode ? "Ganti mode" : "Kembali"}
      </Link>
      <PageHeader
        title={mode ? `Scan · ${INPUT_MODE_LABELS[mode]}` : "Scan QR"}
        description={
          mode === "mutasi"
            ? "Pindai label item untuk mencatat barang masuk atau keluar."
            : mode === "opname"
              ? "Pindai label item untuk mencatat hasil hitung fisik."
              : "Pindai label item untuk melihat stoknya."
        }
      />

      <div className={`${cardClass} p-4 sm:p-5`}>
        <QrScanner mode={mode} />
      </div>

      <ul className="mt-4 flex flex-col gap-2 px-1 text-sm text-muted">
        {TIPS.map((tip) => (
          <li key={tip} className="flex gap-2">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
            {tip}
          </li>
        ))}
      </ul>
    </div>
  );
}
