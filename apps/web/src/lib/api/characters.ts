import type { Character, CharacterWithNotes } from '@dolmenwood/types';
import type { Coins } from '@/lib/data/characters';
import type { NewCharacterInput } from '@/lib/data/mappers/character';

export type { Coins, NewCharacterInput };

/**
 * Client-side wrappers over the /api/characters routes. Deliberately keep
 * the error-shaped signatures the components were built against in the
 * Supabase era (string | null errors, null on missing) so call sites only
 * swap the import and drop the client argument.
 */

async function errorText(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  return body?.error ?? `request failed (${res.status})`;
}

export async function listCharacters(): Promise<{
  characters: Character[];
  acByCharacter: Record<string, number>;
  error: string | null;
}> {
  const res = await fetch('/api/characters');
  if (!res.ok) return { characters: [], acByCharacter: {}, error: await errorText(res) };
  const body = await res.json();
  return {
    characters: body.characters ?? [],
    acByCharacter: body.acByCharacter ?? {},
    error: null,
  };
}

export async function fetchCharacterWithNotes(id: string): Promise<CharacterWithNotes | null> {
  const res = await fetch(`/api/characters/${id}`);
  if (!res.ok) return null;
  return res.json();
}

/** The full document is a superset of Character — reuse the same route. */
export async function fetchCharacter(id: string): Promise<Character | null> {
  return fetchCharacterWithNotes(id);
}

export async function updateCharacter(
  id: string,
  updates: Partial<CharacterWithNotes>,
): Promise<string | null> {
  const res = await fetch(`/api/characters/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  return res.ok ? null : errorText(res);
}

/** Set the character's absolute XP total; the server records the delta in the XP log. */
export async function adjustXP(id: string, newTotal: number): Promise<string | null> {
  const res = await fetch(`/api/characters/${id}/adjust-xp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newTotal }),
  });
  return res.ok ? null : errorText(res);
}

export async function deleteCharacter(id: string): Promise<string | null> {
  const res = await fetch(`/api/characters/${id}`, { method: 'DELETE' });
  return res.ok ? null : errorText(res);
}

export async function createCharacter(
  input: NewCharacterInput,
): Promise<{ id: string | null; error: string | null }> {
  const res = await fetch('/api/characters', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) return { id: null, error: await errorText(res) };
  const body = await res.json();
  return { id: body.id ?? null, error: null };
}

export async function fetchCoins(characterId: string): Promise<Coins> {
  const res = await fetch(`/api/characters/${characterId}/coins`);
  if (!res.ok) return { gp: 0, sp: 0, cp: 0 };
  return res.json();
}

export async function saveCoins(characterId: string, coins: Coins): Promise<string | null> {
  const res = await fetch(`/api/characters/${characterId}/coins`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(coins),
  });
  return res.ok ? null : errorText(res);
}

/** Server-enforced spend: deducts across denominations, 400 on insufficient funds. */
export async function spendCoins(
  characterId: string,
  amount: number,
  denom: 'gp' | 'sp' | 'cp',
): Promise<{ coins: Coins | null; error: string | null }> {
  const res = await fetch(`/api/characters/${characterId}/coins/spend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, denom }),
  });
  if (!res.ok) return { coins: null, error: await errorText(res) };
  return { coins: await res.json(), error: null };
}
