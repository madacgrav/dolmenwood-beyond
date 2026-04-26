'use client';
import { useState } from 'react';
import type { Character, AbilityScores } from '@dolmenwood/types';
import {
  getAbilityModifier, getPrimeAbilities, getSaveTargets,
  getAttackBonus, calculateAC, calculateSpeed,
} from '@dolmenwood/rules-engine';

type CharacterWithNotes = Character & { notes?: string };

interface Props {
  character: CharacterWithNotes;
  editMode: boolean;
  onUpdate: (updates: Partial<CharacterWithNotes>) => void;
}

const ABILITY_KEYS: { key: keyof AbilityScores; abbr: string; label: string }[] = [
  { key: 'str', abbr: 'STR', label: 'Strength' },
  { key: 'int', abbr: 'INT', label: 'Intellect' },
  { key: 'wis', abbr: 'WIS', label: 'Wisdom' },
  { key: 'dex', abbr: 'DEX', label: 'Dexterity' },
  { key: 'con', abbr: 'CON', label: 'Constitution' },
  { key: 'cha', abbr: 'CHA', label: 'Charisma' },
];

const SAVE_NAMES = [
  { key: 'doom', label: 'Death / Doom' },
  { key: 'ray', label: 'Wands / Rays' },
  { key: 'hold', label: 'Paralysis / Hold' },
  { key: 'blast', label: 'Breath / Blast' },
  { key: 'spell', label: 'Spells / Rods' },
] as const;

function formatMod(mod: number) { return mod >= 0 ? `+${mod}` : `${mod}`; }

function StatPill({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{
      backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: '8px', padding: '0.5rem 0.875rem',
      display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '60px',
    }}>
      <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      <span style={{ fontSize: '1.1rem', fontWeight: '700', color }}>{value}</span>
    </div>
  );
}

export function StatsTab({ character, editMode, onUpdate }: Props) {
  const primes = getPrimeAbilities(character.characterClass);
  const saves = getSaveTargets(character.characterClass, character.level);
  const attackBonus = getAttackBonus(character.characterClass, character.level);
  const ac = calculateAC({ dexScore: character.abilityScores.dex, armorBonus: 0, kindredACBonus: 0, classACBonus: 0, shieldBonus: 0 });
  const speed = calculateSpeed(0);

  const [editScores, setEditScores] = useState<AbilityScores>({ ...character.abilityScores });

  function handleScoreChange(key: keyof AbilityScores, value: string) {
    const num = Math.max(3, Math.min(18, parseInt(value, 10) || 3));
    setEditScores(prev => ({ ...prev, [key]: num }));
  }

  function saveScores() {
    onUpdate({ abilityScores: editScores });
  }

  const scores = editMode ? editScores : character.abilityScores;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Ability Scores */}
      <section>
        <h3 style={{ margin: '0 0 0.75rem', fontFamily: 'var(--font-display), Georgia, serif', fontSize: '0.9rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
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
                {editMode ? (
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

      {/* Derived Stats row */}
      <section>
        <h3 style={{ margin: '0 0 0.75rem', fontFamily: 'var(--font-display), Georgia, serif', fontSize: '0.9rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Combat Stats
        </h3>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <StatPill label="AC" value={ac} color="var(--color-primary)" />
          <StatPill label="Attack" value={formatMod(attackBonus)} color="var(--color-primary)" />
          <StatPill label="Speed" value={`${speed}′`} color="var(--color-text)" />
        </div>
      </section>

      {/* Saving Throws */}
      {saves && (
        <section>
          <h3 style={{ margin: '0 0 0.75rem', fontFamily: 'var(--font-display), Georgia, serif', fontSize: '0.9rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Saving Throws
          </h3>
          <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden' }}>
            {SAVE_NAMES.map(({ key, label }, i) => (
              <div
                key={key}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.625rem 0.875rem',
                  borderBottom: i < SAVE_NAMES.length - 1 ? '1px solid var(--color-border)' : 'none',
                }}
              >
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text)' }}>{label}</span>
                <span style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--color-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {(saves as Record<string, number>)[key]}+
                </span>
              </div>
            ))}
          </div>
          <p style={{ margin: '0.375rem 0 0', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
            Roll d20 equal to or above target number to succeed.
          </p>
        </section>
      )}
    </div>
  );
}
