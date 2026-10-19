import Link from "next/link";

export type StockTab = "semua" | "inventori";

const TABS: { value: StockTab; label: string }[] = [
  { value: "semua", label: "Semua Stok" },
  { value: "inventori", label: "Per Inventori" },
];

// Sub menus of Data Stok. Each tab has its own filters, so switching starts clean.
export function StockTabs({ tab }: { tab: StockTab }) {
  return (
    <nav
      aria-label="Tampilan data stok"
      className="mb-5 inline-grid grid-cols-2 gap-1 rounded-xl border border-border bg-surface-muted p-1"
    >
      {TABS.map((t) => (
        <Link
          key={t.value}
          href={`/stok?tab=${t.value}`}
          aria-current={tab === t.value ? "page" : undefined}
          className={`rounded-lg px-4 py-2 text-center text-sm transition-colors ${
            tab === t.value
              ? "bg-surface font-semibold text-primary shadow-sm ring-1 ring-border"
              : "font-medium text-muted hover:text-foreground"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
