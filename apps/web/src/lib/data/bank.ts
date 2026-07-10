import { getContainer } from '@/lib/cosmos/client';
import { getCurrentAccount } from '@/lib/auth/session';
import { badRequest, fetchCharacterDocById, forbidden, notFound } from '@/lib/authz';
import type { BankLedgerEntryDoc, CharacterDoc } from '@/lib/cosmos/types';
import type { LedgerRow } from '@/lib/api/bank';
import { mutateCharacterDoc } from './characters';

/**
 * Server-only banking: the ledger is embedded on the character doc, so a
 * transaction (ledger append + purse adjustment) is a single-document
 * write — the app-layer port of the `bank_transaction` RPC.
 *
 * Authorization mirrors the old bank_ledger RLS: deposits by the owner or
 * a referee, payouts by a referee only. The referee check is the global
 * `accounts.role` (matching the pre-campaign policies); phase 5 tightens
 * it to campaign-scoped.
 */

const ledgerOf = (doc: CharacterDoc): BankLedgerEntryDoc[] => doc.bankLedger ?? [];

const balanceOf = (doc: CharacterDoc): number =>
  ledgerOf(doc).reduce((sum, e) => sum + e.amountGp, 0);

function entryToRow(characterId: string, e: BankLedgerEntryDoc): LedgerRow {
  return {
    id: e.id,
    character_id: characterId,
    amount_gp: e.amountGp,
    description: e.description,
    performed_by: e.performedBy,
    created_at: e.createdAt,
  };
}

export async function fetchBankState(
  characterId: string,
): Promise<{ balance: number; ledger: LedgerRow[] }> {
  const me = await getCurrentAccount();
  const doc = await fetchCharacterDocById(characterId);
  if (!doc) throw notFound('character');
  if (doc.ownerId !== me.id && me.role !== 'referee') throw forbidden();
  const ledger = [...ledgerOf(doc)]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((e) => entryToRow(characterId, e));
  return { balance: balanceOf(doc), ledger };
}

export async function recordBankTransaction(
  characterId: string,
  amountGp: number,
  description = '',
): Promise<void> {
  if (!Number.isInteger(amountGp) || amountGp === 0) throw badRequest('amount must be a non-zero integer');
  const me = await getCurrentAccount();
  const isReferee = me.role === 'referee';

  await mutateCharacterDoc(
    async () => {
      const doc = await fetchCharacterDocById(characterId);
      if (!doc) throw notFound('character');
      // Deposits: owner or referee. Payouts: referee only.
      if (amountGp > 0 && doc.ownerId !== me.id && !isReferee) throw forbidden();
      if (amountGp < 0 && !isReferee) throw forbidden();
      return doc;
    },
    (doc) => {
      if (amountGp > 0 && doc.coinsGp < amountGp) {
        throw badRequest('insufficient gold on hand');
      }
      if (amountGp < 0 && balanceOf(doc) + amountGp < 0) {
        throw badRequest('insufficient bank balance');
      }
      doc.bankLedger = [
        ...ledgerOf(doc),
        {
          id: crypto.randomUUID(),
          amountGp,
          description,
          performedBy: me.id,
          createdAt: new Date().toISOString(),
        },
      ];
      // Deposit moves gold purse → bank; payout moves bank → purse.
      doc.coinsGp -= amountGp;
    },
  );
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

/** Referee-only overview of every character's bank (port of the referee RLS read). */
export async function refereeBankOverview(): Promise<RefereeBankEntry[]> {
  const me = await getCurrentAccount();
  if (me.role !== 'referee') throw forbidden();
  const { resources } = await getContainer('characters')
    .items.query<CharacterDoc>('SELECT * FROM c ORDER BY c.name')
    .fetchAll();
  return resources.map((doc) => ({
    id: doc.id,
    name: doc.name,
    kindred: doc.kindred,
    character_class: doc.characterClass,
    level: doc.level,
    owner_id: doc.ownerId,
    coins_gp: doc.coinsGp ?? 0,
    balance: balanceOf(doc),
    ledger: [...ledgerOf(doc)]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((e) => entryToRow(doc.id, e)),
  }));
}
