export const STOCK_PAGE_SIZE = 25;

// Everything Data Stok keeps in the URL, for both tabs.
export type StockSearchParams = {
  tab?: string;
  q?: string;
  status?: string;
  unit?: string; // Per Inventori: one inventory
  sebaran?: string; // Semua Stok: "unit" = only items that are in a unit
  page?: string;
};

export function stockHref(params: StockSearchParams, page: number) {
  const next = new URLSearchParams(
    Object.entries(params).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
  next.set("page", String(page));
  return `/stok?${next.toString()}`;
}

export function parseStockParams(params: StockSearchParams) {
  return {
    q: (params.q ?? "").trim().slice(0, 100),
    status: params.status === "habis" || params.status === "tersedia" ? params.status : null,
    unit: /^\d+$/.test(params.unit ?? "") ? params.unit! : null,
    sebaran: params.sebaran === "unit" ? ("unit" as const) : null,
    page: Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1),
  };
}

// Escape LIKE wildcards so a typed % or _ matches literally.
export const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, "\\$&")}%`;
