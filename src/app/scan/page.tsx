"use client";

import dynamic from "next/dynamic";
import { AppNav } from "@/components/AppNav";

// html5-qrcode touches browser-only APIs (camera, DOM) at module load time,
// so this can't be part of the server-rendered bundle.
const QrScanner = dynamic(() => import("@/components/scan/QrScanner").then((m) => m.QrScanner), {
  ssr: false,
  loading: () => <p className="text-sm text-zinc-500">Memuat kamera...</p>,
});

export default function ScanPage() {
  return (
    <div className="flex-1 flex flex-col">
      <AppNav />
      <div className="max-w-md mx-auto w-full p-4">
        <h1 className="text-lg font-semibold mb-1">Scan QR</h1>
        <p className="text-sm text-zinc-600 mb-3">
          Arahkan kamera ke QR code pada rak/lokasi penyimpanan.
        </p>
        <QrScanner />
      </div>
    </div>
  );
}
