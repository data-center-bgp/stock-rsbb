import { getSession } from "@/lib/session";
import { parseInputMode } from "@/lib/input-mode";
import { ItemScreen } from "@/components/scan/ItemScreen";

export default async function ItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const [{ token }, { mode }, { profile }] = await Promise.all([params, searchParams, getSession()]);
  return (
    <ItemScreen
      token={token}
      canInput={profile?.role === "master" || profile?.role === "staff"}
      initialMode={parseInputMode(mode)}
    />
  );
}
