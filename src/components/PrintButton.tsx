"use client";

import { PrinterIcon } from "@/components/icons";
import { primaryButtonClass } from "@/components/ui";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={`${primaryButtonClass} print:hidden`}>
      <PrinterIcon className="size-4" />
      Cetak label
    </button>
  );
}
