import { requireAccountId } from '@/lib/auth/session';
import { badRequest, canReadCharacter, fetchCharacterDocById, forbidden, notFound } from '@/lib/authz';
import type { MountEntryDoc } from '@/lib/cosmos/types';
import type { DBMount } from '@/lib/api/mounts';
import { mutateOwnedCharacterDoc } from './characters';

/**
 * Server-only character mounts, embedded on the character doc. Reads allow
 * the owner or a referee of the owner's campaign (matching the old RLS);
 * mutations are owner-only.
 */

function entryToMount(characterId: string, m: MountEntryDoc): DBMount {
  return {
    id: m.id,
    owner_id: characterId,
    owner_type: 'character',
    character_id: characterId,
    campaign_id: null,
    name: m.name,
    mount_type: m.mountType,
    speed: m.speed,
    has_full_stats: m.hasFullStats,
    ac: m.ac,
    hp_current: m.hpCurrent,
    hp_max: m.hpMax,
    attack_bonus: m.attackBonus,
    morale: m.morale,
    created_at: m.createdAt,
  };
}

export async function listCharacterMounts(characterId: string): Promise<DBMount[]> {
  const me = await requireAccountId();
  const doc = await fetchCharacterDocById(characterId);
  if (!doc) throw notFound('character');
  if (!(await canReadCharacter(me, doc))) throw forbidden();
  return [...(doc.mounts ?? [])]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((m) => entryToMount(characterId, m));
}

export interface NewMountInput {
  name: string;
  mount_type: string;
  speed: number;
  has_full_stats: boolean;
  ac?: number | null;
  hp_current?: number | null;
  hp_max?: number | null;
  attack_bonus?: number | null;
  morale?: number | null;
}

export async function addMount(characterId: string, input: NewMountInput): Promise<DBMount> {
  const name = String(input.name ?? '').trim();
  if (!name) throw badRequest('name is required');
  const entry: MountEntryDoc = {
    id: crypto.randomUUID(),
    name,
    mountType: String(input.mount_type ?? 'Horse'),
    speed: Number(input.speed) || 0,
    hasFullStats: Boolean(input.has_full_stats),
    ac: input.ac ?? null,
    hpCurrent: input.hp_current ?? null,
    hpMax: input.hp_max ?? null,
    attackBonus: input.attack_bonus ?? null,
    morale: input.morale ?? null,
    createdAt: new Date().toISOString(),
  };
  await mutateOwnedCharacterDoc(characterId, (doc) => {
    doc.mounts = [...(doc.mounts ?? []), entry];
  });
  return entryToMount(characterId, entry);
}

export async function updateMountHP(
  characterId: string,
  mountId: string,
  hpCurrent: number,
): Promise<void> {
  await mutateOwnedCharacterDoc(characterId, (doc) => {
    const mount = (doc.mounts ?? []).find((m) => m.id === mountId);
    if (!mount) throw notFound('mount');
    mount.hpCurrent = Math.max(0, Number(hpCurrent) || 0);
  });
}

export async function removeMount(characterId: string, mountId: string): Promise<void> {
  await mutateOwnedCharacterDoc(characterId, (doc) => {
    doc.mounts = (doc.mounts ?? []).filter((m) => m.id !== mountId);
  });
}
