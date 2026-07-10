import type { AbilityScores, SessionNote, PersonOfNote } from '@dolmenwood/types';

/**
 * Cosmos DB document shapes, one interface per container. These are the
 * persistence-layer types — domain types stay in @dolmenwood/types and are
 * bridged by the mappers in lib/data/mappers/.
 */

/** Container `accounts`, partition key `/id`. */
export interface AccountDoc {
  id: string;
  email: string;
  role: 'player' | 'referee';
  displayName: string;
  inviteCode: string;
  isAdmin: boolean;
  phone: string | null;
  emailOptIn: boolean;
  smsOptIn: boolean;
  whatsappOptIn: boolean;
  whatsappConsentAt: string | null;
  /** null ⇒ account must go through the password-reset flow (e.g. migrated from Supabase). */
  passwordHash: string | null;
  requiresPasswordReset: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Embedded inventory entry (collapses the two legacy inventory tables). */
export interface InventoryEntryDoc {
  id: string;
  itemName: string;
  itemType: string;
  quantity: number;
  weightCoins: number;
  notes: string | null;
  location: 'equipped' | 'stowed' | 'tiny';
  weaponDamageDice: string | null;
  armorAcBonus: number | null;
  catalogItemId: string | null;
}

export interface SpellSlotDoc {
  id: string;
  rank: number;
  slotsTotal: number;
  slotsUsed: number;
}

export interface SpellPrepDoc {
  id: string;
  slotRank: number;
  spellName: string;
  isCast: boolean;
  createdAt: string;
}

export interface SpellbookEntryDoc {
  id: string;
  spellName: string;
  spellLevel: number;
  isMemorized: boolean;
  notes: string | null;
}

/** Container `characters`, partition key `/ownerId`. The character aggregate —
 *  later phases embed inventory, spells, bank ledger, and level-up logs here. */
export interface CharacterDoc {
  id: string;
  ownerId: string;
  name: string;
  sex: string | null;
  age: string | null;
  height: string | null;
  weight: string | null;
  kindred: string;
  characterClass: string;
  alignment: string;
  moonSign: string | null;
  background: string | null;
  level: number;
  xp: number;
  abilityScores: AbilityScores;
  hpCurrent: number;
  hpMax: number;
  portraitUrl: string | null;
  isActive: boolean;
  extraLanguages: string[];
  notes: string | null;
  sessionNotes: SessionNote[];
  peopleOfNote: PersonOfNote[];
  coinsGp: number;
  coinsSp: number;
  coinsCp: number;
  /** Optional: absent on documents created before phase 3b — default to []. */
  inventory?: InventoryEntryDoc[];
  spellSlots?: SpellSlotDoc[];
  spellPreparations?: SpellPrepDoc[];
  spellbook?: SpellbookEntryDoc[];
  createdAt: string;
  updatedAt: string;
  /** Cosmos system property — used for optimistic-concurrency replaces. */
  _etag?: string;
}

/** Container `catalog_items`, partition key `/itemType`. */
export interface CatalogItemDoc {
  id: string;
  itemType: string;
  name: string;
  weight: number;
  costGp: number | null;
  costSp: number | null;
  costCp: number | null;
  weaponDamageDice: string | null;
  armorAcBonus: number | null;
  qualities: string[];
  size: string | null;
  notes: string | null;
}
