/**
 * Client-side wrappers over the campaign routes, plus the snake_case UI
 * shapes the campaign overview components were built against.
 */

export type PackAnimalType = 'Mule' | 'Donkey' | 'Pony' | 'Horse' | 'Ox' | 'Pack Dog';

export const PACK_ANIMAL_TYPES: PackAnimalType[] = ['Mule', 'Donkey', 'Pony', 'Horse', 'Ox', 'Pack Dog'];

export interface PackAnimal {
  id: string;
  name: string;
  mount_type: PackAnimalType;
  speed: number;
  campaign_id: string;
  owner_id: string;
}

export interface MemberCharacter {
  id: string;
  name: string;
  character_class: string;
  level: number;
  xp: number;
  ability_scores: Record<string, number>;
  kindred: string;
  hp_current?: number;
  hp_max?: number;
}

export interface Member {
  account_id: string;
  display_name: string;
  joined_at: string;
  characters: MemberCharacter[];
}

export interface CampaignData {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
  members: Member[];
  showMembers: boolean;
}

export interface DMCampaignsData {
  campaigns: CampaignData[];
  packAnimals: Record<string, PackAnimal[]>;
}

async function errorMessage(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  return body?.error ?? `request failed (${res.status})`;
}

export async function loadDMCampaigns(): Promise<DMCampaignsData | null> {
  const res = await fetch('/api/campaigns?as=referee');
  if (!res.ok) return null;
  const body = await res.json();
  return body.data ?? null;
}

export async function loadPlayerCampaigns(): Promise<CampaignData[]> {
  const res = await fetch('/api/campaigns');
  if (!res.ok) return [];
  const body = await res.json();
  return body.campaigns ?? [];
}

/** Campaigns the caller participates in — id + name only (schedule picker). */
export async function listMyCampaignNames(): Promise<{ id: string; name: string }[]> {
  const res = await fetch('/api/campaigns?as=names');
  if (!res.ok) return [];
  const body = await res.json();
  return body.campaigns ?? [];
}

export async function createCampaign(
  name: string,
): Promise<{ error: { message: string } | null }> {
  const res = await fetch('/api/campaigns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (res.ok) return { error: null };
  return { error: { message: await errorMessage(res) } };
}

export async function joinCampaign(
  inviteCode: string,
): Promise<{ data: unknown; error: { message: string } | null }> {
  const res = await fetch('/api/campaigns/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inviteCode }),
  });
  if (res.ok) return { data: await res.json(), error: null };
  return { data: null, error: { message: await errorMessage(res) } };
}

export async function awardXP(
  characterId: string,
  gain: number,
): Promise<{ error: { message: string } | null }> {
  const res = await fetch(`/api/characters/${characterId}/award-xp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gain }),
  });
  if (res.ok) return { error: null };
  return { error: { message: await errorMessage(res) } };
}

export async function insertPackAnimal(params: {
  campaignId: string;
  name: string;
  mountType: PackAnimalType;
  speed: number;
}): Promise<PackAnimal | null> {
  const res = await fetch(`/api/campaigns/${params.campaignId}/mounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: params.name, mountType: params.mountType, speed: params.speed }),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function removePackAnimal(campaignId: string, animalId: string): Promise<void> {
  await fetch(`/api/campaigns/${campaignId}/mounts/${animalId}`, { method: 'DELETE' });
}
