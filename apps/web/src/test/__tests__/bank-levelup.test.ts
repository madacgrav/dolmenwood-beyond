import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AccountDoc, CharacterDoc } from '@/lib/cosmos/types';

/** ETag-aware fake with a switchable current account (owner vs referee). */
const docs = new Map<string, CharacterDoc & { _etag: string }>();
let etagCounter = 0;
let failNextReplaceWith412 = false;

const PLAYER = { id: 'player-1', role: 'player' } as AccountDoc;
const REFEREE = { id: 'ref-1', role: 'referee' } as AccountDoc;
let currentAccount: AccountDoc = PLAYER;

vi.mock('@/lib/auth/session', () => ({
  requireAccountId: async () => currentAccount.id,
  getCurrentAccount: async () => currentAccount,
}));

vi.mock('@/lib/cosmos/client', () => ({
  getContainer: () => ({
    item: (id: string, partitionKey?: string) => ({
      // Clone on read: real Cosmos returns fresh deserialized objects, so
      // mutations on a read doc never leak into the store before replace.
      read: async () => {
        const doc = docs.get(id);
        return { resource: doc && doc.ownerId === partitionKey ? structuredClone(doc) : undefined };
      },
      replace: async (
        doc: CharacterDoc,
        opts?: { accessCondition?: { type: string; condition: string } },
      ) => {
        const stored = docs.get(doc.id);
        if (!stored) throw Object.assign(new Error('not found'), { code: 404 });
        if (failNextReplaceWith412) {
          failNextReplaceWith412 = false;
          stored._etag = `etag-${++etagCounter}`;
          throw Object.assign(new Error('precondition failed'), { code: 412 });
        }
        if (opts?.accessCondition && opts.accessCondition.condition !== stored._etag) {
          throw Object.assign(new Error('precondition failed'), { code: 412 });
        }
        const next = { ...doc, _etag: `etag-${++etagCounter}` };
        docs.set(doc.id, next);
        return { resource: next };
      },
      delete: async () => {
        docs.delete(id);
      },
    }),
    items: {
      create: async (doc: CharacterDoc) => {
        const next = { ...doc, _etag: `etag-${++etagCounter}` };
        docs.set(doc.id, next);
        return { resource: next };
      },
      query: (q: string | { query: string; parameters: { name: string; value: unknown }[] }) => ({
        fetchAll: async () => {
          const query = typeof q === 'string' ? q : q.query;
          const params = typeof q === 'string' ? [] : q.parameters;
          const param = (n: string) => params.find((p) => p.name === n)?.value;
          const all = [...docs.values()].map((d) => structuredClone(d));
          if (query.includes('c.id = @id')) {
            return { resources: all.filter((d) => d.id === param('@id')) };
          }
          if (query.includes('c.ownerId = @me')) {
            return { resources: all.filter((d) => d.ownerId === param('@me')) };
          }
          return { resources: all };
        },
      }),
    },
  }),
}));

import { createCharacter } from '@/lib/data/characters';
import { recordBankTransaction, fetchBankState, refereeBankOverview } from '@/lib/data/bank';
import { levelUp, fetchLevelUpLog } from '@/lib/data/level-up';

const INPUT = {
  name: 'Aldric',
  kindred: 'Human',
  characterClass: 'Fighter',
  alignment: 'lawful',
  abilityScores: { str: 12, int: 10, wis: 11, dex: 13, con: 14, cha: 9 },
  hpMax: 8,
};

async function makeCharacter(coinsGp = 100): Promise<string> {
  currentAccount = PLAYER;
  const { id } = await createCharacter(INPUT);
  const doc = docs.get(id)!;
  docs.set(id, { ...doc, coinsGp });
  return id;
}

beforeEach(() => {
  docs.clear();
  failNextReplaceWith412 = false;
  currentAccount = PLAYER;
});

