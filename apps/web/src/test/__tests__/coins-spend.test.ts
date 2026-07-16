import { describe, it, expect, vi, beforeEach } from 'vitest';

import { resetFake } from '@/test/cosmos-fake';

vi.mock('@/lib/auth/session', () => ({
  requireAccountId: async () => 'me-1',
}));

vi.mock('@/lib/cosmos/client', async () => await import('@/test/cosmos-fake'));
import { createCharacter, saveCoins, fetchCoins, spendCoins } from '@/lib/data/characters';
import { toCp, fromCp, amountToCp } from '@/lib/coins';

const INPUT = {
  name: 'Maribel',
  kindred: 'Grimalkin',
  characterClass: 'Thief',
  alignment: 'neutral',
  abilityScores: { str: 9, int: 12, wis: 10, dex: 16, con: 11, cha: 13 },
  hpMax: 4,
};

beforeEach(() => resetFake());

describe('coin math', () => {
  it('round-trips cp totals through denominations', () => {
    expect(toCp({ gp: 2, sp: 25, cp: 3 })).toBe(400 + 250 + 3);
    expect(fromCp(653)).toEqual({ gp: 3, sp: 5, cp: 3 });
    expect(amountToCp(3, 'gp')).toBe(600);
    expect(amountToCp(5, 'sp')).toBe(50);
    expect(amountToCp(7, 'cp')).toBe(7);
  });
});

describe('spendCoins', () => {
  it('deducts exactly when denominations line up', async () => {
    const { id } = await createCharacter(INPUT);
    await saveCoins(id, { gp: 3, sp: 0, cp: 0 });
    const next = await spendCoins(id, amountToCp(3, 'gp'));
    expect(next).toEqual({ gp: 0, sp: 0, cp: 0 });
    expect(await fetchCoins(id)).toEqual({ gp: 0, sp: 0, cp: 0 });
  });

  it('makes change from larger denominations', async () => {
    const { id } = await createCharacter(INPUT);
    await saveCoins(id, { gp: 1, sp: 0, cp: 0 });
    const next = await spendCoins(id, amountToCp(5, 'sp'));
    expect(next).toEqual({ gp: 0, sp: 15, cp: 0 });
  });

  it('rejects overspend without changing the purse', async () => {
    const { id } = await createCharacter(INPUT);
    await saveCoins(id, { gp: 2, sp: 25, cp: 0 }); // 650 cp on hand
    await expect(spendCoins(id, amountToCp(4, 'gp'))).rejects.toMatchObject({ status: 400 });
    expect(await fetchCoins(id)).toEqual({ gp: 2, sp: 25, cp: 0 });
  });

  it('rejects zero, negative, and non-integer amounts', async () => {
    const { id } = await createCharacter(INPUT);
    await saveCoins(id, { gp: 10, sp: 0, cp: 0 });
    await expect(spendCoins(id, 0)).rejects.toMatchObject({ status: 400 });
    await expect(spendCoins(id, -5)).rejects.toMatchObject({ status: 400 });
    await expect(spendCoins(id, 1.5)).rejects.toMatchObject({ status: 400 });
  });
});
