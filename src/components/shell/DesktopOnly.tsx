"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SpinnerIcon } from "@/components/icons";

// Phones are for data input only: desktop pages (dashboard, labels, users,
// data master) send them to /input. Same breakpoint as the sidebar (lg).
// Checked once on load, so resizing a desktop window doesn't bounce you.
export function DesktopOnly({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (!matchMedia("(min-width: 1024px)").matches) router.replace("/input");
  }, [router]);

  return (
    <>
      <div className="hidden lg:block">{children}</div>
      <p className="flex items-center justify-center gap-2 py-24 text-sm text-muted lg:hidden">
        <SpinnerIcon className="size-4" /> Membuka Input Data...
      </p>
    </>
  );
}
