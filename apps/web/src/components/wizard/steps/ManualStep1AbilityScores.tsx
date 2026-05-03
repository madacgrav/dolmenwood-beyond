'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWizardStore } from '@/stores/wizard-store';
import { WizardProgress } from '@/components/wizard/WizardProgress';
import { getAbilityModifier, roll3d6 } from '@dolmenwood/rules-engine';
import type { AbilityScores } from '@dolmenwood/types';

const ABILITIES: { key: keyof AbilityScores; label: string }[] = [
  { key: 'str', label: 'Strength' },
  { key: 'int', label: 'Intelligence' },
  { key: 'wis', label: 'Wisdom' },
  { key: 'dex', label: 'Dexterity' },
  { key: 'con', label: 'Constitution' },
  { key: 'cha', label: 'Charisma' },
];

function isSubpar(scores: AbilityScores): boolean {
  const vals = Object.values(scores);
  return vals.every(v => v <= 6) || vals.filter(v => v <= 3).length >= 2;
}

export function ManualStep1AbilityScores() {
  const router = useRouter();
  const { abilityScores, setAbilityScores } = useWizardStore();
  const [scores, setScores] = useState<AbilityScores>(abilityScores);
  // Separate string state so partial input (e.g. typing "1" toward "15") isn't clamped mid-keystroke
  const [inputValues, setInputValues] = useState<Record<keyof AbilityScores, string>>({
    str: String(abilityScores.str),
    int: String(abilityScores.int),
    wis: String(abilityScores.wis),
    dex: String(abilityScores.dex),
    con: String(abilityScores.con),
    cha: String(abilityScores.cha),
  });

  function handleChange(key: keyof AbilityScores, raw: string) {
    setInputValues(v => ({ ...v, [key]: raw }));
  }

  function handleBlur(key: keyof AbilityScores, raw: string) {
    const v = parseInt(raw, 10);
    const clamped = isNaN(v) ? 3 : Math.min(18, Math.max(3, v));
    setInputValues(iv => ({ ...iv, [key]: String(clamped) }));
    setScores(s => ({ ...s, [key]: clamped }));
  }

  function rollOne(key: keyof AbilityScores) {
    const rolled = roll3d6();
    setScores(s => ({ ...s, [key]: rolled }));
    setInputValues(iv => ({ ...iv, [key]: String(rolled) }));
  }

  function rollAll() {
    const next = {
      str: roll3d6(), int: roll3d6(), wis: roll3d6(),
      dex: roll3d6(), con: roll3d6(), cha: roll3d6(),
    };
    setScores(next);
    setInputValues(Object.fromEntries(
      Object.entries(next).map(([k, v]) => [k, String(v)])
    ) as Record<keyof AbilityScores, string>);
  }

  const subpar = isSubpar(scores);
  const allValid = Object.values(scores).every(v => v >= 3 && v <= 18);

  function handleContinue() {
    setAbilityScores(scores);
    router.push('/characters/new/manual/2');
  }

  return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: '100dvh', paddingBottom: '2rem' }}>
      <WizardProgress
        step={1} totalSteps={13} title="Ability Scores"
        onBack={() => router.push('/characters/new')}
      />
      <div style={{ padding: '1rem', maxWidth: '480px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          <button
            onClick={rollAll}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.375rem',
              padding: '0.5rem 0.875rem',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px', cursor: 'pointer',
              color: 'var(--color-text)', fontSize: '0.875rem', minHeight: '44px',
            }}
          >
            🎲 Roll All
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {ABILITIES.map(({ key, label }) => {
            const val = scores[key];
            const mod = getAbilityModifier(val);
            return (
              <div
                key={key}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px', padding: '0.625rem 0.875rem',
                }}
              >
                <div style={{ width: '7rem', flexShrink: 0 }}>
                  <div style={{
                    fontSize: '0.75rem', textTransform: 'uppercase',
                    letterSpacing: '0.05em', color: 'var(--color-text-muted)',
                  }}>
                    {label.slice(0, 3)}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>{label}</div>
                </div>
                <input
                  type="number" min={3} max={18} value={inputValues[key]}
                  onChange={e => handleChange(key, e.target.value)}
                  onBlur={e => handleBlur(key, e.target.value)}
                  style={{
                    width: '4rem', padding: '0.5rem', textAlign: 'center',
                    fontSize: '1.25rem', fontWeight: '700',
                    backgroundColor: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '6px', color: 'var(--color-text)', minHeight: '44px',
                  }}
                />
                <div style={{
                  flex: 1, textAlign: 'center', fontWeight: '700',
                  color: mod > 0 ? 'var(--color-primary)' : mod < 0 ? 'var(--color-danger)' : 'var(--color-text-muted)',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {mod > 0 ? '+' : ''}{mod}
                </div>
                <button
                  onClick={() => rollOne(key)}
                  style={{
                    padding: '0.375rem 0.625rem',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--color-border)',
                    borderRadius: '6px', cursor: 'pointer',
                    fontSize: '1rem', minHeight: '44px', minWidth: '44px',
                  }}
                >
                  🎲
                </button>
              </div>
            );
          })}
        </div>

        {subpar && (
          <div style={{
            marginTop: '1rem', padding: '0.75rem',
            backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)',
            border: '1px solid var(--color-danger)',
            borderRadius: '8px', fontSize: '0.875rem', color: 'var(--color-danger)',
          }}>
            ⚠ Sub-par scores — consider rerolling for a better start.
          </div>
        )}

        <button
          onClick={handleContinue}
          disabled={!allValid}
          style={{
            marginTop: '1.25rem', width: '100%', padding: '0.875rem',
            backgroundColor: 'var(--color-primary)', color: 'white',
            border: 'none', borderRadius: '8px',
            fontSize: '1rem', fontWeight: '600',
            cursor: !allValid ? 'not-allowed' : 'pointer',
            opacity: !allValid ? 0.6 : 1, minHeight: '44px',
          }}
        >
          Continue →
        </button>
      </div>
    </div>
  );
}
