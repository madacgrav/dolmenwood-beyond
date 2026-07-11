import type {
  Character,
  CharacterWithNotes,
  AbilityScores,
} from '@dolmenwood/types';
import type {
  CharacterDoc,
  InventoryEntryDoc,
  SpellSlotDoc,
  SpellPrepDoc,
  SpellbookEntryDoc,
} from '@/lib/cosmos/types';

/**
 * Single source of truth for mapping character documents to the domain
 * types, and back. Successor to the snake_case row mappers from the
 * Supabase era (which existed because four hand-copied mappers had
 * drifted apart). Add new fields HERE, nowhere else.
 */

export function docToCharacter(doc: CharacterDoc): Character {
  return {
    id: doc.id,
    ownerId: doc.ownerId,
    name: doc.name,
    sex: doc.sex ?? undefined,
    age: doc.age ?? undefined,
    height: doc.height ?? undefined,
    weight: doc.weight ?? undefined,
    kindred: doc.kindred as Character['kindred'],
    characterClass: doc.characterClass as Character['characterClass'],
    alignment: doc.alignment as Character['alignment'],
    moonSign: doc.moonSign ?? undefined,
    background: doc.background ?? undefined,
    level: doc.level,
    xp: doc.xp,
    abilityScores: doc.abilityScores,
    hpCurrent: doc.hpCurrent,
    hpMax: doc.hpMax,
    portraitUrl: doc.portraitUrl ?? undefined,
    isActive: doc.isActive,
    extraLanguages: doc.extraLanguages ?? [],
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function docToCharacterWithNotes(doc: CharacterDoc): CharacterWithNotes {
  return {
    ...docToCharacter(doc),
    notes: doc.notes ?? undefined,
    sessionNotes: doc.sessionNotes ?? [],
    peopleOfNote: doc.peopleOfNote ?? [],
  };
}

/** Everything the PDF export needs: the notes projection plus coins and the embedded arrays. */
export type FullCharacter = CharacterWithNotes & {
  coinsGp: number;
  coinsSp: number;
  coinsCp: number;
  inventory: InventoryEntryDoc[];
  spellSlots: SpellSlotDoc[];
  spellPreparations: SpellPrepDoc[];
  spellbook: SpellbookEntryDoc[];
};

export function docToFullCharacter(doc: CharacterDoc): FullCharacter {
  return {
    ...docToCharacterWithNotes(doc),
    coinsGp: doc.coinsGp,
    coinsSp: doc.coinsSp,
    coinsCp: doc.coinsCp,
    inventory: doc.inventory ?? [],
    spellSlots: doc.spellSlots ?? [],
    spellPreparations: doc.spellPreparations ?? [],
    spellbook: doc.spellbook ?? [],
  };
}

export interface NewCharacterInput {
  name: string;
  sex?: string | null;
  age?: string | null;
  height?: string | null;
  weight?: string | null;
  kindred: string;
  characterClass: string;
  alignment: string;
  background?: string | null;
  level?: number;
  xp?: number;
  abilityScores: AbilityScores;
  hpCurrent?: number;
  hpMax: number;
  portraitUrl?: string | null;
}

export function newCharacterToDoc(ownerId: string, input: NewCharacterInput): CharacterDoc {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    ownerId,
    name: input.name,
    sex: input.sex || null,
    age: input.age || null,
    height: input.height || null,
    weight: input.weight || null,
    kindred: input.kindred,
    characterClass: input.characterClass,
    alignment: input.alignment,
    moonSign: null,
    background: input.background || null,
    level: input.level ?? 1,
    xp: input.xp ?? 0,
    abilityScores: input.abilityScores,
    hpCurrent: input.hpCurrent ?? input.hpMax,
    hpMax: input.hpMax,
    portraitUrl: input.portraitUrl ?? null,
    isActive: true,
    extraLanguages: [],
    notes: null,
    sessionNotes: [],
    peopleOfNote: [],
    coinsGp: 0,
    coinsSp: 0,
    coinsCp: 0,
    inventory: [],
    spellSlots: [],
    spellPreparations: [],
    spellbook: [],
    bankLedger: [],
    levelUpLogs: [],
    mounts: [],
    retainers: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** Fields a PATCH may change (port of the Supabase-era UPDATE_COLUMNS whitelist). */
const UPDATABLE_FIELDS = [
  'name',
  'level',
  'xp',
  'abilityScores',
  'hpCurrent',
  'hpMax',
  'portraitUrl',
  'isActive',
  'extraLanguages',
  'notes',
  'sessionNotes',
  'peopleOfNote',
] as const;

export function applyCharacterUpdates(doc: CharacterDoc, updates: Partial<CharacterWithNotes>): void {
  for (const field of UPDATABLE_FIELDS) {
    const value = updates[field];
    if (value !== undefined) {
      (doc as unknown as Record<string, unknown>)[field] = value;
    }
  }
}
