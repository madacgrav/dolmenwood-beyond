import type { ActiveLightDoc } from '@/lib/cosmos/types';

export type { ActiveLightDoc };

/** Client-side wrappers over the /api/characters/[id]/light route. */

async function post(characterId: string, body: object): Promise<ActiveLightDoc[]> {
  const res = await fetch(`/api/characters/${characterId}/light`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error ?? `request failed (${res.status})`);
  }
  return res.json();
}

export async function listLights(characterId: string): Promise<ActiveLightDoc[]> {
  const res = await fetch(`/api/characters/${characterId}/light`);
  if (!res.ok) return [];
  return res.json();
}

export function lightSource(characterId: string, itemId: string): Promise<ActiveLightDoc[]> {
  return post(characterId, { action: 'light', itemId });
}

export function burnTurn(characterId: string, lightId: string, turns = 1): Promise<ActiveLightDoc[]> {
  return post(characterId, { action: 'burn', lightId, turns });
}

export function extinguish(characterId: string, lightId: string): Promise<ActiveLightDoc[]> {
  return post(characterId, { action: 'extinguish', lightId });
}
