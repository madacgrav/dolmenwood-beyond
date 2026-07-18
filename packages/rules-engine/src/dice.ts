export type DieType = 4 | 6 | 8 | 10 | 12 | 20 | 100;

export function rollDie(sides: DieType): number {
  return Math.floor(Math.random() * sides) + 1;
}

export function rollMultiple(count: number, sides: DieType): number[] {
  return Array.from({ length: count }, () => rollDie(sides));
}

export function roll3d6(): number {
  return rollMultiple(3, 6).reduce((a, b) => a + b, 0);
}

export function rollAbilityScores(): number[] {
  return Array.from({ length: 6 }, () => roll3d6());
}

export function parseDiceNotation(notation: string): { count: number; sides: DieType } {
  const match = notation.match(/(\d+)d(\d+)/i);
  if (!match) throw new Error(`Invalid dice notation: ${notation}`);
  return { count: parseInt(match[1]!, 10), sides: parseInt(match[2]!, 10) as DieType };
}

export function rollFromNotation(notation: string): number {
  const { count, sides } = parseDiceNotation(notation);
  return rollMultiple(count, sides).reduce((a, b) => a + b, 0);
}

/** Uniform random pick from a non-empty list. Returns undefined for an empty list. */
export function pickRandom<T>(list: readonly T[]): T | undefined {
  if (list.length === 0) return undefined;
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Parse and roll a dice notation string like "2d6+1".
 */
export function rollDamage(notation: string): number {
  const match = notation.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!match) return 0;
  const count = parseInt(match[1] ?? '1', 10);
  const sides = parseInt(match[2] ?? '6', 10);
  const modifier = parseInt(match[3] ?? '0', 10);
  let total = modifier;
  for (let i = 0; i < count; i++) {
    total += Math.floor(Math.random() * sides) + 1;
  }
  return total;
}
