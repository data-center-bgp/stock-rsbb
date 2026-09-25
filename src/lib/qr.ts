import QRCode from "qrcode";

// Used on the web dashboard to print/export labels: one QR per Inventory
// row (item at a specific unit + location), encoding a URL the mobile PWA
// resolves straight to that item's input screen.
export function inventoryScanUrl(qrToken: string, origin: string) {
  return `${origin}/i/${qrToken}`;
}

export async function inventoryQrDataUrl(qrToken: string, origin: string, width = 300) {
  // margin 4 = the QR spec's quiet zone. Anything smaller fails to scan when
  // the label is shown on a dark background (e.g. a screen in dark mode).
  return QRCode.toDataURL(inventoryScanUrl(qrToken, origin), { margin: 4, width });
}
