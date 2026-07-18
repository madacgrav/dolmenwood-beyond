import { LIGHT_SOURCES } from '@/lib/light-data';
import { parseCountSuffix } from './parse-count';

// Non-light consumables that also have a canonical singular label. Light sources
// are resolved from LIGHT_SOURCES (single source of truth for their aliases).
const EXTRA_CONSUMABLES: { canonical: string; aliases: string[] }[] = [
  { canonical: 'Arrow',            aliases: ['arrow', 'arrows'] },
  { canonical: 'Crossbow Quarrel', aliases: ['crossbow quarrel', 'crossbow quarrels', 'quarrel', 'quarrels'] },
  { canonical: 'Sling Stone',      aliases: ['sling stone', 'sling stones'] },
  { canonical: 'Ration',           aliases: ['ration', 'rations', 'preserved ration', 'preserved rations'] },
];

/** Return the clean singular label for a known consumable, else the count-stripped name. */
export function canonicalName(raw: string): string {
  const cleaned = parseCountSuffix(raw).name.trim();
  const key = cleaned.toLowerCase();
  const light = LIGHT_SOURCES.find((s) => s.name.toLowerCase() === key || s.aliases.includes(key));
  if (light) return light.name;
  const extra = EXTRA_CONSUMABLES.find((c) => c.aliases.includes(key));
  return extra ? extra.canonical : cleaned;
}
