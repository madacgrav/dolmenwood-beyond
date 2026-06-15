'use client';
import { primaryBtn, secondaryBtn } from '@/components/wizard/shared';

import { useRouter } from 'next/navigation';
import { useWizardStore } from '@/stores/wizard-store';
import { WizardProgress } from '@/components/wizard/WizardProgress';
import { getAbilityModifier, getXPModifier, getPrimeAbilities } from '@dolmenwood/rules-engine';
import type { AbilityScores } from '@dolmenwood/types';

const ABILITY_LABELS: Record<keyof AbilityScores, string> = {
  str: 'STR', int: 'INT', wis: 'WIS', dex: 'DEX', con: 'CON', cha: 'CHA',
};

export function Step4AbilityAdjust({ basePath = '/characters/new/auto' }: { basePath?: string }) {
  const router = useRouter();
  const { abilityScores, setAbilityScores, characterClass } = useWizardStore();
  const primes = characterClass ? new Set(getPrimeAbilities(characterClass)) : new Set<string>();
  const xpMod = characterClass
    ? getXPModifier([...primes].map(p => abilityScores[p.toLowerCase() as keyof AbilityScores] ?? 10))
    : 0;

  function adjust(from: keyof AbilityScores, to: keyof AbilityScores, amount: number) {
    const newScores = { ...abilityScores };
    newScores[from] = Math.max(3, newScores[from]! - amount * 2);
    newScores[to] = Math.min(18, newScores[to]! + amount);
    setAbilityScores(newScores);
  }

  // suppress unused variable warning — adjust is available for future use
  void adjust;

  return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: '100dvh' }}>
      <WizardProgress step={4} totalSteps={13} title="Adjust Scores (Optional)"
        onBack={() => router.push(`${basePath}/3`)} />
      <div style={{ padding: '1rem', maxWidth: '500px', margin: '0 auto' }}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
          Optionally trade points: spend 2 from any non-prime score to gain 1 on a prime score.
        </p>
        <div style={{
          padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem',
          backgroundColor: 'color-mix(in srgb, var(--color-gold) 10%, transparent)',
          border: '1px solid var(--color-gold)',
        }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--color-gold)' }}>
            XP Modifier: {xpMod >= 0 ? '+' : ''}{xpMod}%
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {(Object.keys(abilityScores) as (keyof AbilityScores)[]).map(key => {
            const score = abilityScores[key]!;
            const mod = getAbilityModifier(score);
            const isPrime = primes.has(key.toUpperCase());
            return (
              <div key={key} style={{
                backgroundColor: 'var(--color-surface)',
                border: `1px solid ${isPrime ? 'var(--color-primary)' : 'var(--color-border)'}`,
                borderRadius: '10px', padding: '0.875rem',
                position: 'relative',
              }}>
                {isPrime && (
                  <div style={{ position: 'absolute', top: '6px', right: '8px', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-primary)' }} />
                )}
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                  {ABILITY_LABELS[key]}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.375rem', margin: '0.25rem 0' }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-text)' }}>{score}</span>
                  <span style={{ fontSize: '0.9rem', color: mod >= 0 ? 'var(--color-primary)' : 'var(--color-danger)' }}>
                    {mod >= 0 ? '+' : ''}{mod}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <button onClick={() => router.push(`${basePath}/5`)} style={primaryBtn}>
          Continue →
        </button>
        <button onClick={() => router.push(`${basePath}/5`)} style={{ ...secondaryBtn, marginTop: '0.75rem' }}>
          Skip
        </button>
      </div>
    </div>
  );
}
