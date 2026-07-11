import type { AbilityScores, SessionNote, PersonOfNote, LevelUpChange } from '@dolmenwood/types';

/**
 * Cosmos DB document shapes, one interface per container. These are the
 * persistence-layer types — domain types stay in @dolmenwood/types and are
 * bridged by the mappers in lib/data/mappers/.
 */

/** Container `accounts`, partition key `/id`. */
export interface AccountDoc {
  id: string;
  email: string;
  // 'referee' is the stored value for the Dungeon Master (DM) role — kept for
  // storage compatibility (no data migration). UI and identifiers say "DM".
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

/** Character-owned mount (Knights get full combat stats). */
export interface MountEntryDoc {
  id: string;
  name: string;
  mountType: string;
  speed: number;
  hasFullStats: boolean;
  ac: number | null;
  hpCurrent: number | null;
  hpMax: number | null;
  attackBonus: number | null;
  morale: number | null;
  createdAt: string;
}

export interface RetainerEntryDoc {
  id: string;
  name: string;
  kindred: string;
  characterClass: string;
  level: number;
  ac: number;
  hpCurrent: number;
  hpMax: number;
  attackBonus: number;
  morale: number;
  loyalty: number;
  wageType: 'daily' | 'share';
  wageAmount: number;
  isPromotedToPc: boolean;
  createdAt: string;
}

/** Signed bank ledger entry: positive = deposit into bank, negative = payout. */
export interface BankLedgerEntryDoc {
  id: string;
  amountGp: number;
  description: string;
  performedBy: string;
  createdAt: string;
}

export interface LevelUpLogDoc {
  id: string;
  fromLevel: number;
  toLevel: number;
  timestamp: string;
  changes: LevelUpChange[];
  hpRoll: number;
  hpRollFinal: number;
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
  /** Optional: absent on documents created before phases 3b/4 — default to []. */
  inventory?: InventoryEntryDoc[];
  spellSlots?: SpellSlotDoc[];
  spellPreparations?: SpellPrepDoc[];
  spellbook?: SpellbookEntryDoc[];
  bankLedger?: BankLedgerEntryDoc[];
  levelUpLogs?: LevelUpLogDoc[];
  mounts?: MountEntryDoc[];
  retainers?: RetainerEntryDoc[];
  createdAt: string;
  updatedAt: string;
  /** Cosmos system property — used for optimistic-concurrency replaces. */
  _etag?: string;
}

/** Party-owned pack animal, embedded on the campaign. */
export interface PartyMountDoc {
  id: string;
  name: string;
  mountType: string;
  speed: number;
  addedBy: string;
  createdAt: string;
}

export interface SessionEntryDoc {
  id: string;
  title: string;
  scheduledAt: string;
  notes: string;
  createdBy: string;
  rsvps: { accountId: string; status: 'yes' | 'no' | 'maybe'; updatedAt: string }[];
  createdAt: string;
}

export interface ProposalEntryDoc {
  id: string;
  title: string;
  scheduledAt: string;
  notes: string;
  status: 'open' | 'confirmed' | 'cancelled';
  confirmedSessionId: string | null;
  createdBy: string;
  availability: { accountId: string; available: boolean; updatedAt: string }[];
  createdAt: string;
}

/** Container `campaigns`, partition key `/id`. */
export interface CampaignDoc {
  id: string;
  name: string;
  // The DM's account id. Field name kept from the "referee" era for storage
  // compatibility (no data migration). UI and identifiers say "DM".
  refereeId: string;
  inviteCode: string;
  members: { accountId: string; joinedAt: string }[];
  partyMounts: PartyMountDoc[];
  /** Optional: absent on documents created before phase 6 — default to []. */
  sessions?: SessionEntryDoc[];
  proposals?: ProposalEntryDoc[];
  createdAt: string;
  _etag?: string;
}

/** Embedded outbox delivery — replaces the notification_deliveries table. */
export interface DeliveryDoc {
  channel: 'email' | 'sms' | 'whatsapp';
  status: 'pending' | 'sent' | 'failed';
  sentAt: string | null;
  error: string | null;
  attempts: number;
}

/** Container `notifications`, partition key `/accountId`. */
export interface NotificationDoc {
  id: string;
  accountId: string;
  campaignId: string | null;
  kind: string; // 'date_confirmed' | 'date_suggested'
  body: string;
  relatedSessionId: string | null;
  read: boolean;
  deliveries: DeliveryDoc[];
  createdAt: string;
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

/** Container `noble_houses`, partition key `/id`. */
export interface NobleHouseDoc {
  id: string;
  name: string;
  alignment: 'Lawful' | 'Neutral' | 'Chaotic';
  domain: string;
  seat: string;
  head: string;
}
