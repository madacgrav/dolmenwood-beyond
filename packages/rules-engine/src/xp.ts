export function getXPModifier(primeAbilityScores: number[]): number {
  const lowest = Math.min(...primeAbilityScores);
  if (lowest <= 5) return -20;
  if (lowest <= 8) return -10;
  if (lowest <= 12) return 0;
  if (lowest <= 15) return 5;
  return 10;
}
