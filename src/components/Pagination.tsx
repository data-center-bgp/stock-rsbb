import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { secondaryButtonClass } from "@/components/ui";

const numberFormat = new Intl.NumberFormat("id-ID");

// "Menampilkan 1–25 dari 80 <noun>" plus previous/next links.
export function Pagination({
  page,
  pageSize,
  total,
  noun,
  href,
}: {
  page: number;
  pageSize: number;
  total: number;
  noun: string;
  href: (page: number) => string;
}) {
  if (total <= 0) return null;
  const from = (page - 1) * pageSize;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3.5 text-sm">
      <p className="text-muted">
        Menampilkan {numberFormat.format(from + 1)}–{numberFormat.format(Math.min(from + pageSize, total))} dari{" "}
        {numberFormat.format(total)} {noun}
      </p>
      <div className="flex items-center gap-2">
        <Link
          href={href(page - 1)}
          aria-disabled={page <= 1}
          tabIndex={page <= 1 ? -1 : undefined}
          aria-label="Halaman sebelumnya"
          className={`${secondaryButtonClass} h-9 px-2.5`}
        >
          <ChevronLeftIcon className="size-4" />
        </Link>
        <span className="tabular-nums text-muted">
          {page} / {lastPage}
        </span>
        <Link
          href={href(page + 1)}
          aria-disabled={page >= lastPage}
          tabIndex={page >= lastPage ? -1 : undefined}
          aria-label="Halaman berikutnya"
          className={`${secondaryButtonClass} h-9 px-2.5`}
        >
          <ChevronRightIcon className="size-4" />
        </Link>
      </div>
    </div>
  );
}
