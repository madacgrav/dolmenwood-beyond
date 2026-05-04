'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Character } from '@dolmenwood/types';
import { getXPThresholdForNextLevel, getPrimeAbilities, getXPModifier, getKindredXPBonus } from '@dolmenwood/rules-engine';

type CharacterWithNotes = Character & { notes?: string };

interface Props {
  character: CharacterWithNotes;
  editMode: boolean;
  onToggleEdit: () => void;
  onUpdate: (updates: Partial<CharacterWithNotes>) => void;
  onBack: () => void;
}

export function CharacterSheetHeader({ character, editMode, onToggleEdit, onUpdate, onBack }: Props) {
  const [hpEditOpen, setHpEditOpen] = useState(false);
  const [hpInputVal, setHpInputVal] = useState('');
  const [xpEditOpen, setXpEditOpen] = useState(false);
  const [xpInputVal, setXpInputVal] = useState('');
  const router = useRouter();

  const nextLevelXP = getXPThresholdForNextLevel(character.characterClass, character.level);
  const xpPct = nextLevelXP > 0 ? Math.min(1, character.xp / nextLevelXP) : 1;

  const hpPct = character.hpMax > 0 ? Math.max(0, Math.min(1, character.hpCurrent / character.hpMax)) : 0;
  const hpColor = hpPct > 0.66 ? 'var(--color-primary)' : hpPct > 0.33 ? 'var(--color-gold)' : 'var(--color-danger)';

  const initials = character.name.charAt(0).toUpperCase();

  function adjustHP(delta: number) {
    const newHP = Math.max(0, Math.min(character.hpMax, character.hpCurrent + delta));
    onUpdate({ hpCurrent: newHP });
  }

  function commitHpInput() {
    const val = parseInt(hpInputVal, 10);
    if (!isNaN(val)) onUpdate({ hpCurrent: Math.max(0, Math.min(character.hpMax, val)) });
    setHpInputVal('');
    setHpEditOpen(false);
  }

  function commitXPInput() {
    const val = parseInt(xpInputVal, 10);
    if (!isNaN(val) && val !== 0) {
      const gain = val > 0 && totalXpMod !== 0
        ? Math.round(val * (1 + totalXpMod / 100))
        : val;
      onUpdate({ xp: Math.max(0, character.xp + gain) });
    }
    setXpInputVal('');
    setXpEditOpen(false);
  }

  const primes = getPrimeAbilities(character.characterClass);
  const primeScores = primes.map(p => character.abilityScores[p.toLowerCase() as keyof typeof character.abilityScores]);
  const xpMod = getXPModifier(primeScores);
  const kindredXpBonus = getKindredXPBonus(character.kindred);
  const totalXpMod = xpMod + kindredXpBonus;

  return (
    <div style={{
      backgroundColor: 'var(--color-surface)',
      borderBottom: '1px solid var(--color-border)',
      padding: '0.875rem 1rem 1rem',
    }}>
      {/* Top row: back + edit */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <button
          onClick={onBack}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-text-muted)', fontSize: '1.1rem',
            padding: '0.25rem 0.5rem', borderRadius: '6px',
            minHeight: '44px',
          }}
          aria-label="Back to characters"
        >
          ← Back
        </button>
        <button
          onClick={onToggleEdit}
          style={{
            background: editMode ? 'var(--color-primary)' : 'none',
            border: editMode ? 'none' : '1px solid var(--color-border)',
            borderRadius: '8px', cursor: 'pointer',
            color: editMode ? 'white' : 'var(--color-text-muted)',
            fontSize: '0.85rem', padding: '0.375rem 0.75rem',
            minHeight: '44px', display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
          }}
        >
          {editMode ? '✓ Done' : '✏️ Edit'}
        </button>
      </div>

      {/* Portrait + name row */}
      <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-start' }}>
        {/* Portrait */}
        <div style={{
          width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
          backgroundColor: 'var(--color-primary)',
          backgroundImage: character.portraitUrl ? `url(${character.portraitUrl})` : undefined,
          backgroundSize: 'cover', backgroundPosition: 'center',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white',
          fontFamily: 'var(--font-display), Georgia, serif',
          fontSize: '1.75rem', fontWeight: '700',
        }}>
          {!character.portraitUrl && initials}
        </div>

        {/* Name + bars */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{
            margin: 0, fontSize: '1.2rem', fontWeight: '700',
            fontFamily: 'var(--font-display), Georgia, serif',
            color: 'var(--color-text)',
          }}>
            {character.name}
          </h2>
          <p style={{ margin: '0.125rem 0 0.625rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            {character.kindred} {character.characterClass} · Level {character.level}
          </p>

          {/* HP bar */}
          <div
            style={{ cursor: 'pointer', marginBottom: '0.5rem' }}
            onClick={() => { setHpEditOpen(o => !o); setXpEditOpen(false); }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '3px' }}>
              <span style={{ color: hpColor, fontWeight: '600' }}>
                ❤️ {character.hpCurrent} / {character.hpMax} HP
              </span>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem' }}>tap to edit</span>
            </div>
            <div style={{ height: '8px', borderRadius: '4px', backgroundColor: 'var(--color-border)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${hpPct * 100}%`, backgroundColor: hpColor, borderRadius: '4px', transition: 'width 0.3s, background-color 0.3s' }} />
            </div>
          </div>

          {/* HP edit controls */}
          {hpEditOpen && (
            <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              {([-5, -1, 1, 5] as const).map(d => (
                <button
                  key={d}
                  onClick={() => adjustHP(d)}
                  style={{
                    padding: '0.25rem 0.625rem', borderRadius: '6px', border: '1px solid var(--color-border)',
                    backgroundColor: d < 0 ? 'color-mix(in srgb, var(--color-danger) 15%, var(--color-bg))' : 'color-mix(in srgb, var(--color-primary) 15%, var(--color-bg))',
                    color: d < 0 ? 'var(--color-danger)' : 'var(--color-primary)',
                    cursor: 'pointer', fontSize: '0.85rem', fontWeight: '700', minHeight: '36px',
                  }}
                >
                  {d > 0 ? `+${d}` : d}
                </button>
              ))}
              <input
                type="number"
                placeholder="set HP"
                value={hpInputVal}
                onChange={e => setHpInputVal(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && commitHpInput()}
                style={{
                  width: '70px', padding: '0.25rem 0.5rem', borderRadius: '6px',
                  border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)',
                  color: 'var(--color-text)', fontSize: '0.85rem', minHeight: '36px',
                }}
              />
              <button
                onClick={commitHpInput}
                style={{ padding: '0.25rem 0.625rem', borderRadius: '6px', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', cursor: 'pointer', fontSize: '0.85rem', minHeight: '36px' }}
              >
                ✓
              </button>
            </div>
          )}

          {/* XP bar */}
          <div
            style={{ cursor: 'pointer' }}
            onClick={() => { setXpEditOpen(o => !o); setHpEditOpen(false); }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: '3px' }}>
              <span style={{ color: 'var(--color-gold)', fontWeight: '600' }}>
                ✨ {character.xp.toLocaleString()} XP {nextLevelXP > 0 ? `/ ${nextLevelXP.toLocaleString()}` : '(max level)'}
              </span>
              {totalXpMod !== 0 && (
                <span style={{ color: totalXpMod > 0 ? 'var(--color-primary)' : 'var(--color-danger)', fontSize: '0.65rem' }}>
                  {totalXpMod > 0 ? `+${totalXpMod}%` : `${totalXpMod}%`} XP mod
                </span>
              )}
            </div>
            <div style={{ height: '5px', borderRadius: '3px', backgroundColor: 'var(--color-border)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${xpPct * 100}%`, backgroundColor: 'var(--color-gold)', borderRadius: '3px', transition: 'width 0.3s' }} />
            </div>
          </div>

          {/* XP edit */}
          {xpEditOpen && (() => {
            const inputVal = parseInt(xpInputVal, 10);
            const isPositive = !isNaN(inputVal) && inputVal > 0;
            const isNegative = !isNaN(inputVal) && inputVal < 0;
            const previewGain = isPositive && totalXpMod !== 0
              ? Math.round(inputVal * (1 + totalXpMod / 100))
              : inputVal || 0;
            const showPreview = !isNaN(inputVal) && inputVal !== 0 && isPositive && totalXpMod !== 0;
            return (
              <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    {isNegative ? 'Correct XP:' : 'Add XP:'}
                  </span>
                  <input
                    type="number"
                    placeholder="e.g. 250"
                    value={xpInputVal}
                    onChange={e => setXpInputVal(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && commitXPInput()}
                    style={{
                      width: '90px', padding: '0.25rem 0.5rem', borderRadius: '6px',
                      border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)',
                      color: 'var(--color-text)', fontSize: '0.85rem', minHeight: '36px',
                    }}
                  />
                  <button
                    onClick={commitXPInput}
                    style={{ padding: '0.25rem 0.75rem', borderRadius: '6px', backgroundColor: 'var(--color-gold)', color: 'white', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '700', minHeight: '36px' }}
                  >
                    {isNegative ? '−XP' : '+XP'}
                  </button>
                </div>
                {showPreview && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', paddingLeft: '0.25rem' }}>
                    {inputVal} base → <span style={{ color: 'var(--color-gold)' }}>+{previewGain} actual</span>
                    {' '}({totalXpMod > 0 ? '+' : ''}{totalXpMod}% mod)
                  </div>
                )}
              </div>
            );
          })()}

          {/* Level Up button */}
          {nextLevelXP > 0 && character.xp >= nextLevelXP && (
            <button
              onClick={() => router.push(`/characters/${character.id}/level-up`)}
              style={{
                marginTop: '0.5rem',
                width: '100%',
                padding: '0.4rem 0.75rem',
                borderRadius: '8px',
                border: '2px solid var(--color-gold)',
                backgroundColor: 'color-mix(in srgb, var(--color-gold) 15%, var(--color-bg))',
                color: 'var(--color-gold)',
                fontWeight: '700',
                fontSize: '0.85rem',
                cursor: 'pointer',
                minHeight: '40px',
                animation: 'levelUpPulse 1.5s ease-in-out infinite',
              }}
            >
              ⬆ Level Up!
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
