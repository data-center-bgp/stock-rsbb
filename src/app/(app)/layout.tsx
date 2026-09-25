import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatLongDate } from "@/lib/dates";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MobileNav, Sidebar } from "@/components/shell/nav";
import { UserMenu } from "@/components/shell/UserMenu";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // First visit creates the user's own profile (see 0004_profiles.sql for why
  // this isn't a trigger on auth.users). Errors are ignored so the app still
  // works before that migration has been run.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile && !profileError) {
    await supabase.from("profiles").insert({ id: user.id });
  }

  return (
    <div className="flex flex-1 bg-background lg:gap-4 lg:p-4 print:block print:p-0">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-4 border-b border-border px-4 lg:h-14 lg:px-1 print:hidden">
          <div className="lg:hidden">
            <Logo />
          </div>
          <p className="hidden text-sm text-muted lg:block">{formatLongDate()}</p>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserMenu name={profile?.full_name ?? null} email={user.email ?? ""} />
          </div>
        </header>

        <main className="flex-1 px-4 pb-28 pt-6 lg:px-1 lg:pb-4 print:p-0">{children}</main>
      </div>

      <MobileNav />
    </div>
  );
}