describe('recordBankTransaction (port of bank_transaction RPC)', () => {
  it('owner deposit: appends ledger entry and moves gold purse → bank atomically', async () => {
    const id = await makeCharacter(100);
    await recordBankTransaction(id, 40, 'Storing quest reward');
    const doc = docs.get(id)!;
    expect(doc.coinsGp).toBe(60);
    expect(doc.bankLedger).toHaveLength(1);
    expect(doc.bankLedger![0]).toMatchObject({ amountGp: 40, performedBy: 'player-1' });
    expect((await fetchBankState(id)).balance).toBe(40);
  });

  it('rejects a deposit exceeding gold on hand', async () => {
    const id = await makeCharacter(10);
    await expect(recordBankTransaction(id, 50, '')).rejects.toMatchObject({ status: 400 });
    expect(docs.get(id)!.bankLedger ?? []).toHaveLength(0);
    expect(docs.get(id)!.coinsGp).toBe(10); // untouched
  });

  it('payouts are referee-only and cannot overdraw the bank', async () => {
    const id = await makeCharacter(100);
    await recordBankTransaction(id, 40, 'deposit');

    // Owner cannot pay out
    await expect(recordBankTransaction(id, -10, '')).rejects.toMatchObject({ status: 403 });

    currentAccount = REFEREE;
    await expect(recordBankTransaction(id, -50, '')).rejects.toMatchObject({ status: 400 }); // > balance
    await recordBankTransaction(id, -30, 'Transfer to character');
    const doc = docs.get(id)!;
    expect(doc.coinsGp).toBe(90); // 100 - 40 + 30
    expect((await fetchBankState(id)).balance).toBe(10);
  });

  it('retries a stale ETag: two racing deposits both land exactly once', async () => {
    const id = await makeCharacter(100);
    failNextReplaceWith412 = true; // first replace loses the race and retries
    await recordBankTransaction(id, 10, 'a');
    await recordBankTransaction(id, 20, 'b');
    const doc = docs.get(id)!;
    expect(doc.bankLedger).toHaveLength(2);
    expect(doc.coinsGp).toBe(70);
  });

  it('non-owner non-referee cannot even deposit; zero amount rejected', async () => {
    const id = await makeCharacter();
    currentAccount = { id: 'stranger', role: 'player' } as AccountDoc;
    await expect(recordBankTransaction(id, 10, '')).rejects.toMatchObject({ status: 403 });
    currentAccount = PLAYER;
    await expect(recordBankTransaction(id, 0, '')).rejects.toMatchObject({ status: 400 });
  });

  it('refereeBankOverview is forbidden for players and lists all for referees', async () => {
    const id = await makeCharacter(100);
    await recordBankTransaction(id, 25, '');
    await expect(refereeBankOverview()).rejects.toMatchObject({ status: 403 });
    currentAccount = REFEREE;
    const entries = await refereeBankOverview();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ id, balance: 25, coins_gp: 75 });
  });
});

describe('levelUp (port of level_up RPC)', () => {
  it('advances one level, adds hp, restores to full, and appends a log', async () => {
    const id = await makeCharacter();
    docs.set(id, { ...docs.get(id)!, hpCurrent: 3, xp: 2000 });

    await levelUp(id, {
      newLevel: 2,
      hpGain: 5,
      hpRoll: 6,
      changes: [{ field: 'Attack', oldValue: '', newValue: '+1' }],
      xpThreshold: 2000,
    });

    const doc = docs.get(id)!;
    expect(doc.level).toBe(2);
    expect(doc.hpMax).toBe(13);
    expect(doc.hpCurrent).toBe(13);
    const { entries } = await fetchLevelUpLog(id);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ from_level: 1, to_level: 2, hp_roll: 6, hp_roll_final: 5 });
  });

  it('rejects non-monotonic levels, out-of-range levels, and unmet XP thresholds', async () => {
    const id = await makeCharacter();
    await expect(
      levelUp(id, { newLevel: 3, hpGain: 5, hpRoll: 5, changes: [], xpThreshold: 0 }),
    ).rejects.toMatchObject({ status: 400 }); // skips a level
    await expect(
      levelUp(id, { newLevel: 16, hpGain: 5, hpRoll: 5, changes: [], xpThreshold: 0 }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      levelUp(id, { newLevel: 2, hpGain: 5, hpRoll: 5, changes: [], xpThreshold: 999999 }),
    ).rejects.toMatchObject({ status: 400 }); // xp too low
    expect(docs.get(id)!.level).toBe(1);
  });

  it('is owner-only', async () => {
    const id = await makeCharacter();
    currentAccount = REFEREE;
    await expect(
      levelUp(id, { newLevel: 2, hpGain: 5, hpRoll: 5, changes: [], xpThreshold: 0 }),
    ).rejects.toMatchObject({ status: 403 });
  });
});
