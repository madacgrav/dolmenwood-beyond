import type { LevelUpChange } from '@dolmenwood/types';
import { requireAccountId } from '@/lib/auth/session';
import { badRequest } from '@/lib/authz';
import type { LevelUpLogDoc } from '@/lib/cosmos/types';
import { assertCharacterOwner } from '@/lib/authz';
import { mutateOwnedCharacterDoc } from './characters';

/**
 * App-layer port of the `level_up` RPC: owner-only, monotonic level
 * progression, optional XP-threshold gate, and the level/hp update plus
 * the log entry land in one document replace (atomic by construction).
 */

export interface LevelUpInput {
  newLevel: number;
  hpGain: number;
  hpRoll: number;
  changes: LevelUpChange[];
  xpThreshold: number;
}

export async function levelUp(characterId: string, input: LevelUpInput): Promise<void> {
  const me = await requireAccountId();
  const newLevel = Number(input.newLevel);
  const hpGain = Number(input.hpGain);
  if (!Number.isInteger(newLevel) || newLevel < 2 || newLevel > 15) {
    throw badRequest('level must be between 2 and 15');
  }
  if (!Number.isInteger(hpGain) || hpGain < 0) {
    throw badRequest('hp gain must be a non-negative integer');
  }

  await mutateOwnedCharacterDoc(characterId, (doc) => {
    if (doc.level !== newLevel - 1) {
      throw badRequest(`level must advance one step (current ${doc.level})`);
    }
    if (input.xpThreshold > 0 && doc.xp < input.xpThreshold) {
      throw badRequest('not enough XP for this level');
    }
    doc.level = newLevel;
    doc.hpMax += hpGain;
    doc.hpCurrent = doc.hpMax; // level-up restores to full, matching the RPC
    const log: LevelUpLogDoc = {
      id: crypto.randomUUID(),
      fromLevel: newLevel - 1,
      toLevel: newLevel,
      timestamp: new Date().toISOString(),
      changes: input.changes ?? [],
      hpRoll: Number(input.hpRoll) || 0,
      hpRollFinal: hpGain,
    };
    doc.levelUpLogs = [...(doc.levelUpLogs ?? []), log];
    doc.xpLog = [...(doc.xpLog ?? []), {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      delta: 0,
      newTotal: doc.xp,
      source: 'level_up' as const,
      actorId: me,
      toLevel: newLevel,
    }];
  });
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
): Promise<{ characterName: string; entries: LevelUpLogEntry[] }> {
  const me = await requireAccountId();
  const doc = await assertCharacterOwner(me, characterId);
  return {
    characterName: doc.name,
    entries: [...(doc.levelUpLogs ?? [])]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .map((l) => ({
        id: l.id,
        character_id: characterId,
        from_level: l.fromLevel,
        to_level: l.toLevel,
        hp_roll: l.hpRoll,
        hp_roll_final: l.hpRollFinal,
        changes: l.changes,
        timestamp: l.timestamp,
      })),
  };
}
