/** Client-side wrappers over /api/campaigns/[id]/npcs. */
import type { NpcStatus } from '@/lib/cosmos/types';

export type { NpcStatus };
export const NPC_STATUSES: NpcStatus[] = ['alive', 'unknown', 'missing', 'dead'];

export interface Npc {
  id: string;
  campaign_id: string;
  name: string;
  relationship: string;
  status: NpcStatus;
  note: string;
  added_by: string;
  added_by_name: string;
}

export interface NpcInput {
  name: string;
  relationship: string;
  status: NpcStatus;
  note: string;
}

type MaybeError = { error: { message: string } | null };

async function errorOf(res: Response): Promise<MaybeError> {
  if (res.ok) return { error: null };
  const body = await res.json().catch(() => null);
  return { error: { message: body?.error ?? `request failed (${res.status})` } };
}

export async function loadNpcs(campaignId: string): Promise<Npc[]> {
  const res = await fetch(`/api/campaigns/${campaignId}/npcs`);
  if (!res.ok) return [];
  const body = await res.json();
  return body.npcs ?? [];
}

export async function createNpc(campaignId: string, input: NpcInput): Promise<MaybeError> {
  const res = await fetch(`/api/campaigns/${campaignId}/npcs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return errorOf(res);
}
