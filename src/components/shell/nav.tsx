"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BuildingIcon,
  HistoryIcon,
  LayoutDashboardIcon,
  PackageIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  QrCodeIcon,
  ScanLineIcon,
  UsersIcon,
} from "@/components/icons";
import { LogoMark } from "@/components/Logo";
import type { ProfileRole } from "@/lib/types";

// Desktop sidebar only — phones get the input flow (/input) without a menu.
// Master-only items are a convenience: those pages and the database both
// check the role themselves.
function navItems(role: ProfileRole) {
  return [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
    { href: "/stok", label: "Data Stok", icon: PackageIcon },
    { href: "/input", label: role === "manager" ? "Lihat Stok" : "Input Data", icon: ScanLineIcon },
    { href: "/riwayat", label: "Riwayat", icon: HistoryIcon },
    { href: "/dashboard/labels", label: "Label QR", icon: QrCodeIcon },
    ...(role === "master"
      ? [
          { href: "/users", label: "Pengguna", icon: UsersIcon },
          { href: "/master-data", label: "Data Master", icon: BuildingIcon },
        ]
      : []),
  ];
}

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  // Scanning and the item page (/i/...) are steps of the input flow.
  if (href === "/input") return ["/input", "/scan", "/i/"].some((p) => pathname.startsWith(p));
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
export function Sidebar({ role }: { role: ProfileRole }) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-4 hidden h-[calc(100dvh-2rem)] w-64 shrink-0 flex-col rounded-2xl border border-border bg-surface p-4 transition-[width] duration-200 lg:flex sidebar-collapsed:w-[76px] sidebar-collapsed:px-3 print:hidden">
      <div className="flex items-center justify-between gap-2 pb-6 pl-2 pt-1 sidebar-collapsed:flex-col sidebar-collapsed:gap-3 sidebar-collapsed:pl-0">
        <span className="flex min-w-0 items-center gap-2.5 font-semibold tracking-tight">
          {/* Collapsed, the rail is ~52px wide: the mark shrinks to fit. */}
          <LogoMark className="h-7 sidebar-collapsed:h-5" height={28} />
          <span className="whitespace-nowrap sidebar-collapsed:hidden">Stock RSBB</span>
        </span>
        <button
          type="button"
          onClick={toggleSidebar}
          title="Ciutkan / perluas menu"
          className="grid size-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
        >
          <PanelLeftCloseIcon className="size-[18px] sidebar-collapsed:hidden" />
          <PanelLeftOpenIcon className="hidden size-[18px] sidebar-collapsed:block" />
          <span className="sr-only sidebar-collapsed:hidden">Ciutkan menu</span>
          <span className="sr-only hidden sidebar-collapsed:inline">Perluas menu</span>
        </button>
      </div>

      <nav className="flex flex-col gap-1">
        {navItems(role).map(({ href, label, icon: Icon }) => {
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
    </aside>
  );
}
