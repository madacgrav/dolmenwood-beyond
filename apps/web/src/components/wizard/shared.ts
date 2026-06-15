import type { CSSProperties } from 'react';
import type { AbilityScores } from '@dolmenwood/types';

/** Shared wizard constants — previously copy-pasted across step files. */

export const ABILITY_KEYS: (keyof AbilityScores)[] = ['str', 'int', 'wis', 'dex', 'con', 'cha'];

export const ABILITY_LABELS: Record<keyof AbilityScores, string> = {
  str: 'Strength', int: 'Intelligence', wis: 'Wisdom',
  dex: 'Dexterity', con: 'Constitution', cha: 'Charisma',
};

/**
 * Dolmenwood optional rule: a set of scores is sub-par when all are 6 or
 * less, or at least two are 3 or less (player may re-roll the full set).
 */
export function isSubpar(scores: AbilityScores): boolean {
  const vals = Object.values(scores);
  return vals.every(v => v <= 6) || vals.filter(v => v <= 3).length >= 2;
}

export const primaryBtn: CSSProperties = {
  width: '100%', padding: '0.875rem',
  backgroundColor: 'var(--color-primary)', color: 'white',
  border: 'none', borderRadius: '8px', fontSize: '1rem',
  fontWeight: '600', cursor: 'pointer', minHeight: '44px',
};

export const secondaryBtn: CSSProperties = {
  width: '100%', padding: '0.875rem',
  backgroundColor: 'var(--color-surface)', color: 'var(--color-text)',
  border: '1px solid var(--color-border)', borderRadius: '8px',
  fontSize: '0.95rem', cursor: 'pointer', minHeight: '44px',
};
