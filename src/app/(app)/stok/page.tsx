import type { Metadata } from "next";
import { getSession } from "@/lib/session";
import { AllStock } from "@/components/stock/AllStock";
import { InventoryStock } from "@/components/stock/InventoryStock";
import { StockTabs } from "@/components/stock/StockTabs";
import type { StockSearchParams } from "@/components/stock/params";
import { DesktopOnly } from "@/components/shell/DesktopOnly";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Data Stok — Stock RSBB" };

// Master and manager see two views: Semua Stok (each item summed over every
// inventory) and Per Inventori (one row per inventory). Staff only ever get
// their own inventory's rows back (RLS), so they just get Per Inventori.
export default async function StockPage({ searchParams }: { searchParams: Promise<StockSearchParams> }) {
  const params = await searchParams;
  const { supabase, profile } = await getSession();
  const staffUnit = profile?.role === "staff" ? (profile.unit?.nama_gudang ?? "inventori Anda") : null;
  const tab = staffUnit || params.tab === "inventori" ? "inventori" : "semua";

  return (
    <DesktopOnly>
      <PageHeader
        title="Data Stok"
        description={staffUnit ? `Stok terkini di ${staffUnit}.` : "Stok terkini di semua inventori."}
      />
      {!staffUnit && <StockTabs tab={tab} />}
      {tab === "semua" ? (
        <AllStock supabase={supabase} params={params} />
      ) : (
        <InventoryStock supabase={supabase} params={params} />
      )}
    </DesktopOnly>
  );
}
