"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { EyeIcon, EyeOffIcon, LockIcon, MailIcon, SpinnerIcon } from "@/components/icons";
import { Alert, inputClass, primaryButtonClass } from "@/components/ui";

function toFriendlyError(message: string) {
  if (/invalid login credentials/i.test(message)) return "Email atau password salah.";
  if (/email not confirmed/i.test(message)) return "Akun Anda belum dikonfirmasi. Hubungi admin.";
  if (/fetch|network/i.test(message)) return "Tidak dapat terhubung ke server. Periksa koneksi internet Anda.";
  return message;
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(toFriendlyError(error.message));
        setLoading(false);
        return;
      }
      // Phones are for data input; the dashboard is a desktop page.
      router.push(matchMedia("(min-width: 1024px)").matches ? "/dashboard" : "/input");
    } catch (err) {
      setError(toFriendlyError(err instanceof Error ? err.message : "Terjadi kesalahan."));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {error && <Alert tone="danger">{error}</Alert>}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          Email <span className="text-primary" aria-hidden="true">*</span>
        </label>
        <div className="relative">
          <MailIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            placeholder="nama@perusahaan.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`${inputClass} pl-10 pr-3.5`}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Password <span className="text-primary" aria-hidden="true">*</span>
        </label>
        <div className="relative">
          <LockIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="Masukkan password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${inputClass} pl-10 pr-11`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
            aria-pressed={showPassword}
            className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
          >
            {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className={`${primaryButtonClass} mt-1 w-full`}
      >
        {loading && <SpinnerIcon className="size-4" />}
        {loading ? "Masuk..." : "Masuk"}
      </button>

      <p className="text-balance text-center text-sm text-muted">
        Belum punya akun atau lupa password? Hubungi admin.
      </p>
    </form>
  );
}
