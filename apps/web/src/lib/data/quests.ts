import { requireAccountId } from '@/lib/auth/session';
import {
  assertCampaignParticipant,
  badRequest,
  forbidden,
  isCampaignParticipant,
  notFound,
} from '@/lib/authz';
import type { CampaignDoc, QuestEntryDoc, QuestStatus } from '@/lib/cosmos/types';
import type { Quest, QuestInput } from '@/lib/api/quests';
import { displayNamesFor, replaceCampaignWithRetry } from './campaigns';

/**
 * Server-only campaign quest log: shared quests live on the campaign doc,
 * like NPCs and sessions. Any participant may add, edit, complete, or delete.
 */

const STATUSES: QuestStatus[] = ['active', 'completed'];

function normStatus(s: unknown): QuestStatus {
  return STATUSES.includes(s as QuestStatus) ? (s as QuestStatus) : 'active';
}

async function questsToUi(doc: CampaignDoc): Promise<Quest[]> {
  // Newest first; reverse before the stable sort so same-timestamp entries
  // still come out latest-added first.
  const quests = [...(doc.quests ?? [])].reverse().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const names = await displayNamesFor(quests.map((q) => q.addedBy));
  return quests.map((q) => ({
    id: q.id,
    campaign_id: doc.id,
    title: q.title,
    giver: q.giver,
    status: q.status,
    note: q.note,
    added_by: q.addedBy,
    added_by_name: names[q.addedBy] ?? 'Unknown',
  }));
}

export async function getCampaignQuests(campaignId: string): Promise<Quest[]> {
  const me = await requireAccountId();
  return questsToUi(await assertCampaignParticipant(campaignId, me));
}

export async function addQuest(campaignId: string, input: QuestInput): Promise<void> {
  const me = await requireAccountId();
  const title = String(input.title ?? '').trim();
  if (!title) throw badRequest('title is required');
  await replaceCampaignWithRetry(
    campaignId,
    (doc, meId) => {
      if (!isCampaignParticipant(doc, meId)) throw forbidden();
    },
    (doc) => {
      const quest: QuestEntryDoc = {
        id: crypto.randomUUID(),
        title,
        giver: String(input.giver ?? '').trim(),
        status: normStatus(input.status),
        note: String(input.note ?? '').trim(),
        addedBy: me,
        createdAt: new Date().toISOString(),
      };
      doc.quests = [...(doc.quests ?? []), quest];
    },
  );
}

export async function updateQuest(
  campaignId: string,
  questId: string,
  patch: QuestInput,
): Promise<void> {
  await requireAccountId();
  const title = String(patch.title ?? '').trim();
  if (!title) throw badRequest('title is required');
  await replaceCampaignWithRetry(
    campaignId,
    (doc, meId) => {
      if (!isCampaignParticipant(doc, meId)) throw forbidden();
    },
    (doc) => {
      const quest = (doc.quests ?? []).find((q) => q.id === questId);
      if (!quest) throw notFound('quest');
      quest.title = title;
      quest.giver = String(patch.giver ?? '').trim();
      quest.status = normStatus(patch.status);
      quest.note = String(patch.note ?? '').trim();
      quest.updatedAt = new Date().toISOString();
    },
  );
}

export async function deleteQuest(campaignId: string, questId: string): Promise<void> {
  await requireAccountId();
  await replaceCampaignWithRetry(
    campaignId,
    (doc, meId) => {
      if (!isCampaignParticipant(doc, meId)) throw forbidden();
    },
    (doc) => {
      const quest = (doc.quests ?? []).find((q) => q.id === questId);
      if (!quest) throw notFound('quest');
      doc.quests = (doc.quests ?? []).filter((q) => q.id !== questId);
    },
  );
}
