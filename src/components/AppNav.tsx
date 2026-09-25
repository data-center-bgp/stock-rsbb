import Link from "next/link";

export function AppNav() {
  return (
    <nav className="flex items-center gap-4 border-b border-black/10 px-4 py-3 text-sm">
      <span className="font-semibold">Stock RSBB</span>
      <Link href="/dashboard" className="text-zinc-600 hover:text-black">
        Dashboard
      </Link>
      <Link href="/dashboard/labels" className="text-zinc-600 hover:text-black">
        Label QR
      </Link>
      <Link href="/scan" className="text-zinc-600 hover:text-black">
        Scan QR
      </Link>
    </nav>
  );
}
