import { randomBytes } from 'node:crypto';
import { getContainer } from '@/lib/cosmos/client';
import { requireAccountId } from '@/lib/auth/session';
import {
  assertCampaignParticipant,
  badRequest,
  fetchCharacterDocById,
  forbidden,
  isDMOfAccount,
  listCampaignsRunByDM,
  listCampaignsWithMember,
  notFound,
} from '@/lib/authz';
import type { CampaignDoc, CharacterDoc, PartyMountDoc } from '@/lib/cosmos/types';
import type {
  CampaignData,
  Member,
  MemberCharacter,
  PackAnimal,
  DMCampaignsData,
} from '@/lib/api/campaigns';
import { mutateCharacterDoc } from './characters';
import { fetchAccountDoc } from './account';

/**
 * Server-only campaign access. Campaigns are small single-partition docs
 * (pk /id) embedding members + party mounts; rosters hydrate via point
 * reads on accounts and partition-scoped character queries — the app-code
 * replacement for the get_campaign_party_data SECURITY DEFINER RPC.
 */

const campaigns = () => getContainer('campaigns');

export async function replaceCampaignWithRetry(
  campaignId: string,
  authorize: (doc: CampaignDoc, me: string) => void,
  mutate: (doc: CampaignDoc) => void,
): Promise<CampaignDoc> {
  const me = await requireAccountId();
  for (let attempt = 0; ; attempt++) {
    const { resource: doc } = await campaigns().item(campaignId, campaignId).read<CampaignDoc>();
    if (!doc) throw notFound('campaign');
    authorize(doc, me);
    mutate(doc);
    try {
      const { resource } = await campaigns()
        .item(doc.id, doc.id)
        .replace(doc, { accessCondition: { type: 'IfMatch', condition: doc._etag! } });
      return resource as CampaignDoc;
    } catch (e) {
      if ((e as { code?: number }).code === 412 && attempt < 3) continue;
      throw e;
    }
  }
}

// Port of generate_invite_code(): unique among campaigns, 20 attempts.
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

async function generateCampaignInviteCode(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const bytes = randomBytes(6);
    let code = '';
    for (const byte of bytes) code += INVITE_ALPHABET[byte % INVITE_ALPHABET.length];
    const { resources } = await campaigns()
      .items.query({
        query: 'SELECT VALUE COUNT(1) FROM c WHERE c.inviteCode = @code',
        parameters: [{ name: '@code', value: code }],
      })
      .fetchAll();
    if (resources[0] === 0) return code;
  }
  throw new Error('could not generate a unique invite code');
}

export async function createCampaign(name: string): Promise<{ id: string }> {
  const me = await requireAccountId();
  const trimmed = name.trim();
  if (!trimmed) throw badRequest('campaign name is required');
  const doc: CampaignDoc = {
    id: crypto.randomUUID(),
    name: trimmed,
    refereeId: me,
    inviteCode: await generateCampaignInviteCode(),
    members: [],
    partyMounts: [],
    createdAt: new Date().toISOString(),
  };
  await campaigns().items.create(doc);
  return { id: doc.id };
}

/** Port of join_campaign: invalid code and already-a-member both raise. */
export async function joinCampaign(
  inviteCode: string,
): Promise<{ campaign_id: string; campaign_name: string }> {
  const me = await requireAccountId();
  const code = inviteCode.trim().toUpperCase();
  const { resources } = await campaigns()
    .items.query<CampaignDoc>({
      query: 'SELECT * FROM c WHERE c.inviteCode = @code',
      parameters: [{ name: '@code', value: code }],
    })
    .fetchAll();
  const found = resources[0];
  if (!found) throw badRequest('Invalid invite code');

  const doc = await replaceCampaignWithRetry(
    found.id,
    () => undefined, // any authenticated account may join with a valid code
    (c) => {
      if (c.members.some((m) => m.accountId === me)) {
        throw badRequest('You are already a member of this campaign');
      }
      c.members = [...c.members, { accountId: me, joinedAt: new Date().toISOString() }];
    },
  );
  return { campaign_id: doc.id, campaign_name: doc.name };
}

// ── Roster hydration ──────────────────────────────────────────────────────────

export async function displayNamesFor(accountIds: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(accountIds)];
  const docs = await Promise.all(unique.map((id) => fetchAccountDoc(id)));
  const map: Record<string, string> = {};
  unique.forEach((id, i) => {
    map[id] = docs[i]?.displayName ?? 'Unknown';
  });
  return map;
}

function charToMemberCharacter(doc: CharacterDoc): MemberCharacter {
  return {
    id: doc.id,
    name: doc.name,
    character_class: doc.characterClass,
    level: doc.level,
    xp: doc.xp,
    ability_scores: doc.abilityScores as unknown as Record<string, number>,
    kindred: doc.kindred,
    hp_current: doc.hpCurrent,
    hp_max: doc.hpMax,
  };
}

async function charactersByOwner(ownerIds: string[]): Promise<Record<string, CharacterDoc[]>> {
  const unique = [...new Set(ownerIds)];
  const container = getContainer('characters');
  const results = await Promise.all(
    unique.map(async (ownerId) => {
      const { resources } = await container.items
        .query<CharacterDoc>(
          {
            query: 'SELECT * FROM c WHERE c.ownerId = @id ORDER BY c.name',
            parameters: [{ name: '@id', value: ownerId }],
          },
          { partitionKey: ownerId },
        )
        .fetchAll();
      return [ownerId, resources] as const;
    }),
  );
  return Object.fromEntries(results);
}

