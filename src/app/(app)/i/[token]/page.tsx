import { getSession } from "@/lib/session";
import { ItemScreen } from "@/components/scan/ItemScreen";

export default async function ItemPage({ params }: { params: Promise<{ token: string }> }) {
  const [{ token }, { profile }] = await Promise.all([params, getSession()]);
  return <ItemScreen token={token} canInput={profile?.role === "master" || profile?.role === "staff"} />;
}
