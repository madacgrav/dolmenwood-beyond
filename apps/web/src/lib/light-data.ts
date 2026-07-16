// Light/heat source burn durations. Dolmenwood: 1 turn = 10 minutes.
// ponytail: durations approximate the rulebook; adjust entries here if a
// referee checks the Player's Book and disagrees — data-only, no code change.
export interface LightSource {
  name: string;
  turns: number;
  icon: string;
}

export const LIGHT_SOURCES: LightSource[] = [
  { name: 'Torch',     turns: 6,  icon: '🔥' }, // ~1 hour
  { name: 'Oil Flask', turns: 24, icon: '🪔' }, // lantern fuel, ~4 hours
  { name: 'Candle',    turns: 12, icon: '🕯️' }, // ~2 hours
  { name: 'Firewood',  turns: 48, icon: '🪵' }, // campfire, ~8 hours
];

/** Match an inventory item name to a known light source (case-insensitive). */
export function lightSourceFor(itemName: string): LightSource | undefined {
  return LIGHT_SOURCES.find(s => s.name.toLowerCase() === itemName.toLowerCase());
}
