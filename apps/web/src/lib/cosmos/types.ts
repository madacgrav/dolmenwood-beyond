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
