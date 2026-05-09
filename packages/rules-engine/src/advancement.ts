import classData from './data/class-advancement.json';
import { isSpellcaster, getSpellSlots } from './spells';

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

// ── Level-up change summary ───────────────────────────────────────────────────

export interface LevelUpChange {
  name: string;
  description: string;
}

export function getLevelUpChanges(
  className: string,
  fromLevel: number,
  toLevel: number,
): LevelUpChange[] {
  const changes: LevelUpChange[] = [];

  const oldAttack = getAttackBonus(className, fromLevel);
  const newAttack = getAttackBonus(className, toLevel);
  if (newAttack > oldAttack) {
    changes.push({
      name: 'Attack Bonus Improves',
      description: `Your attack bonus rises to +${newAttack} (was +${oldAttack}).`,
    });
  }

  const oldSaves = getSaveTargets(className, fromLevel);
  const newSaves = getSaveTargets(className, toLevel);
  if (oldSaves && newSaves) {
    const improved =
      newSaves.doom < oldSaves.doom ||
      newSaves.ray < oldSaves.ray ||
      newSaves.hold < oldSaves.hold ||
      newSaves.blast < oldSaves.blast ||
      newSaves.spell < oldSaves.spell;
    if (improved) {
      changes.push({
        name: 'Saving Throws Improve',
        description: `Doom ${newSaves.doom}, Ray ${newSaves.ray}, Hold ${newSaves.hold}, Blast ${newSaves.blast}, Spell ${newSaves.spell}.`,
      });
    }
  }

  if (isSpellcaster(className)) {
    const oldSlots = getSpellSlots(className, fromLevel);
    const newSlots = getSpellSlots(className, toLevel);
    if (newSlots) {
      if ('glamours' in newSlots) {
        const oldG = oldSlots && 'glamours' in oldSlots ? (oldSlots.glamours as number) : 0;
        const newG = newSlots.glamours as number;
        if (newG > oldG) {
          changes.push({
            name: 'Glamours Known',
            description: `You now know ${newG} glamours (was ${oldG}).`,
          });
        }
      } else {
        const gained: string[] = [];
        for (let rank = 1; rank <= 6; rank++) {
          const oldVal = oldSlots ? ((oldSlots as Record<string | number, number>)[rank] ?? 0) : 0;
          const newVal = (newSlots as Record<string | number, number>)[rank] ?? 0;
          if (newVal > oldVal) gained.push(`Rank ${rank}: ${newVal} (was ${oldVal})`);
        }
        if (gained.length > 0) {
          changes.push({
            name: 'Spell Slots Expand',
            description: gained.join('; ') + '.',
          });
        }
      }
    }
  }

  const oldData = getClassLevel(className, fromLevel) as Record<string, unknown> | null;
  const newData = getClassLevel(className, toLevel) as Record<string, unknown> | null;
  if (oldData && newData) {
    const oldTalents = oldData.combatTalents as number | undefined;
    const newTalents = newData.combatTalents as number | undefined;
    if (newTalents !== undefined && oldTalents !== undefined && newTalents > oldTalents) {
      changes.push({
        name: 'Combat Talent',
        description: `You earn a new Combat Talent (total: ${newTalents}).`,
      });
    }

    const oldAC = oldData.acBonus as number | undefined;
    const newAC = newData.acBonus as number | undefined;
    if (newAC !== undefined && oldAC !== undefined && newAC > oldAC) {
      changes.push({
        name: 'Unarmed AC Bonus Improves',
        description: `Your unarmoured AC bonus increases to +${newAC} (was +${oldAC}).`,
      });
    }
  }

  return changes;
}
