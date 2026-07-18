import { parseCountSuffix } from '@/lib/inventory/parse-count';

// Light/heat source burn durations. Dolmenwood: 1 turn = 10 minutes.
// ponytail: durations approximate the rulebook; adjust entries here if a
// referee checks the Player's Book and disagrees — data-only, no code change.
export interface LightSource {
  name: string;
  turns: number;
  icon: string;
  /** Lowercased match forms (count suffix already stripped by lightSourceFor). */
  aliases: string[];
}

export const LIGHT_SOURCES: LightSource[] = [
  { name: 'Torch',     turns: 6,  icon: '🔥', aliases: ['torch', 'torches'] },                                    // ~1 hour
  { name: 'Oil Flask', turns: 24, icon: '🪔', aliases: ['oil flask', 'oil flasks', 'flask of oil', 'lamp oil'] }, // lantern fuel, ~4 hours
  { name: 'Candle',    turns: 12, icon: '🕯️', aliases: ['candle', 'candles'] },                                   // ~2 hours
  { name: 'Firewood',  turns: 48, icon: '🪵', aliases: ['firewood', 'wood', 'logs'] },                            // campfire, ~8 hours
];
// No Lantern entry — a lantern is equipment; the Oil Flask is the consumable that is lit.

/** Match an inventory item name to a known light source. Tolerates casing,
 *  plural aliases, and trailing count suffixes ("Torches (3)"). */
export function lightSourceFor(itemName: string): LightSource | undefined {
  const cleaned = parseCountSuffix(itemName).name.trim().toLowerCase();
  return LIGHT_SOURCES.find(
    (s) => s.name.toLowerCase() === cleaned || s.aliases.includes(cleaned),
  );
}
