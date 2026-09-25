"use client";

import { useEffect, useState } from "react";
import { inventoryQrDataUrl } from "@/lib/qr";

export type QrLabel = {
  id: number;
  token: string;
  nama: string;
  lokasi: string;
  satuan: string;
};

// QR images are generated in the browser: doing hundreds of them on the
// server blocks the (single-process) Next.js server for every other request.
export function QrLabelGrid({ labels }: { labels: QrLabel[] }) {
  const [images, setImages] = useState<Record<number, string>>({});

  useEffect(() => {
    let cancelled = false;
    const origin = window.location.origin;
    Promise.all(
      labels.map(async (l) => [l.id, await inventoryQrDataUrl(l.token, origin, 180)] as const),
    ).then((entries) => {
      if (!cancelled) setImages(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [labels]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 print:grid-cols-3">
      {labels.map((l) => (
        <div
          key={l.id}
          className="bg-white text-black border border-black/10 rounded p-2 text-center text-xs break-inside-avoid"
        >
          {images[l.id] ? (
            // eslint-disable-next-line @next/next/no-img-element -- data: URL, no benefit from next/image
            <img src={images[l.id]} alt="" className="mx-auto" width={180} height={180} />
          ) : (
            <div className="mx-auto h-[180px] w-[180px] bg-zinc-100" />
          )}
          <p className="font-medium mt-1">{l.nama}</p>
          <p className="text-zinc-600">{l.lokasi}</p>
          <p className="text-zinc-500">{l.satuan}</p>
        </div>
      ))}
    </div>
  );
}
