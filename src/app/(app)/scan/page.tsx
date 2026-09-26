import { parseInputMode } from "@/lib/input-mode";
import { ScanScreen } from "@/components/scan/ScanScreen";

export default async function ScanPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams;
  return <ScanScreen mode={parseInputMode(mode)} />;
}
