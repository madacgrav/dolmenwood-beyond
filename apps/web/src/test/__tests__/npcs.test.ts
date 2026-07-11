import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AccountDoc, NpcEntryDoc } from '@/lib/cosmos/types';
import { store, resetFake } from '@/test/cosmos-fake';

const REFEREE = { id: 'ref-1', role: 'referee', displayName: 'The Referee' } as AccountDoc;
const PLAYER = { id: 'player-1', role: 'player', displayName: 'Alice' } as AccountDoc;
const OUTSIDER = { id: 'outsider-1', role: 'player', displayName: 'Mallory' } as AccountDoc;
const MEMBER2 = { id: 'player-2', role: 'player', displayName: 'Bob' } as AccountDoc;
let currentAccount: AccountDoc = REFEREE;

vi.mock('@/lib/auth/session', () => ({
  requireAccountId: async () => currentAccount.id,
  getCurrentAccount: async () => currentAccount,
}));

vi.mock('@/lib/cosmos/client', async () => await import('@/test/cosmos-fake'));

import { getCampaignNpcs, addNpc, updateNpc, deleteNpc } from '@/lib/data/npcs';
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

describe('campaign NPCs (embedded on the campaign)', () => {
  it('participant adds an NPC; all participants and DM see it; outsider 403', async () => {
    const id = await setupCampaign();

    currentAccount = PLAYER;
    await addNpc(id, { name: 'Sister Aelfled', relationship: 'patron', status: 'alive', note: 'abbey of St Keye' });
    expect(store('campaigns').get(id)!.npcs).toHaveLength(1);

    currentAccount = REFEREE;
    const seen = await getCampaignNpcs(id);
    expect(seen.map((n) => n.name)).toEqual(['Sister Aelfled']);
    expect(seen[0]).toMatchObject({
      campaign_id: id,
      relationship: 'patron',
      status: 'alive',
      added_by: PLAYER.id,
      added_by_name: 'Alice',
    });

    currentAccount = OUTSIDER;
    await expect(getCampaignNpcs(id)).rejects.toMatchObject({ status: 403 });
    await expect(
      addNpc(id, { name: 'X', relationship: '', status: 'alive', note: '' }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('rejects empty name and defaults unknown status', async () => {
    const id = await setupCampaign();

    await expect(
      addNpc(id, { name: '   ', relationship: '', status: 'alive', note: '' }),
    ).rejects.toMatchObject({ status: 400 });

    await addNpc(id, { name: 'Nogris', relationship: '', status: 'bogus' as never, note: '' });
    const npcs = store('campaigns').get(id)!.npcs as NpcEntryDoc[];
    expect(npcs[0]!.status).toBe('unknown');
  });

  it('sorts NPCs by name and defaults npcs to [] on old docs', async () => {
    const id = await setupCampaign();
    expect(await getCampaignNpcs(id)).toEqual([]);

    await addNpc(id, { name: 'Zeb', relationship: '', status: 'alive', note: '' });
    await addNpc(id, { name: 'Agnes', relationship: '', status: 'alive', note: '' });
    expect((await getCampaignNpcs(id)).map((n) => n.name)).toEqual(['Agnes', 'Zeb']);
  });

  it('creator or DM can edit/delete; other members cannot; unknown id 404', async () => {
    const id = await setupCampaign();

    currentAccount = PLAYER;
    await addNpc(id, { name: 'Gaffer', relationship: 'ally', status: 'alive', note: '' });
    const npcs = store('campaigns').get(id)!.npcs as NpcEntryDoc[];
    const npcId = npcs[0]!.id;

    // another member (not creator, not DM) cannot edit or delete
    currentAccount = MEMBER2;
    await expect(
      updateNpc(id, npcId, { name: 'X', relationship: '', status: 'dead', note: '' }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(deleteNpc(id, npcId)).rejects.toMatchObject({ status: 403 });

    // creator edits
    currentAccount = PLAYER;
    await updateNpc(id, npcId, { name: 'Gaffer', relationship: 'ally', status: 'dead', note: 'RIP' });
    const edited = (store('campaigns').get(id)!.npcs as NpcEntryDoc[])[0]!;
    expect(edited).toMatchObject({ status: 'dead', note: 'RIP' });
    expect(edited.updatedAt).toBeTruthy();

    // empty-name edit rejected
    await expect(
      updateNpc(id, npcId, { name: '  ', relationship: '', status: 'dead', note: '' }),
    ).rejects.toMatchObject({ status: 400 });

    // DM deletes
    currentAccount = REFEREE;
    await deleteNpc(id, npcId);
    expect(store('campaigns').get(id)!.npcs).toHaveLength(0);
    await expect(deleteNpc(id, 'nope')).rejects.toMatchObject({ status: 404 });
    await expect(
      updateNpc(id, 'nope', { name: 'X', relationship: '', status: 'alive', note: '' }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
