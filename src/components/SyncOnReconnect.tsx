"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { flushOfflineQueue } from "@/lib/offline/sync";

// Mounted once in the root layout. Flushes anything queued while offline
// as soon as the app has a connection again (on load, and on "online").
export function SyncOnReconnect() {
  useEffect(() => {
    // Supabase isn't configured yet (e.g. .env.local not set up) — nothing
    // to sync to, and creating the client would throw.
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return;
    }

    const supabase = createClient();
    const sync = () => {
      flushOfflineQueue(supabase).catch(() => {
        // Best-effort — retried on the next reconnect or mount.
      });
    };

    sync();
    window.addEventListener("online", sync);
    return () => window.removeEventListener("online", sync);
  }, []);

  return null;
}
