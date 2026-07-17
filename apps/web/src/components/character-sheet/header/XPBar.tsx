'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CharacterWithNotes } from '@dolmenwood/types';
import { getXPThresholdForNextLevel, getPrimeAbilities, getXPModifier, getKindredXPBonus, applyXPModifiers } from '@dolmenwood/rules-engine';

interface Props {
  character: CharacterWithNotes;
  readOnly: boolean;
  xpEditOpen: boolean;
  onToggle: () => void;
  onAdjustXP?: (newTotal: number) => void | Promise<void>;
  /** dm-correction: inline editor stays enabled on a read-only sheet and
   *  submits a raw signed delta (no XP modifier) via onCorrectXP. */
  variant?: 'owner' | 'dm-correction';
  onCorrectXP?: (delta: number) => void | Promise<void>;
}

export function XPBar({ character, readOnly, xpEditOpen, onToggle, onAdjustXP, variant = 'owner', onCorrectXP }: Props) {
  const [xpInputVal, setXpInputVal] = useState('');
  const [xpMode, setXpMode] = useState<'add' | 'set'>('add');
  const router = useRouter();
  const isDM = variant === 'dm-correction';
  const editable = !readOnly || isDM;
  const isSet = !isDM && xpMode === 'set';

  const nextLevelXP = getXPThresholdForNextLevel(character.characterClass, character.level);
  const xpPct = nextLevelXP > 0 ? Math.min(1, character.xp / nextLevelXP) : 1;

  const primes = getPrimeAbilities(character.characterClass);
  const primeScores = primes.map(p => character.abilityScores[p.toLowerCase() as keyof typeof character.abilityScores] ?? 0);
  const xpMod = getXPModifier(primeScores);
  const kindredXpBonus = getKindredXPBonus(character.kindred);
  const totalXpMod = xpMod + kindredXpBonus;

  function commitXPInput() {
    const val = parseInt(xpInputVal, 10);
    if (isDM) {
      if (!isNaN(val) && val !== 0) onCorrectXP?.(val); // raw signed delta, no modifier
    } else if (isSet) {
      if (!isNaN(val) && val >= 0) onAdjustXP?.(val); // typed value is the new total, no modifier
    } else if (!isNaN(val) && val !== 0) {
      const gain = val > 0
        ? applyXPModifiers(val, character.characterClass, character.abilityScores as unknown as Record<string, number>, character.kindred)
        : val;
      onAdjustXP?.(Math.max(0, character.xp + gain));
    }
    setXpInputVal('');
    onToggle();
  }

  return (
    <>
      {/* XP bar */}
      <div
        style={{ cursor: editable ? 'pointer' : 'default' }}
        onClick={() => { if (editable) onToggle(); }}
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
      {editable && xpEditOpen && (() => {
        const inputVal = parseInt(xpInputVal, 10);
        const isPositive = !isNaN(inputVal) && inputVal > 0;
        const isNegative = !isNaN(inputVal) && inputVal < 0;
        const previewGain = isPositive && totalXpMod !== 0
          ? Math.round(inputVal * (1 + totalXpMod / 100))
          : inputVal || 0;
        const showPreview = !isNaN(inputVal) && inputVal !== 0 && isPositive && totalXpMod !== 0 && !isDM && !isSet;
        return (
          <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {!isDM && (
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                {(['add', 'set'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setXpMode(m)}
                    style={{
                      padding: '0.125rem 0.625rem', borderRadius: '6px', fontSize: '0.7rem',
                      border: '1px solid var(--color-border)', cursor: 'pointer', minHeight: '28px',
                      backgroundColor: xpMode === m ? 'var(--color-gold)' : 'var(--color-bg)',
                      color: xpMode === m ? 'white' : 'var(--color-text-muted)',
                      fontWeight: xpMode === m ? '700' : '400',
                    }}
                  >
                    {m === 'add' ? 'Add' : 'Set'}
                  </button>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                {isDM ? 'Correct XP:' : isSet ? 'Set XP total:' : isNegative ? 'Correct XP:' : 'Add XP:'}
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
                  color: 'var(--color-text)', fontSize: '0.85rem', minHeight: '44px',
                }}
              />
              <button
                onClick={commitXPInput}
                style={{ padding: '0.25rem 0.75rem', borderRadius: '6px', backgroundColor: 'var(--color-gold)', color: 'white', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '700', minHeight: '44px' }}
              >
                {isDM ? '±XP' : isSet ? 'Set' : isNegative ? '−XP' : '+XP'}
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
      {!readOnly && nextLevelXP > 0 && character.xp >= nextLevelXP && (
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
            minHeight: '44px',
            animation: 'levelUpPulse 1.5s ease-in-out infinite',
          }}
        >
          ⬆ Level Up!
        </button>
      )}
    </>
  );
}
