import type { ACBreakdown, ArmorBulk } from '@dolmenwood/types';
import { calculateAC } from './ac';
import { getAbilityModifier } from './ability-modifiers';
import { getKindredACBonus, isKindredACBonusArmorConditional } from './kindreds';
import { getClassACBonus } from './advancement';

/** Minimal per-item shape the AC calc needs. Callers map their own inventory type to this. */
export interface ACItem {
  location: string; // 'equipped' | 'stowed' | 'tiny'
  armorAcBonus?: number | null;
  isShield?: boolean | null;
  armorBulk?: ArmorBulk | null;
}

export interface CharacterACInput {
  abilityScores: { dex: number };
  kindred: string;
  characterClass: string;
  level: number;
}

/** Sole producer of a character's AC. Shields split from body armour; kindred/class
 *  unarmoured-defence bonuses drop when medium/heavy body armour is worn.
 *  ponytail: one gate (no medium/heavy body armour) covers both Breggle ("unarmoured or
 *  light") and Friar ("unarmoured") — slightly looser than strict-unarmoured for the Friar
 *  in light armour; tighten if a strict-unarmoured class bonus is ever added. Null armorBulk
 *  (unmigrated data) falls open — bonus kept. */
export function deriveCharacterAC(char: CharacterACInput, items: ACItem[]): ACBreakdown {
  const equipped = items.filter((i) => i.location === 'equipped');
  const shieldItems = equipped.filter((i) => i.isShield);
  const bodyArmor = equipped.filter((i) => !i.isShield);

  const shieldBonus = shieldItems.reduce((s, i) => s + (i.armorAcBonus ?? 0), 0);
  const armorBonus = bodyArmor.reduce((s, i) => s + (i.armorAcBonus ?? 0), 0);

  const hasMediumOrHeavy = bodyArmor.some(
    (i) => i.armorBulk === 'medium' || i.armorBulk === 'heavy',
  );
  const lightOrUnarmoured = !hasMediumOrHeavy;

  const rawKindred = getKindredACBonus(char.kindred);
  const kindredBonus =
    isKindredACBonusArmorConditional(char.kindred) && !lightOrUnarmoured ? 0 : rawKindred;

  const rawClass = getClassACBonus(char.characterClass, char.level);
  const classBonus = lightOrUnarmoured ? rawClass : 0;

  const dexModifier = getAbilityModifier(char.abilityScores.dex);
  const total = calculateAC({
    dexScore: char.abilityScores.dex,
    armorBonus,
    kindredACBonus: kindredBonus,
    classACBonus: classBonus,
    shieldBonus,
  });

  return { base: 10, dexModifier, armorBonus, kindredBonus, classBonus, shieldBonus, total };
}
