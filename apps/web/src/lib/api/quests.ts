/** Client-side wrappers over /api/campaigns/[id]/quests. */
import type { QuestStatus } from '@/lib/cosmos/types';

export type { QuestStatus };
export const QUEST_STATUSES: QuestStatus[] = ['active', 'completed'];

export interface Quest {
  id: string;
  campaign_id: string;
  title: string;
  giver: string;
  status: QuestStatus;
  note: string;
  added_by: string;
  added_by_name: string;
}

export interface QuestInput {
  title: string;
  giver: string;
  status: QuestStatus;
  note: string;
}

type MaybeError = { error: { message: string } | null };

async function errorOf(res: Response): Promise<MaybeError> {
  if (res.ok) return { error: null };
  const body = await res.json().catch(() => null);
  return { error: { message: body?.error ?? `request failed (${res.status})` } };
}

export async function loadQuests(campaignId: string): Promise<Quest[]> {
  const res = await fetch(`/api/campaigns/${campaignId}/quests`);
  if (!res.ok) return [];
  const body = await res.json();
  return body.quests ?? [];
}

export async function createQuest(campaignId: string, input: QuestInput): Promise<MaybeError> {
  const res = await fetch(`/api/campaigns/${campaignId}/quests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return errorOf(res);
}

export async function updateQuest(
  campaignId: string,
  questId: string,
  patch: QuestInput,
): Promise<MaybeError> {
  const res = await fetch(`/api/campaigns/${campaignId}/quests/${questId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return errorOf(res);
}

export async function deleteQuest(campaignId: string, questId: string): Promise<MaybeError> {
  const res = await fetch(`/api/campaigns/${campaignId}/quests/${questId}`, { method: 'DELETE' });
  return errorOf(res);
}
