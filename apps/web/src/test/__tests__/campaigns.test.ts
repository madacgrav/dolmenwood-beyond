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

import {
  createCampaign,
  joinCampaign,
  loadDMCampaigns,
  loadPlayerCampaigns,
  awardXP,
  insertPackAnimal,
} from '@/lib/data/campaigns';
import { createCharacter, fetchCharacterWithNotes } from '@/lib/data/characters';
import { listActiveRetainers, addRetainer, markRetainerPromoted } from '@/lib/data/retainers';
import { addMount, updateMountHP, listCharacterMounts } from '@/lib/data/mounts';

const CHAR_INPUT = {
  name: 'Aldric',
  kindred: 'Human',
  characterClass: 'Fighter',
  alignment: 'lawful',
  abilityScores: { str: 12, int: 10, wis: 11, dex: 13, con: 14, cha: 9 },
  hpMax: 8,
};

function seedAccounts() {
  for (const a of [REFEREE, PLAYER, OUTSIDER]) {
    store('accounts').set(a.id, { ...a, email: `${a.id}@example.com` });
  }
}

beforeEach(() => {
  resetFake();
  seedAccounts();
  currentAccount = REFEREE;
});

describe('campaign lifecycle', () => {
  it('create → join → rosters visible to referee and player', async () => {
    const { id } = await createCampaign('The Ruined Abbey');
    const doc = store('campaigns').get(id)!;
    expect(doc.inviteCode).toMatch(/^[A-Z2-9]{6}$/);

    currentAccount = PLAYER;
    const { id: charId } = await createCharacter(CHAR_INPUT);
    const joined = await joinCampaign(`  ${(doc.inviteCode as string).toLowerCase()} `);
    expect(joined).toEqual({ campaign_id: id, campaign_name: 'The Ruined Abbey' });

    // Duplicate join rejected (port of join_campaign's raise)
    await expect(joinCampaign(doc.inviteCode as string)).rejects.toMatchObject({ status: 400 });
    await expect(joinCampaign('ZZZZZZ')).rejects.toMatchObject({ status: 400 });

    // Player sees the roster (replaces get_campaign_party_data RPC)
    const playerView = await loadPlayerCampaigns();
    expect(playerView).toHaveLength(1);
    expect(playerView[0]!.members[0]).toMatchObject({ account_id: PLAYER.id, display_name: 'Alice' });
    expect(playerView[0]!.members[0]!.characters.map((c) => c.id)).toEqual([charId]);

    // Referee sees the same campaign with members hydrated
    currentAccount = REFEREE;
    const refView = await loadDMCampaigns();
    expect(refView!.campaigns[0]!.members[0]!.display_name).toBe('Alice');
  });

  it('loadDMCampaigns returns null when the caller owns no campaigns', async () => {
    currentAccount = PLAYER;
    expect(await loadDMCampaigns()).toBeNull();
  });
});

describe('awardXP (port of award_xp RPC)', () => {
  async function setup(): Promise<string> {
    const { id } = await createCampaign('XP Camp');
    const code = store('campaigns').get(id)!.inviteCode as string;
    currentAccount = PLAYER;
    const { id: charId } = await createCharacter(CHAR_INPUT);
    await joinCampaign(code);
    return charId;
  }

  it('lets the campaign referee award XP, never the owner or outsiders', async () => {
    const charId = await setup();

    // owner cannot self-award
    await expect(awardXP(charId, 100)).rejects.toMatchObject({ status: 403 });

    currentAccount = OUTSIDER;
    await expect(awardXP(charId, 100)).rejects.toMatchObject({ status: 403 });

    currentAccount = REFEREE;
    await expect(awardXP(charId, 0)).rejects.toMatchObject({ status: 400 });
    await awardXP(charId, 150);
    expect(store('characters').get(charId)!.xp).toBe(150);
  });

  it('referee of an unrelated campaign cannot award', async () => {
    const charId = await setup();
    const otherRef = { id: 'ref-2', role: 'referee', displayName: 'Other' } as AccountDoc;
    store('accounts').set(otherRef.id, { ...otherRef, email: 'r2@example.com' });
    currentAccount = otherRef;
    await createCampaign('Unrelated');
    await expect(awardXP(charId, 100)).rejects.toMatchObject({ status: 403 });
  });
});

describe('referee visibility (port of the referee RLS reads)', () => {
  it('a campaign referee can read a member character; outsiders cannot', async () => {
    const { id } = await createCampaign('Visible');
    const code = store('campaigns').get(id)!.inviteCode as string;
    currentAccount = PLAYER;
    const { id: charId } = await createCharacter(CHAR_INPUT);
    await joinCampaign(code);

    currentAccount = REFEREE;
    expect((await fetchCharacterWithNotes(charId)).name).toBe('Aldric');

    currentAccount = OUTSIDER;
    await expect(fetchCharacterWithNotes(charId)).rejects.toMatchObject({ status: 403 });
  });
});

describe('pack animals (embedded on the campaign)', () => {
  it('participants add and see them; outsiders are rejected', async () => {
    const { id } = await createCampaign('Mule Train');
    const animal = await insertPackAnimal(id, { name: 'Bess', mountType: 'Mule', speed: 30 });
    expect(animal).toMatchObject({ name: 'Bess', mount_type: 'Mule', campaign_id: id });
    expect(store('campaigns').get(id)!.partyMounts).toHaveLength(1);

    currentAccount = OUTSIDER;
    await expect(
      insertPackAnimal(id, { name: 'Rustler', mountType: 'Pony', speed: 40 }),
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe('embedded retainers + mounts', () => {
  it('retainer add → promote removes it from the active list', async () => {
    currentAccount = PLAYER;
    const { id: charId } = await createCharacter(CHAR_INPUT);
    const r = await addRetainer(charId, {
      name: 'Wilfred', kindred: 'Human', character_class: 'Fighter', level: 1,
      ac: 11, hp_current: 4, hp_max: 4, attack_bonus: 0, morale: 7, loyalty: 7,
      wage_type: 'daily', wage_amount: 1,
    });
    expect((await listActiveRetainers(charId)).map((x) => x.name)).toEqual(['Wilfred']);

    await markRetainerPromoted(charId, r.id);
    expect(await listActiveRetainers(charId)).toHaveLength(0);
    // still on the doc, just flagged
    expect(store('characters').get(charId)!.retainers).toHaveLength(1);
  });

  it('mount HP updates clamp at zero and mounts are owner-scoped', async () => {
    currentAccount = PLAYER;
    const { id: charId } = await createCharacter(CHAR_INPUT);
    const m = await addMount(charId, {
      name: 'Shadowfax', mount_type: 'Horse', speed: 40,
      has_full_stats: true, ac: 14, hp_current: 12, hp_max: 12, attack_bonus: 2, morale: 7,
    });
    await updateMountHP(charId, m.id, -5 as never);
    expect((await listCharacterMounts(charId))[0]!.hp_current).toBe(0);

    currentAccount = OUTSIDER;
    await expect(listCharacterMounts(charId)).rejects.toMatchObject({ status: 403 });
  });
});
