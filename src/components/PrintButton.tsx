"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded bg-black px-4 py-2 text-sm text-white print:hidden"
    >
      Cetak
    </button>
  );
}
