// The ways of recording stock, chosen on /input before scanning and carried
// through /scan?mode=... to /i/[token]?mode=... Pemakaian is a hospital
// unit's Mutasi: the unit only records what it uses.
export type InputMode = "mutasi" | "opname" | "pemakaian";

export const INPUT_MODE_LABELS: Record<InputMode, string> = {
  mutasi: "Mutasi",
  opname: "Stock Opname",
  pemakaian: "Pemakaian",
};

export function parseInputMode(value: string | string[] | undefined): InputMode | null {
  return value === "mutasi" || value === "opname" || value === "pemakaian" ? value : null;
}

export function scanHref(mode: InputMode | null) {
  return mode ? `/scan?mode=${mode}` : "/scan";
}

// Stock Opname and Pemakaian start here (scan or search), not straight at the scanner.
export const OPNAME_HOME = "/opname";
export const USAGE_HOME = "/pemakaian";

/** Where each mode starts: the scanner for Mutasi, the scan-or-search page for the others. */
export function modeHome(mode: InputMode | null) {
  if (mode === "opname") return OPNAME_HOME;
  if (mode === "pemakaian") return USAGE_HOME;
  return scanHref(mode);
}
