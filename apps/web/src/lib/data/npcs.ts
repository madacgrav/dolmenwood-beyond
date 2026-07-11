import { requireAccountId } from '@/lib/auth/session';
import {
  assertCampaignParticipant,
  badRequest,
  forbidden,
  isCampaignParticipant,
  notFound,
} from '@/lib/authz';
import type { CampaignDoc, NpcEntryDoc, NpcStatus } from '@/lib/cosmos/types';
import type { Npc, NpcInput } from '@/lib/api/npcs';
import { displayNamesFor, replaceCampaignWithRetry } from './campaigns';

/**
 * Server-only NPC tracker: campaign-shared "People of Note" entries live on
 * the campaign doc, like sessions and party mounts. Distinct from the
 * per-character peopleOfNote seed on the character doc.
 */

const STATUSES: NpcStatus[] = ['alive', 'dead', 'missing', 'unknown'];

function normStatus(s: unknown): NpcStatus {
  return STATUSES.includes(s as NpcStatus) ? (s as NpcStatus) : 'unknown';
}

async function npcsToUi(doc: CampaignDoc): Promise<Npc[]> {
  const npcs = [...(doc.npcs ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  const names = await displayNamesFor(npcs.map((n) => n.addedBy));
  return npcs.map((n) => ({
    id: n.id,
    campaign_id: doc.id,
    name: n.name,
    relationship: n.relationship,
    status: n.status,
    note: n.note,
    added_by: n.addedBy,
    added_by_name: names[n.addedBy] ?? 'Unknown',
  }));
}

export async function getCampaignNpcs(campaignId: string): Promise<Npc[]> {
  const me = await requireAccountId();
  return npcsToUi(await assertCampaignParticipant(campaignId, me));
}

export async function addNpc(campaignId: string, input: NpcInput): Promise<void> {
  const me = await requireAccountId();
  const name = String(input.name ?? '').trim();
  if (!name) throw badRequest('name is required');
  await replaceCampaignWithRetry(
    campaignId,
    (doc, meId) => {
      if (!isCampaignParticipant(doc, meId)) throw forbidden();
    },
    (doc) => {
      const npc: NpcEntryDoc = {
        id: crypto.randomUUID(),
        name,
        relationship: String(input.relationship ?? '').trim(),
        status: normStatus(input.status),
        note: String(input.note ?? '').trim(),
        addedBy: me,
        createdAt: new Date().toISOString(),
      };
      doc.npcs = [...(doc.npcs ?? []), npc];
    },
  );
}

/** Creator or DM may edit/delete (same rule as campaign sessions). */
function assertCanEditNpc(doc: CampaignDoc, npc: NpcEntryDoc, meId: string): void {
  if (npc.addedBy !== meId && doc.refereeId !== meId) throw forbidden();
}

export async function updateNpc(
  campaignId: string,
  npcId: string,
  patch: NpcInput,
): Promise<void> {
  const me = await requireAccountId();
  const name = String(patch.name ?? '').trim();
  if (!name) throw badRequest('name is required');
  await replaceCampaignWithRetry(
    campaignId,
    () => undefined,
    (doc) => {
      const npc = (doc.npcs ?? []).find((n) => n.id === npcId);
      if (!npc) throw notFound('npc');
      assertCanEditNpc(doc, npc, me);
      npc.name = name;
      npc.relationship = String(patch.relationship ?? '').trim();
      npc.status = normStatus(patch.status);
      npc.note = String(patch.note ?? '').trim();
      npc.updatedAt = new Date().toISOString();
    },
  );
}

export async function deleteNpc(campaignId: string, npcId: string): Promise<void> {
  const me = await requireAccountId();
  await replaceCampaignWithRetry(
    campaignId,
    () => undefined,
    (doc) => {
      const npc = (doc.npcs ?? []).find((n) => n.id === npcId);
      if (!npc) throw notFound('npc');
      assertCanEditNpc(doc, npc, me);
      doc.npcs = (doc.npcs ?? []).filter((n) => n.id !== npcId);
    },
  );
}
