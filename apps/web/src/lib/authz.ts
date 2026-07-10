import { getContainer } from '@/lib/cosmos/client';
import type { CampaignDoc, CharacterDoc } from '@/lib/cosmos/types';

/**
 * Authorization helpers — the app-code port of the RLS predicates.
 * With Cosmos there is no row-level security: every server data function
 * must call one of these before reading or mutating on a caller's behalf.
 */

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const forbidden = () => new HttpError(403, 'Forbidden');
export const notFound = (what = 'resource') => new HttpError(404, `${what} not found`);
export const badRequest = (message: string) => new HttpError(400, message);

/** Port of the `auth.uid() = owner_id` RLS predicate. */
export function assertOwner(accountId: string, ownerId: string): void {
  if (accountId !== ownerId) throw forbidden();
}

/**
 * Characters are partitioned by /ownerId, so looking one up by id alone is
 * a cross-partition query. Callers that already know the owner should
 * point-read instead.
 */
export async function fetchCharacterDocById(characterId: string): Promise<CharacterDoc | null> {
  const { resources } = await getContainer('characters')
    .items.query<CharacterDoc>({
      query: 'SELECT * FROM c WHERE c.id = @id',
      parameters: [{ name: '@id', value: characterId }],
    })
    .fetchAll();
  return resources[0] ?? null;
}

// ── Campaign authorization (port of is_campaign_member / is_campaign_referee; "referee" is now "DM" in code and UI) ──

export async function fetchCampaignDoc(campaignId: string): Promise<CampaignDoc | null> {
  try {
    const { resource } = await getContainer('campaigns')
      .item(campaignId, campaignId)
      .read<CampaignDoc>();
    return resource ?? null;
  } catch {
    return null;
  }
}

export const isCampaignMember = (doc: CampaignDoc, accountId: string): boolean =>
  doc.members.some((m) => m.accountId === accountId);

export const isCampaignDM = (doc: CampaignDoc, accountId: string): boolean =>
  doc.refereeId === accountId;

export const isCampaignParticipant = (doc: CampaignDoc, accountId: string): boolean =>
  isCampaignMember(doc, accountId) || isCampaignDM(doc, accountId);

/** 404 if the campaign doesn't exist, 403 if the caller is neither member nor DM. */
export async function assertCampaignParticipant(
  campaignId: string,
  accountId: string,
): Promise<CampaignDoc> {
  const doc = await fetchCampaignDoc(campaignId);
  if (!doc) throw notFound('campaign');
  if (!isCampaignParticipant(doc, accountId)) throw forbidden();
  return doc;
}

export async function listCampaignsRunByDM(accountId: string): Promise<CampaignDoc[]> {
  const { resources } = await getContainer('campaigns')
    .items.query<CampaignDoc>({
      query: 'SELECT * FROM c WHERE c.refereeId = @id ORDER BY c.createdAt DESC',
      parameters: [{ name: '@id', value: accountId }],
    })
    .fetchAll();
  return resources;
}

export async function listCampaignsWithMember(accountId: string): Promise<CampaignDoc[]> {
  const { resources } = await getContainer('campaigns')
    .items.query<CampaignDoc>({
      query:
        'SELECT * FROM c WHERE EXISTS (SELECT VALUE m FROM m IN c.members WHERE m.accountId = @id)',
      parameters: [{ name: '@id', value: accountId }],
    })
    .fetchAll();
  return resources;
}

/**
 * True when `dmId` runs a campaign that `targetAccountId` belongs to — the
 * predicate behind DM visibility and the bank/award rules.
 */
export async function isDMOfAccount(
  dmId: string,
  targetAccountId: string,
): Promise<boolean> {
  if (dmId === targetAccountId) return false;
  const campaigns = await listCampaignsRunByDM(dmId);
  return campaigns.some((c) => isCampaignMember(c, targetAccountId));
}

/** Read access to a character: its owner, or the DM of a campaign the owner is in. */
export async function canReadCharacter(accountId: string, doc: CharacterDoc): Promise<boolean> {
  if (doc.ownerId === accountId) return true;
  return isDMOfAccount(accountId, doc.ownerId);
}

/** 404 if the character doesn't exist, 403 if it belongs to someone else. */
export async function assertCharacterOwner(
  accountId: string,
  characterId: string,
): Promise<CharacterDoc> {
  // Hot path: a 1-RU point read in the caller's own partition. Only when
  // that misses do we pay the cross-partition query to tell "not yours"
  // (403) apart from "doesn't exist" (404).
  try {
    const { resource } = await getContainer('characters')
      .item(characterId, accountId)
      .read<CharacterDoc>();
    if (resource) return resource;
  } catch {
    // fall through to the slow path
  }
  const doc = await fetchCharacterDocById(characterId);
  if (!doc) throw notFound('character');
  assertOwner(accountId, doc.ownerId);
  return doc;
}
