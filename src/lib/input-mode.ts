// The two ways of recording stock, chosen on /input before scanning and
// carried through /scan?mode=... to /i/[token]?mode=...
export type InputMode = "mutasi" | "opname";

export const INPUT_MODE_LABELS: Record<InputMode, string> = {
  mutasi: "Mutasi",
  opname: "Stock Opname",
};

export function parseInputMode(value: string | string[] | undefined): InputMode | null {
  return value === "mutasi" || value === "opname" ? value : null;
}

export function scanHref(mode: InputMode | null) {
  return mode ? `/scan?mode=${mode}` : "/scan";
}

// Stock Opname starts here (scan or search), not straight at the scanner.
export const OPNAME_HOME = "/opname";

/** Where each mode starts: the scanner for Mutasi, the scan-or-search page for Opname. */
export function modeHome(mode: InputMode | null) {
  return mode === "opname" ? OPNAME_HOME : scanHref(mode);
}
