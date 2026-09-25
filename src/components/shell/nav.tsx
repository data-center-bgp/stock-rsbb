"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboardIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  QrCodeIcon,
  ScanLineIcon,
} from "@/components/icons";
import { LogoMark } from "@/components/Logo";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/scan", label: "Scan QR", icon: ScanLineIcon },
  { href: "/dashboard/labels", label: "Label QR", icon: QrCodeIcon },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  // An item page (/i/...) is where a scan lands, so it counts as "Scan QR".
  if (href === "/scan") return pathname === "/scan" || pathname.startsWith("/i/");
  return pathname.startsWith(href);
}

function toggleSidebar() {
  const root = document.documentElement;
  const collapse = root.dataset.sidebar !== "collapsed";
  if (collapse) root.dataset.sidebar = "collapsed";
  else delete root.dataset.sidebar;
  try {
    localStorage.setItem("sidebar", collapse ? "collapsed" : "expanded");
  } catch {
    // Private mode etc. — still toggles for this page view.
  }
}

// Collapsed/expanded is driven purely by a data attribute on <html> (see the
// `sidebar-collapsed` variant), so there's no React state to mismatch with
// the pre-paint script.
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-4 hidden h-[calc(100dvh-2rem)] w-64 shrink-0 flex-col rounded-2xl border border-border bg-surface p-4 transition-[width] duration-200 lg:flex sidebar-collapsed:w-[76px] sidebar-collapsed:px-3 print:hidden">
      <div className="flex items-center gap-2.5 px-2 pb-6 pt-1 font-semibold tracking-tight sidebar-collapsed:justify-center sidebar-collapsed:px-0">
        <LogoMark />
        <span className="whitespace-nowrap sidebar-collapsed:hidden">Stock RSBB</span>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors sidebar-collapsed:justify-center sidebar-collapsed:px-0 ${
                active
                  ? "bg-linear-to-b from-primary to-primary-strong text-primary-foreground shadow-[0_8px_20px_-10px_var(--primary)]"
                  : "text-muted hover:bg-surface-muted hover:text-foreground"
              }`}
            >
              <Icon className="size-[18px] shrink-0" />
              <span className="whitespace-nowrap sidebar-collapsed:sr-only">{label}</span>
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={toggleSidebar}
        className="mt-auto flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary sidebar-collapsed:justify-center sidebar-collapsed:px-0"
      >
        <PanelLeftCloseIcon className="size-[18px] shrink-0 sidebar-collapsed:hidden" />
        <PanelLeftOpenIcon className="hidden size-[18px] shrink-0 sidebar-collapsed:block" />
        <span className="whitespace-nowrap sidebar-collapsed:hidden">Ciutkan menu</span>
        <span className="sr-only hidden sidebar-collapsed:inline">Perluas menu</span>
      </button>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden print:hidden">
      <div className="mx-auto grid max-w-md grid-cols-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          const isScan = href === "/scan";
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-1 py-2 text-[11px] font-medium ${active ? "text-primary" : "text-muted"}`}
            >
              {isScan ? (
                <span className="-mt-5 grid size-12 place-items-center rounded-2xl bg-linear-to-b from-primary to-primary-strong text-primary-foreground shadow-[0_10px_24px_-8px_var(--primary)]">
                  <Icon className="size-6" />
                </span>
              ) : (
                <Icon className="size-5" />
              )}
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
