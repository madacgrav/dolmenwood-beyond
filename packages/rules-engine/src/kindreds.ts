import kindredData from './data/kindreds.json';

export type KindredName = keyof typeof kindredData;

export interface KindredTrait {
  name: string;
  description: string;
}

export interface KindredData {
  kindredType: string;
  nativeLanguages: string[];
  traits: KindredTrait[];
  acBonus?: string;
  xpBonusPct?: number;
  classRestrictions: {
    common?: string[];
    rare?: string[];
    veryRare?: string[];
    forbidden?: string[];
    notes?: string;
  };
  naturalAttack?: {
    weapon: string;
    baseDamage: string;
  } | null;
  [key: string]: unknown;
}

export function getKindredData(kindred: string): KindredData | null {
  return (kindredData as unknown as Record<string, KindredData>)[kindred] ?? null;
}

export function getKindredXPBonus(kindred: string): number {
  return getKindredData(kindred)?.xpBonusPct ?? 0;
}

export function getKindredACBonus(kindred: string): number {
  const data = getKindredData(kindred);
  if (!data) return 0;
  const match = data.acBonus?.match(/\+(\d+)/);
  return match ? parseInt(match[1]!, 10) : 0;
}

export function getKindredMagicResistance(kindred: string): number {
  const mr = getKindredData(kindred)?.magicResistance;
  return typeof mr === 'number' ? mr : 0;
}

/** True when the kindred's AC bonus is conditional on light/no armour (e.g. Breggle). */
export function isKindredACBonusArmorConditional(kindred: string): boolean {
  const s = getKindredData(kindred)?.acBonus ?? '';
  return /unarmoured|light/i.test(s);
}

export function getKindredLanguages(kindred: string): string[] {
  return getKindredData(kindred)?.nativeLanguages ?? [];
}

export function getKindredTraits(kindred: string): KindredTrait[] {
  return getKindredData(kindred)?.traits ?? [];
}

/** True when the kindred innately knows a glamour (trait-driven: Elf, Grimalkin). */
export function hasInnateGlamours(kindred: string): boolean {
  return getKindredTraits(kindred).some(t => t.name === 'Glamours');
}

export function isClassAllowedForKindred(kindred: string, className: string): boolean {
  const data = getKindredData(kindred);
  if (!data) return true;
  const forbidden = data.classRestrictions?.forbidden ?? [];
  return !forbidden.includes(className);
}

export const ALL_KINDREDS = Object.keys(kindredData) as KindredName[];
