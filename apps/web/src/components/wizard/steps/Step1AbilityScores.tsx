'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { roll3d6, getAbilityModifier } from '@dolmenwood/rules-engine';
import type { AbilityScores } from '@dolmenwood/types';
import { useWizardStore } from '@/stores/wizard-store';
import { WizardProgress } from '@/components/wizard/WizardProgress';
import { AnimatedDie } from '@/components/wizard/AnimatedDie';
import { ABILITY_KEYS, ABILITY_LABELS, isSubpar, primaryBtn, secondaryBtn } from '@/components/wizard/shared';

function rollScores(): AbilityScores {
  const [str, int, wis, dex, con, cha] = Array.from({ length: 6 }, () => roll3d6());
  return { str: str!, int: int!, wis: wis!, dex: dex!, con: con!, cha: cha! };
}

export function Step1AbilityScores() {
  const router = useRouter();
  const { setAbilityScores } = useWizardStore();

  const [setA, setSetA] = useState<AbilityScores>(rollScores);
  const [setB, setSetB] = useState<AbilityScores | null>(null);
  const [rolling, setRolling] = useState(false);
  const [comparing, setComparing] = useState(false);

  const active = comparing && setB ? setB : setA;
  const subpar = isSubpar(active);

  async function animatedRoll(newScores: AbilityScores, target: 'A' | 'B') {
    setRolling(true);
    await new Promise(r => setTimeout(r, 700));
    if (target === 'A') setSetA(newScores);
    else setSetB(newScores);
    setRolling(false);
  }

  function handleRerollAll() {
    const newScores = rollScores();
    if (!comparing) {
      setComparing(true);
      setSetB(newScores);
    } else {
      animatedRoll(newScores, 'B');
    }
  }

  function handleRerollOne(key: keyof AbilityScores) {
    const newVal = roll3d6();
    if (comparing && setB) {
      setSetB(prev => prev ? { ...prev, [key]: newVal } : prev);
    } else {
      setSetA(prev => ({ ...prev, [key]: newVal }));
    }
  }

  function handleChooseSet(chosen: AbilityScores) {
    setAbilityScores(chosen);
    router.push('/characters/new/auto/2');
  }

  function handleConfirm() {
    setAbilityScores(active);
    router.push('/characters/new/auto/2');
  }

  return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: '100dvh' }}>
      <WizardProgress step={1} totalSteps={13} title="Roll Ability Scores" />

      <div style={{ padding: '1rem', maxWidth: '500px', margin: '0 auto' }}>

        {/* Sub-par warning */}
        {subpar && (
          <div style={{
            padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem',
            backgroundColor: 'color-mix(in srgb, var(--color-gold) 15%, transparent)',
            border: '1px solid var(--color-gold)', color: 'var(--color-gold)',
            fontSize: '0.875rem',
          }}>
            ⚠️ These are rough rolls. Re-roll the full set?
          </div>
        )}

        {/* Set comparison tabs */}
        {comparing && setB && (
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            {(['A', 'B'] as const).map(label => {
              const scores = label === 'A' ? setA : setB!;
              const total = Object.values(scores).reduce((a, b) => a + b, 0);
              return (
                <button
                  key={label}
                  onClick={() => setComparing(label === 'B')}
                  style={{
                    flex: 1, padding: '0.5rem',
                    backgroundColor: (label === 'B') === comparing ? 'var(--color-primary)' : 'var(--color-surface)',
                    color: (label === 'B') === comparing ? 'white' : 'var(--color-text)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px', cursor: 'pointer', fontSize: '0.875rem',
                    fontWeight: '600', minHeight: '44px',
                  }}
                >
                  Set {label} (total: {total})
                </button>
              );
            })}
          </div>
        )}

        {/* Score grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {ABILITY_KEYS.map((key) => {
            const score = active[key];
            const mod = getAbilityModifier(score);
            const isOne = score === 1;
            return (
              <div
                key={key}
                style={{
                  backgroundColor: 'var(--color-surface)',
                  border: `1px solid ${isOne ? 'var(--color-gold)' : 'var(--color-border)'}`,
                  borderRadius: '10px', padding: '0.875rem',
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                }}
              >
                <AnimatedDie value={score} rolling={rolling} size="md" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {ABILITY_LABELS[key]}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.375rem' }}>
                    <span style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums' }}>
                      {score}
                    </span>
                    <span style={{ fontSize: '0.9rem', color: mod >= 0 ? 'var(--color-primary)' : 'var(--color-danger)' }}>
                      {mod >= 0 ? '+' : ''}{mod}
                    </span>
                  </div>
                  {isOne && (
                    <button
                      onClick={() => handleRerollOne(key)}
                      style={{ fontSize: '0.7rem', color: 'var(--color-gold)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      Re-roll this 1?
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {comparing && setB ? (
            <>
              <button onClick={() => handleChooseSet(setA)} style={secondaryBtn}>
                Keep Set A
              </button>
              <button onClick={() => handleChooseSet(setB!)} style={primaryBtn}>
                Keep Set B
              </button>
            </>
          ) : (
            <>
              <button onClick={handleConfirm} style={primaryBtn}>
                These are my stats →
              </button>
              <button onClick={handleRerollAll} style={secondaryBtn}>
                Re-roll full set
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
