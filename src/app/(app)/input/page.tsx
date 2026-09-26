import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { getSession } from "@/lib/session";
import { scanHref } from "@/lib/input-mode";
import { ArrowLeftRightIcon, ArrowRightIcon, ClipboardCheckIcon, EyeIcon } from "@/components/icons";
import { PageHeader, cardClass } from "@/components/ui";

export const metadata: Metadata = { title: "Input Data — Stock RSBB" };

function ModeCard({
  href,
  icon,
  tone,
  title,
  description,
}: {
  href: string;
  icon: ReactNode;
  tone: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className={`${cardClass} group flex items-center gap-4 p-5 transition-colors hover:border-primary/40 active:bg-surface-muted`}
    >
      <span className={`grid size-14 shrink-0 place-items-center rounded-2xl ${tone}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-semibold tracking-tight">{title}</span>
        <span className="mt-0.5 block text-sm text-muted">{description}</span>
      </span>
      <ArrowRightIcon className="size-5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  );
}

export default async function InputPage() {
  const { profile } = await getSession();
  const canInput = profile?.role === "master" || profile?.role === "staff";
  const inventoryName = profile?.role === "staff" ? profile.unit?.nama_gudang : null;

  return (
    <div className="mx-auto w-full max-w-lg">
      <PageHeader
        title="Input Data"
        description={
          canInput
            ? `Pilih jenis pencatatan, lalu scan item satu per satu${inventoryName ? ` di ${inventoryName}` : ""}.`
            : "Akun manajer hanya dapat melihat data."
        }
      />

      <div className="flex flex-col gap-3">
        {canInput ? (
          <>
            <ModeCard
              href={scanHref("mutasi")}
              icon={<ArrowLeftRightIcon className="size-7" />}
              tone="bg-primary/12 text-primary"
              title="Mutasi"
              description="Catat barang masuk (penerimaan, retur dari unit) dan keluar (pengiriman, retur, pemusnahan)."
            />
            <ModeCard
              href={scanHref("opname")}
              icon={<ClipboardCheckIcon className="size-7" />}
              tone="bg-amber-500/15 text-amber-600 dark:text-amber-400"
              title="Stock Opname"
              description="Hitung stok fisik dan catat selisihnya dengan stok sistem."
            />
          </>
        ) : (
          <ModeCard
            href={scanHref(null)}
            icon={<EyeIcon className="size-7" />}
            tone="bg-sky-500/12 text-sky-600 dark:text-sky-400"
            title="Lihat Stok"
            description="Scan label item untuk melihat stoknya."
          />
        )}
      </div>
    </div>
  );
}
