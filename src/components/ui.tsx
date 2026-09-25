// Shared styling so every page matches the login design. Base classes carry
// no size or padding: two conflicting utilities (e.g. h-10 and h-11) resolve
// by stylesheet order, not class order, so callers set those themselves.
import type { ReactNode } from "react";
import { AlertCircleIcon, CheckCircleIcon } from "@/components/icons";

export const fieldClass =
  "rounded-xl border border-border bg-surface text-sm text-foreground placeholder:text-muted/70 outline-none transition-[border-color,box-shadow] focus:border-primary focus:ring-4 focus:ring-primary/15";

/** Standard full-width, 44px-tall text input (add horizontal padding). */
export const inputClass = `${fieldClass} h-11 w-full`;

export const primaryButtonClass =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-linear-to-b from-primary to-primary-strong px-4 text-sm font-semibold text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.15),0_8px_20px_-8px_var(--primary)] transition-[filter,transform] hover:brightness-110 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/** Outline button; the caller sets height and horizontal padding. */
export const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface font-medium text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-disabled:pointer-events-none aria-disabled:opacity-50";

export const cardClass = "rounded-2xl border border-border bg-surface";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

const alertTones = {
  success: "border-emerald-500/25 bg-emerald-500/8 text-emerald-700 dark:text-emerald-400",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  danger: "border-danger/25 bg-danger/8 text-danger",
};

export function Alert({ tone, children }: { tone: keyof typeof alertTones; children: ReactNode }) {
  const Icon = tone === "success" ? CheckCircleIcon : AlertCircleIcon;
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm ${alertTones[tone]}`}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function StockStatus({ qty }: { qty: number }) {
  return qty > 0 ? (
    <span className="inline-flex rounded-full bg-emerald-500/12 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
      Tersedia
    </span>
  ) : (
    <span className="inline-flex rounded-full bg-rose-500/12 px-2.5 py-0.5 text-xs font-medium text-rose-700 dark:text-rose-400">
      Habis
    </span>
  );
}
