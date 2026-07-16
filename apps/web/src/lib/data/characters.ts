import type { Character, CharacterWithNotes } from '@dolmenwood/types';
import { deriveCharacterAC, type ACItem } from '@dolmenwood/rules-engine';
import { getContainer } from '@/lib/cosmos/client';
import type { CharacterDoc } from '@/lib/cosmos/types';
import { requireAccountId } from '@/lib/auth/session';
import {
  assertCharacterOwner,
  badRequest,
  canReadCharacter,
  fetchCharacterDocById,
  forbidden,
  notFound,
} from '@/lib/authz';
import { toCp, fromCp } from '@/lib/coins';
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
 * Roster view: characters plus their full derived AC, computed from the
 * embedded inventory of the same documents — no second query.
 */
export async function listCharactersWithArmor(): Promise<{
  characters: Character[];
  acByCharacter: Record<string, number>;
}> {
  const docs = await listCharacterDocs();
  const acByCharacter: Record<string, number> = {};
  for (const doc of docs) {
    const items: ACItem[] = (doc.inventory ?? []).map((e) => ({
      location: e.location,
      armorAcBonus: e.armorAcBonus,
      isShield: e.isShield,
      armorBulk: e.armorBulk,
    }));
    acByCharacter[doc.id] = deriveCharacterAC(doc, items).total;
  }
  return { characters: docs.map(docToCharacter), acByCharacter };
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

/** Owner-only absolute XP set with an append to the xp log. Replaces the
 *  generic PATCH path for the `xp` field so every change is recorded. */
export async function adjustXP(characterId: string, newTotal: number): Promise<{ xp: number }> {
  if (!Number.isInteger(newTotal) || newTotal < 0) throw badRequest('xp must be a non-negative integer');
  const me = await requireAccountId();
  const doc = await mutateOwnedCharacterDoc(characterId, (d) => {
    const delta = newTotal - d.xp;
    d.xp = newTotal;
    d.xpLog = [...(d.xpLog ?? []), {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      delta,
      newTotal,
      source: 'manual_edit' as const,
      actorId: me,
    }];
  });
  return { xp: doc.xp };
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

/** Owner-only spend: deducts amountCp across the purse (making change from
 *  larger denominations), guarding against overspend. Returns the new counts. */
export async function spendCoins(characterId: string, amountCp: number): Promise<Coins> {
  if (!Number.isInteger(amountCp) || amountCp <= 0) throw badRequest('amount must be a positive integer');
  const doc = await mutateOwnedCharacterDoc(characterId, (d) => {
    const have = toCp({ gp: d.coinsGp ?? 0, sp: d.coinsSp ?? 0, cp: d.coinsCp ?? 0 });
    if (have < amountCp) throw badRequest('insufficient funds');
    const next = fromCp(have - amountCp);
    d.coinsGp = next.gp;
    d.coinsSp = next.sp;
    d.coinsCp = next.cp;
  });
  return { gp: doc.coinsGp, sp: doc.coinsSp, cp: doc.coinsCp };
}

// ── Creation ──────────────────────────────────────────────────────────────────

export async function createCharacter(input: NewCharacterInput): Promise<{ id: string }> {
  const me = await requireAccountId();
  const doc = newCharacterToDoc(me, input);
  await characters().items.create(doc);
  return { id: doc.id };
}
