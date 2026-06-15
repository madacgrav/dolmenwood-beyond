'use client';

import type { Character } from '@dolmenwood/types';
import {
  getAttackBonus,
  getSaveTargets,
  getSpellSlots,
  getHitDie,
  isSpellcaster,
  getXPThresholdForNextLevel,
} from '@dolmenwood/rules-engine';

export function CheckStep({
  character,
  onAdvance,
}: {
  character: Character;
  onAdvance: () => void;
}) {
  const newLevel = character.level + 1;
  const threshold = getXPThresholdForNextLevel(character.characterClass, character.level);
  const canAdvance = threshold > 0 && character.xp >= threshold;
  const oldAttack = getAttackBonus(character.characterClass, character.level);
  const newAttack = getAttackBonus(character.characterClass, newLevel);
  const oldSaves = getSaveTargets(character.characterClass, character.level);
  const newSaves = getSaveTargets(character.characterClass, newLevel);
  const hitDieStr = getHitDie(character.characterClass);
  const oldSlots = isSpellcaster(character.characterClass)
    ? getSpellSlots(character.characterClass, character.level)
    : null;
  const newSlots = isSpellcaster(character.characterClass)
    ? getSpellSlots(character.characterClass, newLevel)
    : null;

  const savesChanged =
    oldSaves &&
    newSaves &&
    (newSaves.doom !== oldSaves.doom ||
      newSaves.ray !== oldSaves.ray ||
      newSaves.hold !== oldSaves.hold ||
      newSaves.blast !== oldSaves.blast ||
      newSaves.spell !== oldSaves.spell);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Level badge */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: '1.25rem', padding: '1.5rem',
        backgroundColor: 'var(--color-surface)',
        borderRadius: '12px', border: '1px solid var(--color-border)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Current</div>
          <div style={{
            width: '4rem', height: '4rem', borderRadius: '50%',
            backgroundColor: 'var(--color-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.75rem', fontWeight: '700',
            fontFamily: 'var(--font-display), Georgia, serif',
            color: 'var(--color-text)',
          }}>{character.level}</div>
        </div>
        <div style={{ fontSize: '2rem', color: 'var(--color-gold)' }}>⬆</div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-gold)', marginBottom: '0.25rem', fontWeight: '600' }}>New</div>
          <div style={{
            width: '4rem', height: '4rem', borderRadius: '50%',
            backgroundColor: 'var(--color-gold)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.75rem', fontWeight: '700',
            fontFamily: 'var(--font-display), Georgia, serif',
            color: 'white',
            boxShadow: '0 0 16px color-mix(in srgb, var(--color-gold) 50%, transparent)',
          }}>{newLevel}</div>
        </div>
      </div>

      <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.9rem', margin: 0 }}>
        You have <strong style={{ color: 'var(--color-gold)' }}>{character.xp.toLocaleString()} XP</strong>
        {canAdvance
          ? ` — enough to reach level ${newLevel}!`
          : ` — need ${threshold.toLocaleString()} XP to reach level ${newLevel}.`}
      </p>

      {/* Stats comparison */}
      <div style={{
        backgroundColor: 'var(--color-surface)',
        borderRadius: '10px', border: '1px solid var(--color-border)',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '0.5rem 0.875rem',
          borderBottom: '1px solid var(--color-border)',
          display: 'grid', gridTemplateColumns: '1fr auto auto',
          gap: '0.5rem', alignItems: 'center',
          fontSize: '0.7rem', fontWeight: '700',
          color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          <span>Stat</span>
          <span style={{ textAlign: 'right', minWidth: '3rem' }}>Now</span>
          <span style={{ textAlign: 'right', color: 'var(--color-gold)', minWidth: '3rem' }}>Level {newLevel}</span>
        </div>

        {[
          {
            label: 'Attack Bonus',
            old: `+${oldAttack}`,
            next: `+${newAttack}`,
            changed: newAttack !== oldAttack,
          },
          {
            label: 'Hit Dice',
            old: `${character.level}${hitDieStr}`,
            next: `${newLevel}${hitDieStr}`,
            changed: true,
          },
          ...(savesChanged && oldSaves && newSaves
            ? [
                { label: 'Save: Doom', old: String(oldSaves.doom), next: String(newSaves.doom), changed: newSaves.doom !== oldSaves.doom },
                { label: 'Save: Ray', old: String(oldSaves.ray), next: String(newSaves.ray), changed: newSaves.ray !== oldSaves.ray },
                { label: 'Save: Hold', old: String(oldSaves.hold), next: String(newSaves.hold), changed: newSaves.hold !== oldSaves.hold },
                { label: 'Save: Blast', old: String(oldSaves.blast), next: String(newSaves.blast), changed: newSaves.blast !== oldSaves.blast },
                { label: 'Save: Spell', old: String(oldSaves.spell), next: String(newSaves.spell), changed: newSaves.spell !== oldSaves.spell },
              ]
            : []),
          ...(oldSlots && newSlots && !('glamours' in newSlots)
            ? ([1, 2, 3, 4, 5, 6] as const)
                .filter(rank => {
                  const o = (oldSlots as Record<string | number, number>)[rank] ?? 0;
                  const n = (newSlots as Record<string | number, number>)[rank] ?? 0;
                  return o > 0 || n > 0;
                })
                .map(rank => ({
                  label: `Rank ${rank} Spells`,
                  old: String((oldSlots as Record<string | number, number>)[rank] ?? 0),
                  next: String((newSlots as Record<string | number, number>)[rank] ?? 0),
                  changed: ((oldSlots as Record<string | number, number>)[rank] ?? 0) !== ((newSlots as Record<string | number, number>)[rank] ?? 0),
                }))
            : []),
        ].map((row, i) => (
          <div
            key={i}
            style={{
              padding: '0.625rem 0.875rem',
              display: 'grid', gridTemplateColumns: '1fr auto auto',
              gap: '0.5rem', alignItems: 'center',
              borderBottom: '1px solid var(--color-border)',
              fontSize: '0.875rem',
            }}
          >
            <span style={{ color: 'var(--color-text)' }}>{row.label}</span>
            <span style={{ textAlign: 'right', minWidth: '3rem', color: 'var(--color-text-muted)' }}>{row.old}</span>
            <span style={{
              textAlign: 'right', minWidth: '3rem',
              color: row.changed ? 'var(--color-gold)' : 'var(--color-text-muted)',
              fontWeight: row.changed ? '700' : '400',
            }}>
              {row.next}
              {row.changed && ' ✨'}
            </span>
          </div>
        ))}
      </div>

      <button
        onClick={onAdvance}
        disabled={!canAdvance}
        style={{
          width: '100%', padding: '0.875rem',
          backgroundColor: canAdvance ? 'var(--color-gold)' : 'var(--color-border)',
          color: canAdvance ? 'white' : 'var(--color-text-muted)',
          border: 'none', borderRadius: '10px',
          fontFamily: 'var(--font-display), Georgia, serif',
          fontSize: '1rem', fontWeight: '700',
          cursor: canAdvance ? 'pointer' : 'not-allowed',
          letterSpacing: '0.05em',
          minHeight: '44px',
        }}
      >
        Advance! ⬆
      </button>
    </div>
  );
}
