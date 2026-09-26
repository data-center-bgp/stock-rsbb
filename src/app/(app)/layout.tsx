import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, ROLE_LABELS } from "@/lib/session";
import { formatLongDate } from "@/lib/dates";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ClockIcon } from "@/components/icons";
import { Sidebar } from "@/components/shell/nav";
import { UserMenu } from "@/components/shell/UserMenu";
import { cardClass } from "@/components/ui";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await getSession();
  if (!user) redirect("/login");

  const email = user.email ?? "";

  // Signed in, but a master hasn't approved this account yet. The database
  // returns nothing for them anyway; this just explains why.
  if (!profile?.role) {
    return (
      <div className="flex flex-1 flex-col bg-background">
        <header className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserMenu name={profile?.full_name ?? null} email={email} />
          </div>
        </header>
        <main className="flex flex-1 items-center justify-center px-4 pb-16">
          <div className={`${cardClass} w-full max-w-md px-6 py-10 text-center`}>
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <ClockIcon className="size-6" />
            </span>
            <h1 className="mt-4 text-lg font-semibold tracking-tight">Menunggu persetujuan</h1>
            <p className="mt-2 text-balance text-sm text-muted">
              Akun <span className="font-medium text-foreground">{email}</span> sudah terdaftar, tapi belum diberi
              akses ke Stock RSBB. Hubungi admin untuk mengaktifkan akun Anda.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const roleDetail =
    profile.role === "staff" && profile.unit
      ? `${ROLE_LABELS.staff} · ${profile.unit.nama_gudang}`
      : ROLE_LABELS[profile.role];

  return (
    <div className="flex flex-1 bg-background lg:gap-4 lg:p-4 print:block print:p-0">
      <Sidebar role={profile.role} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-4 border-b border-border px-4 lg:h-14 lg:px-1 print:hidden">
          {/* Phones have no menu: the logo is the way back to the input home. */}
          <Link href="/input" className="lg:hidden">
            <Logo />
          </Link>
          <p className="hidden text-sm text-muted lg:block">{formatLongDate()}</p>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserMenu name={profile.full_name} email={email} detail={roleDetail} />
          </div>
        </header>

        <main className="flex-1 px-4 pb-10 pt-6 lg:px-1 lg:pb-4 print:p-0">{children}</main>
      </div>
    </div>
  );
}
