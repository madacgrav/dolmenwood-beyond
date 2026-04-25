import classData from './data/class-advancement.json';

export type ClassName = keyof typeof classData;

export interface ClassLevel {
  level: number;
  xp: number;
  hitPoints: string;
  attackBonus: number;
  saves: {
    doom: number;
    ray: number;
    hold: number;
    blast: number;
    spell: number;
  };
  [key: string]: unknown;
}

export interface ClassAdvancementTable {
  primeAbilities: string[];
  hitDie: string;
  levels: ClassLevel[];
  [key: string]: unknown;
}

export function getClassData(className: string): ClassAdvancementTable | null {
  return (classData as Record<string, ClassAdvancementTable>)[className] ?? null;
}

export function getClassLevel(className: string, level: number): ClassLevel | null {
  const cls = getClassData(className);
  if (!cls) return null;
  return cls.levels.find((l) => l.level === level) ?? null;
}

export function getAttackBonus(className: string, level: number): number {
  return getClassLevel(className, level)?.attackBonus ?? 0;
}

export function getSaveTargets(className: string, level: number) {
  return getClassLevel(className, level)?.saves ?? null;
}

export function getXPThreshold(className: string, level: number): number {
  return getClassLevel(className, level)?.xp ?? 0;
}

export function getXPThresholdForNextLevel(className: string, currentLevel: number): number {
  return getXPThreshold(className, currentLevel + 1);
}

export function getPrimeAbilities(className: string): string[] {
  return getClassData(className)?.primeAbilities ?? [];
}

export function getHitDie(className: string): string {
  return getClassData(className)?.hitDie ?? 'd6';
}

export const ALL_CLASSES = Object.keys(classData) as ClassName[];
