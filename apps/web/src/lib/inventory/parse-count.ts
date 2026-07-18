/**
 * Split a trailing count off an item name: "Torches (3)" → { name: 'Torches', quantity: 3 }.
 * Only purely-numeric suffixes match — "(3)", "x3", "x 3", "×3" — so names like
 * "Potion (minor)" or "Horse Feed (per day)" pass through untouched.
 * Returns quantity: null when no count is present, so callers keep the original name.
 */
export function parseCountSuffix(raw: string): { name: string; quantity: number | null } {
  const s = raw.trim();
  const m = s.match(/^(.*?)(?:\s*\((\d+)\)|\s+[x×]\s*(\d+))\s*$/i);
  if (!m) return { name: s, quantity: null };
  const n = parseInt(m[2] ?? m[3] ?? '', 10);
  if (!Number.isFinite(n) || n <= 0) return { name: s, quantity: null };
  const name = m[1]!.trim();
  if (!name) return { name: s, quantity: null };
  return { name, quantity: n };
}
