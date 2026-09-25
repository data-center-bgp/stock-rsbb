import { PackageIcon } from "@/components/icons";

export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <span
      className={`grid place-items-center rounded-lg bg-linear-to-b from-primary to-primary-strong text-primary-foreground ${className}`}
    >
      <PackageIcon className="size-[55%]" />
    </span>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2.5 font-semibold tracking-tight">
      <LogoMark />
      Stock RSBB
    </span>
  );
}
