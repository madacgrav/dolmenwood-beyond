// Core entity types matching the Dolmenwood Beyond data model

export type Alignment = 'lawful' | 'neutral' | 'chaotic';
export type WeightLocation = 'equipped' | 'stowed' | 'tiny';
export type ItemType = 'weapon' | 'armor' | 'gear' | 'spell_component' | 'ammo' | 'coin';
export type ArmorBulk = 'none' | 'light' | 'medium' | 'heavy';
export type WageType = 'daily' | 'share';
export type OwnerType = 'character' | 'retainer' | 'mount';
export type SpellRank = 1 | 2 | 3 | 4 | 5 | 6;

export type Kindred = 'Human' | 'Breggle' | 'Elf' | 'Grimalkin' | 'Mossling' | 'Woodgrue';
export type CharacterClass =
  | 'Cleric'
  | 'Enchanter'
  | 'Fighter'
  | 'Friar'
  | 'Hunter'
  | 'Knight'
  | 'Magician'
  | 'Thief'
  | 'Bard';

export interface AbilityScores {
  str: number;
  int: number;
  wis: number;
  dex: number;
  con: number;
  cha: number;
}

export interface SaveTargets {
  doom: number;
  ray: number;
  hold: number;
  blast: number;
  spell: number;
}

export interface Account {
  id: string;
  email: string;
  displayName: string;
}

export interface Campaign {
  id: string;
  name: string;
  refereeId: string;
  inviteCode: string;
  createdAt: string;
}

export interface CampaignMember {
  campaignId: string;
  accountId: string;
  joinedAt: string;
}

export interface Character {
  id: string;
  ownerId: string;
  name: string;
  sex?: string;
  age?: string;
  height?: string;
  weight?: string;
  kindred: Kindred;
  characterClass: CharacterClass;
  alignment: Alignment;
  moonSign?: string;
  background?: string;
  traits?: string;
  level: number;
  xp: number;
  abilityScores: AbilityScores;
  hpCurrent: number;
  hpMax: number;
  portraitUrl?: string;
  isActive: boolean;
  extraLanguages?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SessionNote {
  id: string;
  date: string;
  text: string;
}

export interface PersonOfNote {
  id: string;
  name: string;
  note: string;
}

export interface CharacterCampaignData {
  characterId: string;
  campaignId: string;
  xpEarnedThisCampaign: number;
  notes?: string;
  affiliation?: string;
}

export interface Retainer {
  id: string;
  ownerCharacterId: string;
  name: string;
  kindred: Kindred;
  characterClass: CharacterClass;
  level: number;
  ac: number;
  hpCurrent: number;
  hpMax: number;
  attackBonus: number;
  saves: SaveTargets;
  speed: number;
  morale: number;
  loyalty: number;
  wageType: WageType;
  wageAmount: number;
  isPromotedToPC: boolean;
}

export interface Mount {
  id: string;
  ownerId: string;
  campaignId?: string;
  name: string;
  mountType: string;
  speed: number;
  hasFullStats: boolean;
  ac?: number;
  hpCurrent?: number;
  hpMax?: number;
  attackBonus?: number;
  saves?: SaveTargets;
  morale?: number;
}

export interface InventoryItem {
  id: string;
  ownerType: OwnerType;
  ownerId: string;
  name: string;
  quantity: number;
  weight: number;
  weightOverride?: number;
  location: WeightLocation;
  isConsumable: boolean;
  itemType: ItemType;
  weaponDamageDice?: string;
  weaponAttackBonus?: number;
  armorAcBonus?: number;
  isShield?: boolean;
  armorBulk?: ArmorBulk;
  isFromCatalog: boolean;
}

export interface SpellSlot {
  characterId: string;
  spellRank: SpellRank;
  slotsTotal: number;
  slotsUsed: number;
  spellsMemorized: string[];
}

export interface LevelUpLog {
  id: string;
  characterId: string;
  fromLevel: number;
  toLevel: number;
  timestamp: string;
  changes: LevelUpChange[];
  hpRoll: number;
  hpRollFinal: number;
}

export interface LevelUpChange {
  field: string;
  oldValue: string | number;
  newValue: string | number;
}

export type XPLogSource = 'dm_award' | 'manual_edit' | 'level_up';

export interface XPLogEntry {
  id: string;
  timestamp: string;   // server ISO-8601
  delta: number;       // signed; 0 for level_up
  newTotal: number;    // character xp after the mutation
  source: XPLogSource;
  actorId: string;     // DM account id for dm_award; owner id otherwise
  toLevel?: number;    // only on level_up entries
}

// Derived stats (computed by rules engine, not stored)
export interface DerivedStats {
  abilityModifiers: Record<keyof AbilityScores, number>;
  ac: number;
  acBreakdown: ACBreakdown;
  attackBonus: number;
  saves: SaveTargets;
  speed: number;
  speedBreakdown: SpeedBreakdown;
  xpModifier: number;
  magicResistance: number;
  maxRetainers: number;
  retainerLoyaltyBase: number;
  skills: SkillTarget[];
  spellSlots?: SpellSlotTable;
}

export interface ACBreakdown {
  base: 10;
  dexModifier: number;
  armorBonus: number;
  kindredBonus: number;
  classBonus: number;
  shieldBonus: number;
  total: number;
}

export interface SpeedBreakdown {
  totalEquippedWeight: number;
  speed: 10 | 20 | 30 | 40;
}

export interface SkillTarget {
  name: string;
  target: number;
  isUniversal: boolean;
}

export interface SpellSlotTable {
  [rank: number]: number;
}

/**
 * Character extended with optional notes fields stored as JSONB columns.
 * Used across the character sheet, view page, and sub-components so that
 * a single canonical definition is shared rather than duplicated per file.
 */
export type CharacterWithNotes = Character & {
  notes?: string;
  sessionNotes?: SessionNote[];
  peopleOfNote?: PersonOfNote[];
};
