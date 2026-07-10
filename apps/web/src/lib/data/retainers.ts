import { requireAccountId } from '@/lib/auth/session';
import { badRequest, canReadCharacter, fetchCharacterDocById, forbidden, notFound } from '@/lib/authz';
import type { RetainerEntryDoc } from '@/lib/cosmos/types';
import type { DBRetainer } from '@/lib/api/retainers';
import { mutateOwnedCharacterDoc } from './characters';

/**
 * Server-only retainers, embedded on the character doc. Reads allow the
 * owner or a referee of the owner's campaign; mutations are owner-only.
 */

function entryToRetainer(e: RetainerEntryDoc): DBRetainer {
  return {
    id: e.id,
    name: e.name,
    kindred: e.kindred,
    character_class: e.characterClass,
    level: e.level,
    ac: e.ac,
    hp_current: e.hpCurrent,
    hp_max: e.hpMax,
    attack_bonus: e.attackBonus,
    morale: e.morale,
    loyalty: e.loyalty,
    wage_type: e.wageType,
    wage_amount: e.wageAmount,
  };
}

/** Retainers still in service (not yet promoted to a full PC). */
export async function listActiveRetainers(characterId: string): Promise<DBRetainer[]> {
  const me = await requireAccountId();
  const doc = await fetchCharacterDocById(characterId);
  if (!doc) throw notFound('character');
  if (!(await canReadCharacter(me, doc))) throw forbidden();
  return [...(doc.retainers ?? [])]
    .filter((r) => !r.isPromotedToPc)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(entryToRetainer);
}

export interface NewRetainerInput {
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

export async function addRetainer(
  characterId: string,
  input: NewRetainerInput,
): Promise<DBRetainer> {
  const name = String(input.name ?? '').trim();
  if (!name) throw badRequest('name is required');
  const entry: RetainerEntryDoc = {
    id: crypto.randomUUID(),
    name,
    kindred: String(input.kindred ?? 'Human'),
    characterClass: String(input.character_class ?? 'Fighter'),
    level: Number(input.level) || 1,
    ac: Number(input.ac) || 10,
    hpCurrent: Number(input.hp_current) || 1,
    hpMax: Number(input.hp_max) || 1,
    attackBonus: Number(input.attack_bonus) || 0,
    morale: Number(input.morale) || 7,
    loyalty: Number(input.loyalty) || 7,
    wageType: input.wage_type === 'share' ? 'share' : 'daily',
    wageAmount: Number(input.wage_amount) || 0,
    isPromotedToPc: false,
    createdAt: new Date().toISOString(),
  };
  await mutateOwnedCharacterDoc(characterId, (doc) => {
    doc.retainers = [...(doc.retainers ?? []), entry];
  });
  return entryToRetainer(entry);
}

export async function updateRetainerHP(
  characterId: string,
  retainerId: string,
  hpCurrent: number,
): Promise<void> {
  await mutateOwnedCharacterDoc(characterId, (doc) => {
    const r = (doc.retainers ?? []).find((x) => x.id === retainerId);
    if (!r) throw notFound('retainer');
    r.hpCurrent = Math.max(0, Math.min(r.hpMax, Number(hpCurrent) || 0));
  });
}

export async function markRetainerPromoted(characterId: string, retainerId: string): Promise<void> {
  await mutateOwnedCharacterDoc(characterId, (doc) => {
    const r = (doc.retainers ?? []).find((x) => x.id === retainerId);
    if (!r) throw notFound('retainer');
    r.isPromotedToPc = true;
  });
}

export async function removeRetainer(characterId: string, retainerId: string): Promise<void> {
  await mutateOwnedCharacterDoc(characterId, (doc) => {
    doc.retainers = (doc.retainers ?? []).filter((x) => x.id !== retainerId);
  });
}
