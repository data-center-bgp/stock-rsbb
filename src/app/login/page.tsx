import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LoginForm } from "@/components/login/LoginForm";
import { LoginShowcase } from "@/components/login/LoginShowcase";

export const metadata: Metadata = {
  title: "Masuk — Stock RSBB",
};

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <main className="flex flex-1 bg-background lg:p-4">
      <div className="mx-auto grid w-full max-w-[1440px] flex-1 lg:grid-cols-2 lg:gap-3 lg:rounded-[28px] lg:bg-surface lg:p-3 lg:shadow-[0_1px_2px_rgb(15_31_36/0.04),0_16px_48px_-16px_rgb(15_31_36/0.14)]">
        <section className="flex flex-col bg-surface px-5 py-6 sm:px-10 lg:rounded-2xl lg:border lg:border-border">
          <header className="flex items-center justify-between">
            <Logo />
            <ThemeToggle />
          </header>

          <div className="flex flex-1 items-center justify-center py-12">
            <div className="w-full max-w-sm">
              <div className="mb-8 text-center">
                <h1 className="text-balance text-2xl font-semibold tracking-tight sm:text-[28px]">
                  Selamat datang di Stock RSBB
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Masuk dengan akun yang diberikan admin untuk mulai mencatat stok.
                </p>
              </div>
              <LoginForm />
            </div>
          </div>

          <footer className="text-center text-xs text-muted">
            © {new Date().getFullYear()} Stock RSBB. Hak cipta dilindungi.
          </footer>
        </section>

        <LoginShowcase />
      </div>
    </main>
  );
}
