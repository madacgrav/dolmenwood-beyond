import knackData from './data/knacks.json';

export interface KnackAbility {
  level: number;
  name: string;
  description: string;
}

export interface Knack {
  name: string;
  description: string;
  abilities: KnackAbility[];
}

/** All six mossling knacks, in rulebook d6 order. */
export function getKnacks(): Knack[] {
  return knackData.knacks as Knack[];
}

export function getKnack(name: string): Knack | null {
  return getKnacks().find(k => k.name === name) ?? null;
}
