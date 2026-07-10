/**
 * Client-side wrappers over the bank routes, plus the snake_case ledger
 * shape the banking UI was built against.
 */

export interface LedgerRow {
  id: string;
  character_id: string;
  amount_gp: number;
  description: string;
  performed_by: string;
  created_at: string;
}

export function sumLedger(rows: Pick<LedgerRow, 'amount_gp'>[]): number {
  return rows.reduce((sum, r) => sum + r.amount_gp, 0);
}

export async function fetchBankBalance(characterId: string): Promise<number> {
  const res = await fetch(`/api/characters/${characterId}/bank`);
  if (!res.ok) return 0;
  const body = await res.json();
  return body.balance ?? 0;
}

/**
 * Record a signed ledger entry (positive = deposit into bank, negative =
 * payout to character). Returns an error message, or null on success.
 */
export async function recordBankTransaction(args: {
  characterId: string;
  amountGp: number;
  description: string;
}): Promise<string | null> {
  const res = await fetch(`/api/characters/${args.characterId}/bank`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amountGp: args.amountGp, description: args.description }),
  });
  if (res.ok) return null;
  const body = await res.json().catch(() => null);
  return body?.error ?? `request failed (${res.status})`;
}

export interface RefereeBankEntry {
  id: string;
  name: string;
  kindred: string;
  character_class: string;
  level: number;
  owner_id: string;
  coins_gp: number;
  balance: number;
  ledger: LedgerRow[];
}

/** Referee-only: every character's balance + ledger in one call. */
export async function refereeBankOverview(): Promise<RefereeBankEntry[]> {
  const res = await fetch('/api/bank');
  if (!res.ok) return [];
  const body = await res.json();
  return body.entries ?? [];
}
