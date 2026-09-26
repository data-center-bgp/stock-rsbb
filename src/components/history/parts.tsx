import type { ReactNode } from "react";
import { ChevronDownIcon } from "@/components/icons";

export const numberFormat = new Intl.NumberFormat("id-ID");

/** +12 in green, −3 in red, 0 muted — with the item's unit. */
export function SignedQty({ value, unit, zeroLabel }: { value: number; unit?: string; zeroLabel?: string }) {
  if (value === 0 && zeroLabel)
    return <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{zeroLabel}</span>;
  const tone =
    value > 0 ? "text-emerald-700 dark:text-emerald-400" : value < 0 ? "text-rose-700 dark:text-rose-400" : "text-muted";
  return (
    <span className="whitespace-nowrap tabular-nums">
      <span className={`font-semibold ${tone}`}>
        {value > 0 ? "+" : value < 0 ? "−" : ""}
        {numberFormat.format(Math.abs(value))}
      </span>
      {unit && <span className="ml-1 text-xs text-muted">{unit}</span>}
    </span>
  );
}

/** A brief line that expands to the full details (native <details>, no JS). */
export function ExpandableRow({
  title,
  subtitle,
  aside,
  children,
}: {
  title: string;
  subtitle: string;
  aside: ReactNode;
  children: ReactNode;
}) {
  return (
    <li className="border-b border-border last:border-b-0">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 active:bg-surface-muted [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{title}</span>
            <span className="mt-0.5 block truncate text-xs text-muted">{subtitle}</span>
          </span>
          {aside}
          <ChevronDownIcon className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180" />
        </summary>
        <div className="px-4 pb-4">{children}</div>
      </details>
    </li>
  );
}

export function DetailList({ items }: { items: ({ label: string; value: ReactNode } | null)[] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl bg-surface-muted p-3 text-sm">
      {items
        .filter((i) => i !== null)
        .map((i) => (
          <div key={i.label} className="contents">
            <dt className="text-muted">{i.label}</dt>
            <dd className="min-w-0 break-words">{i.value}</dd>
          </div>
        ))}
    </dl>
  );
}
