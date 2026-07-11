import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AccountDoc } from '@/lib/cosmos/types';
import { store, resetFake } from '@/test/cosmos-fake';

const REFEREE = { id: 'ref-1', role: 'referee', displayName: 'The Referee' } as AccountDoc;
const PLAYER = { id: 'player-1', role: 'player', displayName: 'Alice' } as AccountDoc;
const OUTSIDER = { id: 'outsider-1', role: 'player', displayName: 'Mallory' } as AccountDoc;
let currentAccount: AccountDoc = REFEREE;

vi.mock('@/lib/auth/session', () => ({
  requireAccountId: async () => currentAccount.id,
  getCurrentAccount: async () => currentAccount,
}));

vi.mock('@/lib/cosmos/client', async () => await import('@/test/cosmos-fake'));

import { createCampaign, joinCampaign, awardXP } from '@/lib/data/campaigns';
import { createCharacter, adjustXP } from '@/lib/data/characters';
import { levelUp } from '@/lib/data/level-up';
import { fetchXPLog } from '@/lib/data/xp-log';

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
  for (const a of [REFEREE, PLAYER, OUTSIDER]) {
    store('accounts').set(a.id, { ...a, email: `${a.id}@example.com` });
  }
  currentAccount = REFEREE;
});

// Distinct timestamps per entry — the log sorts by ISO timestamp, and all
// three writes would otherwise land in the same millisecond.
async function seedFullLog(): Promise<string> {
  vi.useFakeTimers();
  try {
    const { id: campaignId } = await createCampaign('XP Camp');
    const code = store('campaigns').get(campaignId)!.inviteCode as string;

    currentAccount = PLAYER;
    const { id: charId } = await createCharacter(CHAR_INPUT);
    await joinCampaign(code);

    currentAccount = REFEREE;
    vi.setSystemTime(new Date('2026-07-11T10:00:00Z'));
    await awardXP(charId, 1500); // dm_award

    currentAccount = PLAYER;
    vi.setSystemTime(new Date('2026-07-11T10:01:00Z'));
    await adjustXP(charId, 2000); // manual_edit, +500
    vi.setSystemTime(new Date('2026-07-11T10:02:00Z'));
    await levelUp(charId, { newLevel: 2, hpGain: 5, hpRoll: 6, changes: [], xpThreshold: 2000 }); // level_up
    return charId;
  } finally {
    vi.useRealTimers();
  }
}

describe('fetchXPLog', () => {
  it('owner reads all entries newest-first with actor names resolved', async () => {
    const charId = await seedFullLog();
    const view = await fetchXPLog(charId);
    expect(view.characterName).toBe('Aldric');
    expect(view.entries.map((e) => e.source)).toEqual(['level_up', 'manual_edit', 'dm_award']);
    expect(view.entries[0]).toMatchObject({ delta: 0, toLevel: 2, actorName: 'Alice' });
    expect(view.entries[1]).toMatchObject({ delta: 500, newTotal: 2000, actorName: 'Alice' });
    expect(view.entries[2]).toMatchObject({ delta: 1500, newTotal: 1500, actorName: 'The Referee' });
  });

  it('the DM of the owner can read the log', async () => {
    const charId = await seedFullLog();
    currentAccount = REFEREE;
    const view = await fetchXPLog(charId);
    expect(view.entries).toHaveLength(3);
  });

  it('unrelated accounts are rejected', async () => {
    const charId = await seedFullLog();
    currentAccount = OUTSIDER;
    await expect(fetchXPLog(charId)).rejects.toMatchObject({ status: 403 });
  });

  it('character without a log returns an empty list', async () => {
    currentAccount = PLAYER;
    const { id: charId } = await createCharacter(CHAR_INPUT);
    const view = await fetchXPLog(charId);
    expect(view.entries).toEqual([]);
  });
});
