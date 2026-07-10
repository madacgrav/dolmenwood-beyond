/** Client-side wrappers over /api/characters/[id]/mounts. */

export interface DBMount {
  id: string;
  owner_id: string;
  owner_type: string;
  character_id: string | null;
  campaign_id: string | null;
  name: string;
  mount_type: string;
  speed: number;
  has_full_stats: boolean;
  ac: number | null;
  hp_current: number | null;
  hp_max: number | null;
  attack_bonus: number | null;
  morale: number | null;
  created_at: string;
}

export async function listCharacterMounts(characterId: string): Promise<DBMount[]> {
  const res = await fetch(`/api/characters/${characterId}/mounts`);
  if (!res.ok) return [];
  const body = await res.json();
  return body.mounts ?? [];
}

export async function insertMount(
  characterId: string,
  payload: Record<string, unknown>,
): Promise<DBMount | null> {
  const res = await fetch(`/api/characters/${characterId}/mounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function updateMountHP(
  characterId: string,
  mountId: string,
  hpCurrent: number,
): Promise<void> {
  await fetch(`/api/characters/${characterId}/mounts/${mountId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hp_current: hpCurrent }),
  });
}

export async function deleteMount(characterId: string, mountId: string): Promise<void> {
  await fetch(`/api/characters/${characterId}/mounts/${mountId}`, { method: 'DELETE' });
}
