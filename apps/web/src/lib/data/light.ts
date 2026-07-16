import { requireAccountId } from '@/lib/auth/session';
import { assertCharacterOwner, badRequest, notFound } from '@/lib/authz';
import type { ActiveLightDoc } from '@/lib/cosmos/types';
import { lightSourceFor } from '@/lib/light-data';
import { mutateOwnedCharacterDoc } from './characters';

/**
 * Server-only light-tracker access. Active lights are embedded on the
 * character doc; lighting a source also decrements its inventory quantity
 * inside the same ETag-guarded write, so the two can never drift apart.
 */

export async function listLights(characterId: string): Promise<ActiveLightDoc[]> {
  const me = await requireAccountId();
  const doc = await assertCharacterOwner(me, characterId);
  return doc.activeLights ?? [];
}

/** Consume one of the inventory item and start a burn tracker for it. */
export async function lightSource(
  characterId: string,
  itemId: string,
): Promise<ActiveLightDoc[]> {
  const doc = await mutateOwnedCharacterDoc(characterId, (d) => {
    const entry = (d.inventory ?? []).find((e) => e.id === itemId);
    if (!entry) throw notFound('inventory item');
    const source = lightSourceFor(entry.itemName);
    if (!source) throw badRequest('not a light source');
    if (entry.quantity <= 0) throw badRequest('none left to light');
    entry.quantity -= 1;
    d.activeLights = [
      ...(d.activeLights ?? []),
      {
        id: crypto.randomUUID(),
        itemName: entry.itemName,
        turnsRemaining: source.turns,
        totalTurns: source.turns,
        litAt: new Date().toISOString(),
      },
    ];
  });
  return doc.activeLights ?? [];
}

/** Burn down a light by the given number of turns (default 1), flooring at 0. */
export async function burnTurn(
  characterId: string,
  lightId: string,
  turns = 1,
): Promise<ActiveLightDoc[]> {
  const doc = await mutateOwnedCharacterDoc(characterId, (d) => {
    const light = (d.activeLights ?? []).find((l) => l.id === lightId);
    if (!light) throw notFound('active light');
    light.turnsRemaining = Math.max(0, light.turnsRemaining - Math.max(1, Math.floor(turns) || 1));
  });
  return doc.activeLights ?? [];
}

/** Remove a light from the tracker (burned out or put out early). */
export async function extinguish(
  characterId: string,
  lightId: string,
): Promise<ActiveLightDoc[]> {
  const doc = await mutateOwnedCharacterDoc(characterId, (d) => {
    d.activeLights = (d.activeLights ?? []).filter((l) => l.id !== lightId);
  });
  return doc.activeLights ?? [];
}
