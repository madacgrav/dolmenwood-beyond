import type { Character, CharacterWithNotes } from '@dolmenwood/types';
import { getContainer } from '@/lib/cosmos/client';
import type { CharacterDoc } from '@/lib/cosmos/types';
import { requireAccountId } from '@/lib/auth/session';
import {
  assertCharacterOwner,
  canReadCharacter,
  fetchCharacterDocById,
  forbidden,
  notFound,
} from '@/lib/authz';
import {
  docToCharacter,
  docToCharacterWithNotes,
  docToFullCharacter,
  newCharacterToDoc,
  applyCharacterUpdates,
  type NewCharacterInput,
  type FullCharacter,
} from './mappers/character';

export type { NewCharacterInput };

/**
 * Server-only character data access. The current account is resolved from
 * the session (never trusted from the client), and every function enforces
 * ownership — the app-code replacement for the characters RLS policies.
 */

const characters = () => getContainer('characters');

/**
 * Read-modify-write with optimistic concurrency: replace fails on a stale
 * ETag (someone else wrote between our read and write) and the whole
 * fetch → authorize → mutate cycle re-runs against a fresh read. Shared by
 * every character-doc mutation (inventory, spells, banking, level-up).
 *
 * `fetchAuthorized` must return the doc only after asserting the caller may
 * mutate it — ownership for most operations, owner-or-referee for banking.
 */
export async function mutateCharacterDoc(
  fetchAuthorized: () => Promise<CharacterDoc>,
  mutate: (doc: CharacterDoc) => void,
): Promise<CharacterDoc> {
  for (let attempt = 0; ; attempt++) {
    const doc = await fetchAuthorized();
    mutate(doc);
    doc.updatedAt = new Date().toISOString();
    try {
      const { resource } = await characters()
        .item(doc.id, doc.ownerId)
        .replace(doc, { accessCondition: { type: 'IfMatch', condition: doc._etag! } });
      return resource as CharacterDoc;
    } catch (e) {
      const code = (e as { code?: number }).code;
      if (code === 412 && attempt < 3) continue; // stale ETag — retry on fresh read
      throw e;
    }
  }
}

/** Owner-scoped variant — the common case. */
export async function mutateOwnedCharacterDoc(
  characterId: string,
  mutate: (doc: CharacterDoc) => void,
): Promise<CharacterDoc> {
  const me = await requireAccountId();
  return mutateCharacterDoc(() => assertCharacterOwner(me, characterId), mutate);
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function listCharacters(): Promise<Character[]> {
  return (await listCharacterDocs()).map(docToCharacter);
}

/**
 * Roster view: characters plus their equipped-armor AC bonus, computed from
 * the embedded inventory of the same documents — no second query.
 */
export async function listCharactersWithArmor(): Promise<{
  characters: Character[];
  armorByCharacter: Record<string, number>;
}> {
  const docs = await listCharacterDocs();
  const armorByCharacter: Record<string, number> = {};
  for (const doc of docs) {
    armorByCharacter[doc.id] = (doc.inventory ?? [])
      .filter((e) => e.location === 'equipped')
      .reduce((sum, e) => sum + (e.armorAcBonus ?? 0), 0);
  }
  return { characters: docs.map(docToCharacter), armorByCharacter };
}

async function listCharacterDocs(): Promise<CharacterDoc[]> {
  const me = await requireAccountId();
  const { resources } = await characters()
    .items.query<CharacterDoc>(
      {
        query: 'SELECT * FROM c WHERE c.ownerId = @me ORDER BY c.updatedAt DESC',
        parameters: [{ name: '@me', value: me }],
      },
      { partitionKey: me },
    )
    .fetchAll();
  return resources;
}

/** Owner-only full projection (coins, inventory, spells) for the PDF export. */
export async function fetchFullCharacter(id: string): Promise<FullCharacter> {
  const me = await requireAccountId();
  const doc = await assertCharacterOwner(me, id);
  return docToFullCharacter(doc);
}

/** Readable by the owner or a referee of a campaign the owner belongs to. */
export async function fetchCharacterWithNotes(id: string): Promise<CharacterWithNotes> {
  const me = await requireAccountId();
  const doc = await fetchCharacterDocById(id);
  if (!doc) throw notFound('character');
  if (!(await canReadCharacter(me, doc))) throw forbidden();
  return docToCharacterWithNotes(doc);
}

export async function updateCharacter(
  id: string,
  updates: Partial<CharacterWithNotes>,
): Promise<void> {
  await mutateOwnedCharacterDoc(id, (doc) => applyCharacterUpdates(doc, updates));
}

export async function deleteCharacter(id: string): Promise<void> {
  const me = await requireAccountId();
  const doc = await assertCharacterOwner(me, id);
  await characters().item(doc.id, doc.ownerId).delete();
}

// ── Coins (live on the character doc) ─────────────────────────────────────────

export interface Coins {
  gp: number;
  sp: number;
  cp: number;
}

export async function fetchCoins(characterId: string): Promise<Coins> {
  const me = await requireAccountId();
  const doc = await assertCharacterOwner(me, characterId);
  return { gp: doc.coinsGp ?? 0, sp: doc.coinsSp ?? 0, cp: doc.coinsCp ?? 0 };
}

export async function saveCoins(characterId: string, coins: Coins): Promise<void> {
  await mutateOwnedCharacterDoc(characterId, (doc) => {
    doc.coinsGp = coins.gp;
    doc.coinsSp = coins.sp;
    doc.coinsCp = coins.cp;
  });
}

// ── Creation ──────────────────────────────────────────────────────────────────

export async function createCharacter(input: NewCharacterInput): Promise<{ id: string }> {
  const me = await requireAccountId();
  const doc = newCharacterToDoc(me, input);
  await characters().items.create(doc);
  return { id: doc.id };
}
