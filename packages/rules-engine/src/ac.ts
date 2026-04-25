import { getAbilityModifier } from './ability-modifiers';

export interface ACInputs {
  dexScore: number;
  armorBonus: number;
  kindredACBonus: number;
  classACBonus: number;
  shieldBonus: number;
}

export function calculateAC(inputs: ACInputs): number {
  return (
    10 +
    getAbilityModifier(inputs.dexScore) +
    inputs.armorBonus +
    inputs.kindredACBonus +
    inputs.classACBonus +
    inputs.shieldBonus
  );
}
