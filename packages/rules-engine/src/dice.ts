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
