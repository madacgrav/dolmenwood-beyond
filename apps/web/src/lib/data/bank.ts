import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Bank ledger queries shared by InventoryTab (deposit) and BankingTab
 * (referee transfers). Balance = sum of signed ledger amounts.
 *
 * Writes go through the `bank_transaction` RPC (migration
 * 20260612000022), which atomically inserts the ledger entry and
 * adjusts the character's purse, with server-side authorization and
 * balance checks.
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

export async function fetchBankBalance(
  supabase: SupabaseClient,
  characterId: string,
): Promise<number> {
  const { data } = await supabase
    .from('bank_ledger')
    .select('amount_gp')
    .eq('character_id', characterId);
  return sumLedger((data ?? []) as Pick<LedgerRow, 'amount_gp'>[]);
}

export async function listLedger(supabase: SupabaseClient): Promise<LedgerRow[]> {
  const { data } = await supabase
    .from('bank_ledger')
    .select('*')
    .order('created_at', { ascending: false });
  return (data ?? []) as LedgerRow[];
}

/**
 * Record a signed ledger entry (positive = deposit into bank, negative
 * = payout to character) atomically via the bank_transaction RPC. The
 * purse adjustment and performed_by are computed server-side.
 * Returns an error message, or null on success.
 */
export async function recordBankTransaction(
  supabase: SupabaseClient,
  args: {
    characterId: string;
    amountGp: number;
    description: string;
  },
): Promise<string | null> {
  const { error } = await supabase.rpc('bank_transaction', {
    p_character_id: args.characterId,
    p_amount_gp: args.amountGp,
    p_description: args.description,
  });
  return error ? error.message : null;
}
