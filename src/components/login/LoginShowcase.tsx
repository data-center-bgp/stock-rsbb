"use client";

import { useEffect, useState } from "react";
import { PackageIcon, ScanLineIcon } from "@/components/icons";

const SLIDES = [
  {
    title: "Satu Sistem untuk Stok di Semua Unit",
    body: "Pantau stok seluruh gudang dan unit dari satu dashboard, tanpa lagi menggabungkan puluhan file spreadsheet.",
  },
  {
    title: "Scan QR, Catat dalam Hitungan Detik",
    body: "Pindai label QR di rak untuk mencatat barang masuk dan keluar — tetap bisa dipakai saat sinyal hilang.",
  },
  {
    title: "Stock Opname Tanpa Rekap Manual",
    body: "Hasil hitung fisik langsung dibandingkan dengan stok sistem, dan selisihnya terhitung otomatis.",
  },
];

const SLIDE_MS = 6000;

// Illustrative sample content for the preview cards (not live data).
const STOCK_ROWS = [
  { name: "Paracetamol 500 mg", unit: "Tablet", qty: "1.240", level: 82 },
  { name: "Amoxicillin 500 mg", unit: "Kapsul", qty: "860", level: 64 },
  { name: "Ringer Laktat 500 ml", unit: "Botol", qty: "32", level: 14 },
];

const TRANSACTIONS = [
  { label: "Masuk · Procurement", qty: "+120", positive: true, time: "08:12" },
  { label: "Keluar · ke unit lain", qty: "−24", positive: false, time: "09:40" },
  { label: "Masuk · Retur", qty: "+6", positive: true, time: "10:05" },
];

function GlassCard({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={`absolute rounded-2xl border border-white/15 bg-white/10 p-1.5 shadow-[0_24px_48px_-16px_rgb(0_0_0/0.45)] backdrop-blur-sm ${className}`}
    >
      <div className="rounded-xl bg-surface p-3.5 text-foreground">{children}</div>
    </div>
  );
}

function PreviewCards() {
  return (
    <div className="relative mx-auto h-[350px] w-full max-w-[540px]" aria-hidden="true">
      <GlassCard className="left-0 top-0 z-10 w-[60%]">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold">Stok Saat Ini</p>
          <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] text-muted">Semua unit</span>
        </div>
        <p className="mt-2 text-2xl font-semibold tracking-tight">
          851 <span className="text-xs font-normal text-muted">item aktif</span>
        </p>
        <ul className="mt-3 flex flex-col gap-2.5">
          {STOCK_ROWS.map((row) => (
            <li key={row.name}>
              <div className="flex items-baseline justify-between gap-2 text-[11px]">
                <span className="truncate font-medium">{row.name}</span>
                <span className="shrink-0 text-muted">
                  {row.qty} {row.unit}
                </span>
              </div>
              <div className="mt-1 h-1 rounded-full bg-surface-muted">
                <div
                  className={`h-full rounded-full ${row.level < 20 ? "bg-amber-500" : "bg-primary"}`}
                  style={{ width: `${row.level}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </GlassCard>

      <GlassCard className="right-0 top-[12%] z-20 w-[48%]">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold">Stock Opname</p>
          <span className="text-[10px] text-muted">Hari ini</span>
        </div>
        <p className="mt-1 text-[11px] text-muted">LOGISTIK FARMASI</p>
        <div className="mt-3 flex items-baseline justify-between text-[11px]">
          <span className="font-medium">612 / 851 dihitung</span>
          <span className="font-semibold text-primary">72%</span>
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-surface-muted">
          <div className="h-full w-[72%] rounded-full bg-primary" />
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-surface-muted px-2.5 py-2 text-[11px]">
          <span className="truncate text-muted">Selisih</span>
          <span className="shrink-0 whitespace-nowrap rounded-full bg-amber-500/15 px-2 py-0.5 font-semibold text-amber-600 dark:text-amber-400">
            3 item
          </span>
        </div>
      </GlassCard>

      <GlassCard className="bottom-0 left-[14%] z-30 w-[52%]">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold">Transaksi Terakhir</p>
          <ScanLineIcon className="size-3.5 text-muted" />
        </div>
        <ul className="mt-2.5 flex flex-col divide-y divide-border">
          {TRANSACTIONS.map((tx) => (
            <li key={tx.label} className="flex items-center justify-between py-1.5 text-[11px]">
              <span>
                <span className="block font-medium">{tx.label}</span>
                <span className="text-[10px] text-muted">{tx.time}</span>
              </span>
              <span
                className={`font-semibold ${tx.positive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
              >
                {tx.qty}
              </span>
            </li>
          ))}
        </ul>
      </GlassCard>
    </div>
  );
}

export function LoginShowcase() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setTimeout(() => setIndex((i) => (i + 1) % SLIDES.length), SLIDE_MS);
    return () => clearTimeout(id);
  }, [index]);

  return (
    <section className="relative hidden flex-col overflow-hidden rounded-2xl bg-[linear-gradient(160deg,#0f5f66_0%,#0a4449_45%,#072f33_100%)] p-8 text-white lg:flex xl:p-10">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.07)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_80%_65%_at_50%_30%,#000_40%,transparent_100%)]" />
      <div className="pointer-events-none absolute -top-40 left-1/2 size-[480px] -translate-x-1/2 rounded-full bg-[#2bb5bd]/20 blur-3xl" />

      <div className="relative flex flex-1 flex-col justify-center gap-8">
        <PreviewCards />

        <div className="flex flex-col items-center text-center">
          <span className="grid size-14 place-items-center rounded-2xl border border-white/20 bg-linear-to-b from-[#1b8f96] to-[#0f6a70] shadow-[0_12px_32px_-8px_rgb(0_0_0/0.5)]">
            <PackageIcon className="size-7" />
          </span>

          <div className="mt-6 grid max-w-md">
            {SLIDES.map((slide, i) => (
              <div
                key={slide.title}
                aria-hidden={i !== index}
                className={`[grid-area:1/1] transition-opacity duration-500 ${i === index ? "opacity-100" : "opacity-0"}`}
              >
                <h2 className="text-balance text-3xl font-semibold tracking-tight">{slide.title}</h2>
                <p className="mt-3 text-pretty text-sm leading-relaxed text-white/70">{slide.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="relative mt-8 flex gap-2">
        {SLIDES.map((slide, i) => (
          <button
            key={slide.title}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Tampilkan: ${slide.title}`}
            aria-current={i === index}
            className="flex-1 py-2"
          >
            <span className="block h-1 overflow-hidden rounded-full bg-white/20">
              <span
                key={`${index}-${i}`}
                className={`block h-full rounded-full bg-white ${
                  i < index
                    ? "w-full"
                    : i === index
                      ? "animate-[slide-progress_6s_linear_forwards] motion-reduce:w-full motion-reduce:animate-none"
                      : "w-0"
                }`}
              />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
