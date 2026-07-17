'use client';
import { useState } from 'react';
import type { AbilityScores, CharacterWithNotes } from '@dolmenwood/types';
import { getAbilityModifier } from '@dolmenwood/rules-engine';
import { formatMod, sectionHead } from './shared';

const ABILITY_KEYS: { key: keyof AbilityScores; abbr: string; label: string }[] = [
  { key: 'str', abbr: 'STR', label: 'Strength' },
  { key: 'int', abbr: 'INT', label: 'Intelligence' },
  { key: 'wis', abbr: 'WIS', label: 'Wisdom' },
  { key: 'dex', abbr: 'DEX', label: 'Dexterity' },
  { key: 'con', abbr: 'CON', label: 'Constitution' },
  { key: 'cha', abbr: 'CHA', label: 'Charisma' },
];

interface Props {
  abilityScores: AbilityScores;
  primes: string[];
  editMode: boolean;
  readOnly?: boolean;
  onUpdate: (updates: Partial<CharacterWithNotes>) => void;
}

export function AbilityScoresSection({ abilityScores, primes, editMode, readOnly, onUpdate }: Props) {
  const [editScores, setEditScores] = useState<AbilityScores>({ ...abilityScores });

  function handleScoreChange(key: keyof AbilityScores, value: string) {
    const num = Math.max(3, Math.min(18, parseInt(value, 10) || 3));
    setEditScores(prev => ({ ...prev, [key]: num }));
  }

  function saveScores() {
    onUpdate({ abilityScores: editScores });
  }

  const scores = (editMode && !readOnly) ? editScores : abilityScores;

  return (
    <section>
      <h3 style={sectionHead}>
        Ability Scores
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
        {ABILITY_KEYS.map(({ key, abbr, label }) => {
          const isPrime = primes.includes(abbr);
          const score = scores[key];
          const mod = getAbilityModifier(score);
          const modColor = mod > 0 ? 'var(--color-primary)' : mod < 0 ? 'var(--color-danger)' : 'var(--color-text-muted)';

          return (
            <div
              key={key}
              style={{
                backgroundColor: 'var(--color-surface)',
                border: `2px solid ${isPrime ? 'var(--color-gold)' : 'var(--color-border)'}`,
                borderRadius: '10px',
                padding: '0.625rem',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem',
                position: 'relative',
              }}
            >
              {isPrime && (
                <span style={{ position: 'absolute', top: 4, right: 6, fontSize: '0.6rem', color: 'var(--color-gold)', fontWeight: '700' }}>★</span>
              )}
              <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontWeight: '700', letterSpacing: '0.06em' }}>{abbr}</span>
              {(editMode && !readOnly) ? (
                <input
                  type="number"
                  min={3} max={18}
                  value={editScores[key]}
                  onChange={e => handleScoreChange(key, e.target.value)}
                  onBlur={saveScores}
                  style={{
                    width: '44px', height: '36px', textAlign: 'center', fontSize: '1.25rem', fontWeight: '700',
                    border: '1px solid var(--color-border)', borderRadius: '6px',
                    backgroundColor: 'var(--color-bg)', color: 'var(--color-text)',
                  }}
                />
              ) : (
                <span style={{ fontSize: '1.75rem', fontWeight: '700', lineHeight: 1, color: 'var(--color-text)' }}>{score}</span>
              )}
              <span style={{
                fontSize: '0.75rem', fontWeight: '700', color: modColor,
                backgroundColor: `color-mix(in srgb, ${modColor} 12%, var(--color-bg))`,
                borderRadius: '4px', padding: '1px 6px',
              }}>
                {formatMod(mod)}
              </span>
              <span style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)' }}>{label}</span>
            </div>
          );
        })}
      </div>
      {primes.length > 0 && (
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.72rem', color: 'var(--color-gold)' }}>
          ★ Prime {primes.length > 1 ? 'abilities' : 'ability'}: {primes.join(', ')}
        </p>
      )}
    </section>
  );
}
