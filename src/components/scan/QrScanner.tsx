"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui";
import type { InputMode } from "@/lib/input-mode";

// Our labels encode `<origin>/i/<qr_token>`. Accept that (from any origin —
// labels may have been printed from localhost or another host) or a bare
// token; anything else isn't one of our labels.
function tokenPathFrom(decodedText: string): string | null {
  try {
    const url = new URL(decodedText);
    return url.pathname.startsWith("/i/") ? url.pathname : null;
  } catch {
    return /^[0-9a-f-]{36}$/i.test(decodedText.trim()) ? `/i/${decodedText.trim()}` : null;
  }
}

export function QrScanner({ mode }: { mode: InputMode | null }) {
  const router = useRouter();
  const [status, setStatus] = useState<{ tone: "success" | "warning"; text: string } | null>(null);

  useEffect(() => {
    let scanner: import("html5-qrcode").Html5QrcodeScanner | undefined;
    let cancelled = false;
    let handled = false;

    import("html5-qrcode").then(({ Html5QrcodeScanner, Html5QrcodeSupportedFormats }) => {
      // Effects run twice in dev (React Strict Mode): mount, cleanup, mount
      // again on the same component instance. If the first run's cleanup
      // already fired by the time this import resolves, don't initialize
      // into a scanner nobody will tear down.
      if (cancelled) return;
      scanner = new Html5QrcodeScanner(
        "qr-reader",
        {
          fps: 10,
          qrbox: (width, height) => {
            const size = Math.floor(Math.min(width, height) * 0.7);
            return { width: size, height: size };
          },
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          // The phone's native BarcodeDetector (Android Chrome) reads far
          // more reliably than the JS fallback, especially off a screen.
          useBarCodeDetectorIfSupported: true,
          rememberLastUsedCamera: true,
        },
        false,
      );
      scanner.render(
        (decodedText) => {
          if (handled) return;
          const path = tokenPathFrom(decodedText);
          if (!path) {
            setStatus({ tone: "warning", text: "QR terbaca, tapi bukan label Stock RSBB." });
            return;
          }
          handled = true;
          setStatus({ tone: "success", text: "QR terbaca, membuka item..." });
          scanner?.clear().catch(() => {});
          router.push(mode ? `${path}?mode=${mode}` : path);
        },
        () => {
          // Per-frame decode miss while aiming the camera — expected, ignore.
        },
      );
    });

    return () => {
      cancelled = true;
      scanner?.clear().catch(() => {});
    };
  }, [router, mode]);

  return (
    <div className="flex flex-col gap-3">
      <div id="qr-reader" />
      {status && <Alert tone={status.tone}>{status.text}</Alert>}
    </div>
  );
}
