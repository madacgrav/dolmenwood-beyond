import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AccountDoc, QuestEntryDoc } from '@/lib/cosmos/types';
import { store, resetFake } from '@/test/cosmos-fake';

const REFEREE = { id: 'ref-1', displayName: 'The Referee' } as AccountDoc;
const PLAYER = { id: 'player-1', displayName: 'Alice' } as AccountDoc;
const OUTSIDER = { id: 'outsider-1', displayName: 'Mallory' } as AccountDoc;
const MEMBER2 = { id: 'player-2', displayName: 'Bob' } as AccountDoc;
let currentAccount: AccountDoc = REFEREE;

vi.mock('@/lib/auth/session', () => ({
  requireAccountId: async () => currentAccount.id,
  getCurrentAccount: async () => currentAccount,
}));

vi.mock('@/lib/cosmos/client', async () => await import('@/test/cosmos-fake'));

import { getCampaignQuests, addQuest, updateQuest, deleteQuest } from '@/lib/data/quests';
import { createCampaign, joinCampaign } from '@/lib/data/campaigns';

function seedAccounts() {
  for (const a of [REFEREE, PLAYER, OUTSIDER, MEMBER2]) {
    store('accounts').set(a.id, { ...a, email: `${a.id}@example.com` });
  }
}

beforeEach(() => {
  resetFake();
  seedAccounts();
  currentAccount = REFEREE;
});

/** REFEREE creates the campaign, PLAYER and MEMBER2 join. Returns the campaign id. */
async function setupCampaign(): Promise<string> {
  const { id } = await createCampaign('The Hollow Hills');
  const code = store('campaigns').get(id)!.inviteCode as string;
  currentAccount = PLAYER;
  await joinCampaign(code);
  currentAccount = MEMBER2;
  await joinCampaign(code);
  currentAccount = REFEREE;
  return id;
}

describe('campaign quests (embedded on the campaign)', () => {
  it('participant adds a quest; all participants see it; outsider 403', async () => {
    const id = await setupCampaign();

    currentAccount = PLAYER;
    await addQuest(id, { title: 'Find the Drune', giver: 'Sister Aelfled', status: 'active', note: 'abbey' });
    expect(store('campaigns').get(id)!.quests).toHaveLength(1);

    currentAccount = REFEREE;
    const seen = await getCampaignQuests(id);
    expect(seen.map((q) => q.title)).toEqual(['Find the Drune']);
    expect(seen[0]).toMatchObject({
      campaign_id: id,
      giver: 'Sister Aelfled',
      status: 'active',
      added_by: PLAYER.id,
      added_by_name: 'Alice',
    });

    currentAccount = OUTSIDER;
    await expect(getCampaignQuests(id)).rejects.toMatchObject({ status: 403 });
    await expect(
      addQuest(id, { title: 'X', giver: '', status: 'active', note: '' }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('rejects empty title and clamps bogus status to active', async () => {
    const id = await setupCampaign();

    await expect(
      addQuest(id, { title: '   ', giver: '', status: 'active', note: '' }),
    ).rejects.toMatchObject({ status: 400 });

    await addQuest(id, { title: 'Recover the relic', giver: '', status: 'bogus' as never, note: '' });
    expect((store('campaigns').get(id)!.quests as QuestEntryDoc[])[0]!.status).toBe('active');
  });

  it('sorts newest-first and defaults quests to [] on old docs', async () => {
    const id = await setupCampaign();
    expect(await getCampaignQuests(id)).toEqual([]);

    await addQuest(id, { title: 'First', giver: '', status: 'active', note: '' });
    await addQuest(id, { title: 'Second', giver: '', status: 'active', note: '' });
    expect((await getCampaignQuests(id)).map((q) => q.title)).toEqual(['Second', 'First']);
  });

  it('any participant can complete/edit/delete; unknown id 404', async () => {
    const id = await setupCampaign();

    currentAccount = PLAYER;
    await addQuest(id, { title: 'Escort the caravan', giver: '', status: 'active', note: '' });
    const questId = (store('campaigns').get(id)!.quests as QuestEntryDoc[])[0]!.id;

    // a different member (not creator, not DM) CAN complete — divergence from NPCs
    currentAccount = MEMBER2;
    await updateQuest(id, questId, { title: 'Escort the caravan', giver: '', status: 'completed', note: 'done' });
    const edited = (store('campaigns').get(id)!.quests as QuestEntryDoc[])[0]!;
    expect(edited).toMatchObject({ status: 'completed', note: 'done' });
    expect(edited.updatedAt).toBeTruthy();

    // empty-title edit rejected
    await expect(
      updateQuest(id, questId, { title: ' ', giver: '', status: 'active', note: '' }),
    ).rejects.toMatchObject({ status: 400 });

    // outsider still blocked
    currentAccount = OUTSIDER;
    await expect(deleteQuest(id, questId)).rejects.toMatchObject({ status: 403 });

    // any member deletes
    currentAccount = MEMBER2;
    await deleteQuest(id, questId);
    expect(store('campaigns').get(id)!.quests).toHaveLength(0);
    await expect(deleteQuest(id, 'nope')).rejects.toMatchObject({ status: 404 });
  });
});
