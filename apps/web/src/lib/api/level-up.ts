import type { LevelUpFeature } from '@dolmenwood/rules-engine';
import type { LevelUpChange } from '@dolmenwood/types';

export interface LevelUpParams {
  characterId: string;
  newLevel: number;
  hpGain: number;
  hpRoll: number;
  features: LevelUpFeature[];
  xpThreshold: number;
}

/** Level the character up. Returns an error message, or null on success. */
export async function levelUpCharacter({
  characterId,
  newLevel,
  hpGain,
  hpRoll,
  features,
  xpThreshold,
}: LevelUpParams): Promise<string | null> {
  const res = await fetch(`/api/characters/${characterId}/level-up`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      newLevel,
      hpGain,
      hpRoll,
      changes: features.map((f) => ({ field: f.name, oldValue: '', newValue: f.description })),
      xpThreshold,
    }),
  });
  if (res.ok) return null;
  const body = await res.json().catch(() => null);
  return body?.error ?? `request failed (${res.status})`;
}

export interface LevelUpLogEntry {
  id: string;
  character_id: string;
  from_level: number;
  to_level: number;
  hp_roll: number;
  hp_roll_final: number;
  changes: LevelUpChange[];
  timestamp: string;
}

export async function fetchLevelUpLog(
  characterId: string,
): Promise<{ characterName: string; entries: LevelUpLogEntry[] } | null> {
  const res = await fetch(`/api/characters/${characterId}/level-up`);
  if (!res.ok) return null;
  return res.json();
}
