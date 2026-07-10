/** Client-side wrappers over /api/characters/[id]/retainers. */

export interface DBRetainer {
  id: string;
  name: string;
  kindred: string;
  character_class: string;
  level: number;
  ac: number;
  hp_current: number;
  hp_max: number;
  attack_bonus: number;
  morale: number;
  loyalty: number;
  wage_type: 'daily' | 'share';
  wage_amount: number;
}

export async function listActiveRetainers(characterId: string): Promise<DBRetainer[]> {
  const res = await fetch(`/api/characters/${characterId}/retainers`);
  if (!res.ok) return [];
  const body = await res.json();
  return body.retainers ?? [];
}

export async function insertRetainer(
  characterId: string,
  payload: Record<string, unknown>,
): Promise<DBRetainer | null> {
  const res = await fetch(`/api/characters/${characterId}/retainers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function updateRetainerHP(
  characterId: string,
  retainerId: string,
  hpCurrent: number,
): Promise<void> {
  await fetch(`/api/characters/${characterId}/retainers/${retainerId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hp_current: hpCurrent }),
  });
}

export async function markRetainerPromoted(characterId: string, retainerId: string): Promise<void> {
  await fetch(`/api/characters/${characterId}/retainers/${retainerId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ promoted: true }),
  });
}

export async function deleteRetainer(characterId: string, retainerId: string): Promise<void> {
  await fetch(`/api/characters/${characterId}/retainers/${retainerId}`, { method: 'DELETE' });
}
