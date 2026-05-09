import { getPrimeAbilities } from './advancement';
import { getKindredXPBonus } from './kindreds';

export function getXPModifier(primeAbilityScores: number[]): number {
  if (primeAbilityScores.length === 0) return 0;
  const lowest = Math.min(...primeAbilityScores);
  if (lowest <= 5) return -20;
  if (lowest <= 8) return -10;
  if (lowest <= 12) return 0;
  if (lowest <= 15) return 5;
  return 10;
}

export function applyXPModifiers(
  base: number,
  className: string,
  abilityScores: Record<string, number>,
  kindred: string,
): number {
  if (base <= 0) return base;
  const primes = getPrimeAbilities(className);
  const scores = primes.map(p => abilityScores[p.toLowerCase()] ?? 0);
  const abilityMod = getXPModifier(scores);
  const kindredBonus = getKindredXPBonus(kindred);
  return Math.round(base * (1 + (abilityMod + kindredBonus) / 100));
}

export function canLevelUpAfterGain(currentXP: number, gain: number, threshold: number): boolean {
  return threshold > 0 && currentXP + gain >= threshold;
}
