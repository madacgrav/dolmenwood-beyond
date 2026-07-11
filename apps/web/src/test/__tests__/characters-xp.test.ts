import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AccountDoc } from '@/lib/cosmos/types';
import type { XPLogEntry } from '@dolmenwood/types';
import { store, resetFake } from '@/test/cosmos-fake';

const PLAYER = { id: 'player-1', role: 'player', displayName: 'Alice' } as AccountDoc;
const OUTSIDER = { id: 'outsider-1', role: 'player', displayName: 'Mallory' } as AccountDoc;
let currentAccount: AccountDoc = PLAYER;

vi.mock('@/lib/auth/session', () => ({
  requireAccountId: async () => currentAccount.id,
  getCurrentAccount: async () => currentAccount,
}));

vi.mock('@/lib/cosmos/client', async () => await import('@/test/cosmos-fake'));

import { createCharacter, adjustXP, updateCharacter } from '@/lib/data/characters';

const CHAR_INPUT = {
  name: 'Aldric',
  kindred: 'Human',
  characterClass: 'Fighter',
  alignment: 'lawful',
  abilityScores: { str: 12, int: 10, wis: 11, dex: 13, con: 14, cha: 9 },
  hpMax: 8,
};

beforeEach(() => {
  resetFake();
  currentAccount = PLAYER;
});

function xpLogOf(charId: string): XPLogEntry[] {
  return (store('characters').get(charId)!.xpLog ?? []) as XPLogEntry[];
}

describe('adjustXP (owner manual edit, logged)', () => {
  it('sets XP and appends a manual_edit entry with the signed delta', async () => {
    const { id: charId } = await createCharacter(CHAR_INPUT);

    await adjustXP(charId, 300);
    expect(store('characters').get(charId)!.xp).toBe(300);
    expect(xpLogOf(charId).at(-1)).toMatchObject({
      source: 'manual_edit', delta: 300, newTotal: 300, actorId: PLAYER.id,
    });

    // correction downward logs a negative delta
    await adjustXP(charId, 250);
    expect(xpLogOf(charId).at(-1)).toMatchObject({ delta: -50, newTotal: 250 });
    expect(xpLogOf(charId)).toHaveLength(2);
  });

  it('rejects negative and non-integer totals', async () => {
    const { id: charId } = await createCharacter(CHAR_INPUT);
    await expect(adjustXP(charId, -1)).rejects.toMatchObject({ status: 400 });
    await expect(adjustXP(charId, 1.5)).rejects.toMatchObject({ status: 400 });
    expect(xpLogOf(charId)).toHaveLength(0);
  });

  it('rejects non-owners', async () => {
    const { id: charId } = await createCharacter(CHAR_INPUT);
    currentAccount = OUTSIDER;
    await expect(adjustXP(charId, 10)).rejects.toMatchObject({ status: 403 });
  });

  it('generic PATCH no longer changes xp', async () => {
    const { id: charId } = await createCharacter(CHAR_INPUT);
    await updateCharacter(charId, { xp: 9999 } as never);
    expect(store('characters').get(charId)!.xp).toBe(0);
  });
});
