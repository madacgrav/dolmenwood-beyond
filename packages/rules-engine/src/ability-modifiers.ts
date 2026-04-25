const MODIFIER_TABLE: Record<number, number> = {
  3: -3,
  4: -2, 5: -2,
  6: -1, 7: -1, 8: -1,
  9: 0, 10: 0, 11: 0, 12: 0,
  13: 1, 14: 1, 15: 1,
  16: 2, 17: 2,
  18: 3,
};

export function getAbilityModifier(score: number): number {
  if (score <= 3) return -3;
  if (score >= 18) return 3;
  return MODIFIER_TABLE[score] ?? 0;
}

export function getAllModifiers(scores: {
  str: number; int: number; wis: number;
  dex: number; con: number; cha: number;
}): Record<string, number> {
  return {
    str: getAbilityModifier(scores.str),
    int: getAbilityModifier(scores.int),
    wis: getAbilityModifier(scores.wis),
    dex: getAbilityModifier(scores.dex),
    con: getAbilityModifier(scores.con),
    cha: getAbilityModifier(scores.cha),
  };
}
