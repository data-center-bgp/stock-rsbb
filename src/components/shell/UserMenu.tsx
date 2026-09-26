"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogOutIcon, SpinnerIcon } from "@/components/icons";

export function UserMenu({
  name,
  email,
  detail,
}: {
  name: string | null;
  email: string;
  /** Role (and unit, for staff), shown under the name. */
  detail?: string;
}) {
  const displayName = name?.trim() || email;
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <div className="hidden items-center gap-2.5 rounded-xl border border-border bg-surface py-1 pl-1.5 pr-3 sm:flex">
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/12 text-xs font-semibold uppercase text-primary">
          {displayName.charAt(0)}
        </span>
        <span className="flex min-w-0 flex-col leading-tight" title={email}>
          <span className="max-w-48 truncate text-sm">{displayName}</span>
          {detail && <span className="max-w-48 truncate text-[11px] text-muted">{detail}</span>}
        </span>
      </div>
      <button
        type="button"
        onClick={signOut}
        disabled={signingOut}
        title="Keluar"
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-danger/30 bg-danger/8 px-2.5 text-sm font-medium text-danger transition-colors hover:border-danger/50 hover:bg-danger/15 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger sm:px-3"
      >
        {signingOut ? <SpinnerIcon className="size-4" /> : <LogOutIcon className="size-4" />}
        <span className="sr-only sm:not-sr-only">Keluar</span>
      </button>
    </div>
  );
}
