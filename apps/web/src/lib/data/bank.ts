import { getContainer } from '@/lib/cosmos/client';
import { getCurrentAccount, requireAccountId } from '@/lib/auth/session';
import {
  badRequest,
  fetchCharacterDocById,
  forbidden,
  isDMOfAccount,
  listCampaignsRunByDM,
  notFound,
} from '@/lib/authz';
import type { BankLedgerEntryDoc, CharacterDoc } from '@/lib/cosmos/types';
import type { LedgerRow } from '@/lib/api/bank';
import { mutateCharacterDoc } from './characters';

/**
 * Server-only banking: the ledger is embedded on the character doc, so a
 * transaction (ledger append + purse adjustment) is a single-document
 * write — the app-layer port of the `bank_transaction` RPC.
 *
 * Authorization mirrors bank_transaction: deposits by the owner or the
 * DM of a campaign the owner belongs to; payouts by that DM only
 * (campaign-scoped, not the global account role).
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
  if (doc.ownerId !== me.id && !(await isDMOfAccount(me.id, doc.ownerId))) throw forbidden();
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

  await mutateCharacterDoc(
    async () => {
      const doc = await fetchCharacterDocById(characterId);
      if (!doc) throw notFound('character');
      // Deposits: owner or the owner's campaign DM. Payouts: that DM only.
      const isDM = doc.ownerId !== me.id && (await isDMOfAccount(me.id, doc.ownerId));
      if (amountGp > 0 && doc.ownerId !== me.id && !isDM) throw forbidden();
      if (amountGp < 0 && !isDM) throw forbidden();
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

export interface DMBankEntry {
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

/** DM overview: the banks of characters enrolled in my campaigns (optionally
 *  one campaign). Legacy account-level members expose all their characters. */
export async function dmBankOverview(campaignId?: string): Promise<DMBankEntry[]> {
  const me = await requireAccountId();
  let myCampaigns = await listCampaignsRunByDM(me);
  if (campaignId) myCampaigns = myCampaigns.filter((c) => c.id === campaignId);
  if (myCampaigns.length === 0) throw forbidden();

  // ownerId → enrolled characterIds; null = legacy member (all characters).
  const enrolledByOwner = new Map<string, Set<string> | null>();
  for (const c of myCampaigns) {
    for (const m of c.members) {
      if (m.accountId === me) continue;
      const cur = enrolledByOwner.get(m.accountId);
      if (cur === null) continue;
      if (!m.characterId) enrolledByOwner.set(m.accountId, null);
      else enrolledByOwner.set(m.accountId, (cur ?? new Set()).add(m.characterId));
    }
  }

  const container = getContainer('characters');
  const perOwner = await Promise.all(
    [...enrolledByOwner.keys()].map(async (ownerId) => {
      const { resources } = await container.items
        .query<CharacterDoc>(
          {
            query: 'SELECT * FROM c WHERE c.ownerId = @id',
            parameters: [{ name: '@id', value: ownerId }],
          },
          { partitionKey: ownerId },
        )
        .fetchAll();
      const enrolled = enrolledByOwner.get(ownerId);
      return enrolled === null || enrolled === undefined
        ? resources
        : resources.filter((doc) => enrolled.has(doc.id));
    }),
  );
  const resources = perOwner.flat().sort((a, b) => a.name.localeCompare(b.name));
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
