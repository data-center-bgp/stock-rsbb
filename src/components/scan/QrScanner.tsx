"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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

export function QrScanner() {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);

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
            setStatus("QR terbaca, tapi bukan label Stock RSBB.");
            return;
          }
          handled = true;
          setStatus("QR terbaca, membuka item...");
          scanner?.clear().catch(() => {});
          router.push(path);
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
  }, [router]);

  return (
    <div>
      <div id="qr-reader" />
      {status && <p className="mt-3 text-sm font-medium">{status}</p>}
    </div>
  );
}
