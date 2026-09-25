"use client";

import dynamic from "next/dynamic";
import { SpinnerIcon } from "@/components/icons";
import { PageHeader, cardClass } from "@/components/ui";

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

export default function ScanPage() {
  return (
    <div className="mx-auto w-full max-w-lg">
      <PageHeader title="Scan QR" description="Pindai label untuk mencatat stok atau stock opname." />

      <div className={`${cardClass} p-4 sm:p-5`}>
        <QrScanner />
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