function mountToPackAnimal(campaignId: string, m: PartyMountDoc): PackAnimal {
  return {
    id: m.id,
    name: m.name,
    mount_type: m.mountType as PackAnimal['mount_type'],
    speed: m.speed,
    campaign_id: campaignId,
    owner_id: m.addedBy,
  };
}

async function hydrateCampaign(doc: CampaignDoc): Promise<CampaignData> {
  const names = await displayNamesFor(doc.members.map((m) => m.accountId));
  const chars = await charactersByOwner(doc.members.map((m) => m.accountId));
  const members: Member[] = doc.members.map((m) => ({
    account_id: m.accountId,
    display_name: names[m.accountId] ?? 'Unknown',
    joined_at: m.joinedAt,
    characters: (chars[m.accountId] ?? []).map(charToMemberCharacter),
  }));
  return {
    id: doc.id,
    name: doc.name,
    invite_code: doc.inviteCode,
    created_at: doc.createdAt,
    members,
    showMembers: true,
  };
}

export async function loadDMCampaigns(): Promise<DMCampaignsData | null> {
  const me = await requireAccountId();
  const owned = await listCampaignsRunByDM(me);
  if (owned.length === 0) return null;
  const hydrated = await Promise.all(owned.map(hydrateCampaign));
  const packAnimals: Record<string, PackAnimal[]> = {};
  for (const doc of owned) {
    packAnimals[doc.id] = doc.partyMounts.map((m) => mountToPackAnimal(doc.id, m));
  }
  return { campaigns: hydrated, packAnimals };
}

export async function loadPlayerCampaigns(): Promise<CampaignData[]> {
  const me = await requireAccountId();
  const memberOf = await listCampaignsWithMember(me);
  return Promise.all(memberOf.map(hydrateCampaign));
}

/** Lightweight id+name list of campaigns the caller participates in. */
export async function listMyCampaignNames(): Promise<{ id: string; name: string }[]> {
  const me = await requireAccountId();
  const [runByMe, memberOf] = await Promise.all([
    listCampaignsRunByDM(me),
    listCampaignsWithMember(me),
  ]);
  const seen = new Map<string, string>();
  for (const c of [...runByMe, ...memberOf]) seen.set(c.id, c.name);
  return [...seen.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Port of get_campaign_roster: the full participant list (members ∪ DM)
 * with display names, participant-guarded, ordered by display name, the
 * DM flagged and appearing exactly once.
 */
export async function getCampaignRoster(
  campaignId: string,
): Promise<{ account_id: string; display_name: string; is_dm: boolean }[]> {
  const me = await requireAccountId();
  const doc = await assertCampaignParticipant(campaignId, me);
  const participantIds = [
    doc.refereeId,
    ...doc.members.map((m) => m.accountId).filter((id) => id !== doc.refereeId),
  ];
  const names = await displayNamesFor(participantIds);
  return participantIds
    .map((id) => ({
      account_id: id,
      display_name: names[id] ?? 'Unknown',
      is_dm: id === doc.refereeId,
    }))
    .sort((a, b) => a.display_name.localeCompare(b.display_name));
}

/** Port of award_xp: DM-of-the-owner's-campaign only, never self. */
export async function awardXP(characterId: string, gain: number): Promise<void> {
  if (!Number.isInteger(gain) || gain <= 0) throw badRequest('XP gain must be positive');
  const me = await requireAccountId();
  await mutateCharacterDoc(
    async () => {
      const doc = await fetchCharacterDocById(characterId);
      if (!doc) throw notFound('character');
      if (doc.ownerId === me) throw forbidden(); // no self-award
      if (!(await isDMOfAccount(me, doc.ownerId))) throw forbidden();
      return doc;
    },
    (doc) => {
      doc.xp += gain;
      doc.xpLog = [...(doc.xpLog ?? []), {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        delta: gain,
        newTotal: doc.xp,
        source: 'dm_award' as const,
        actorId: me,
      }];
    },
  );
}

// ── Party pack animals (embedded on the campaign doc) ─────────────────────────

export async function insertPackAnimal(
  campaignId: string,
  params: { name: string; mountType: string; speed: number },
): Promise<PackAnimal> {
  const me = await requireAccountId();
  await assertCampaignParticipant(campaignId, me);
  const mount: PartyMountDoc = {
    id: crypto.randomUUID(),
    name: params.name.trim(),
    mountType: params.mountType,
    speed: Number(params.speed) || 0,
    addedBy: me,
    createdAt: new Date().toISOString(),
  };
  if (!mount.name) throw badRequest('name is required');
  await replaceCampaignWithRetry(
    campaignId,
    (doc, meId) => {
      if (!doc.members.some((m) => m.accountId === meId) && doc.refereeId !== meId) {
        throw forbidden();
      }
    },
    (doc) => {
      doc.partyMounts = [...doc.partyMounts, mount];
    },
  );
  return mountToPackAnimal(campaignId, mount);
}

export async function removePackAnimal(campaignId: string, mountId: string): Promise<void> {
  await replaceCampaignWithRetry(
    campaignId,
    (doc, meId) => {
      if (!doc.members.some((m) => m.accountId === meId) && doc.refereeId !== meId) {
        throw forbidden();
      }
    },
    (doc) => {
      doc.partyMounts = doc.partyMounts.filter((m) => m.id !== mountId);
    },
  );
}
