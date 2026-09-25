"use client";

import { useEffect } from "react";
import { MoonIcon, SunIcon } from "@/components/icons";

function hasSavedTheme() {
  try {
    return localStorage.getItem("theme") !== null;
  } catch {
    return false;
  }
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  // Until the user picks a theme, keep following the system setting.
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => {
      if (!hasSavedTheme()) document.documentElement.classList.toggle("dark", e.matches);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  function toggle() {
    const dark = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch {
      // Private mode etc. — the toggle still works for this page view.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Ganti tema terang/gelap"
      title="Ganti tema terang/gelap"
      className={`grid size-9 place-items-center rounded-lg border border-border text-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${className}`}
    >
      {/* Icons swap purely via CSS, so there's no hydration mismatch with the pre-paint theme script. */}
      <MoonIcon className="size-4 dark:hidden" />
      <SunIcon className="hidden size-4 dark:block" />
    </button>
  );
}
