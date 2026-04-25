import { getAbilityModifier } from './ability-modifiers';

export function getMaxRetainers(chaScore: number): number {
  return Math.max(0, 3 + getAbilityModifier(chaScore));
}

export function getRetainerLoyaltyBase(chaScore: number): number {
  return 7 + getAbilityModifier(chaScore);
}

export function getMagicResistance(wisScore: number, kindredBonus: number = 0): number {
  return getAbilityModifier(wisScore) + kindredBonus;
}
