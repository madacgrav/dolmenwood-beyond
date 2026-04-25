'use client';

import { useRouter } from 'next/navigation';
import { useWizardStore } from '@/stores/wizard-store';
import { WizardProgress } from '@/components/wizard/WizardProgress';
import { getAbilityModifier, getPrimeAbilities } from '@dolmenwood/rules-engine';
import type { AbilityScores } from '@dolmenwood/types';

const MODIFIER_DESCRIPTIONS: Record<keyof AbilityScores, string> = {
  str: 'Melee attack & damage, open doors',
  int: 'Languages, bonus skills, spell knowledge',
  wis: 'Magic resistance, cleric/friar spells',
  dex: 'Ranged attack, AC, initiative',
  con: 'HP bonus per level, endurance',
  cha: 'Retainers (max & loyalty), reactions',
};

export function Step5Modifiers({ basePath = '/characters/new/auto' }: { basePath?: string }) {
  const router = useRouter();
  const { abilityScores, characterClass } = useWizardStore();
  const primes = characterClass ? new Set(getPrimeAbilities(characterClass)) : new Set<string>();

  return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: '100dvh' }}>
      <WizardProgress step={5} totalSteps={13} title="Modifiers"
        onBack={() => router.push(`${basePath}/4`)} />
      <div style={{ padding: '1rem', maxWidth: '500px', margin: '0 auto' }}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
          Your ability scores and their modifiers. Tap any score to see what it affects.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: '1.5rem' }}>
          {(Object.entries(abilityScores) as [keyof AbilityScores, number][]).map(([key, score]) => {
            const mod = getAbilityModifier(score);
            const isPrime = primes.has(key.toUpperCase());
            return (
              <div key={key} style={{
                backgroundColor: 'var(--color-surface)',
                border: `1px solid ${isPrime ? 'var(--color-primary)' : 'var(--color-border)'}`,
                borderRadius: '10px', padding: '0.875rem',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ fontWeight: '600', color: 'var(--color-text)', textTransform: 'uppercase', fontSize: '0.875rem' }}>{key}</span>
                    {isPrime && (
                      <span style={{ fontSize: '0.65rem', color: 'var(--color-primary)', padding: '1px 6px', borderRadius: '999px', border: '1px solid var(--color-primary)' }}>
                        Prime
                      </span>
                    )}
                  </div>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    {MODIFIER_DESCRIPTIONS[key]}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.375rem' }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums' }}>{score}</span>
                  <span style={{ fontSize: '1rem', color: mod >= 0 ? 'var(--color-primary)' : 'var(--color-danger)', fontWeight: '600' }}>
                    {mod >= 0 ? '+' : ''}{mod}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <button
          onClick={() => router.push(`${basePath}/6`)}
          style={{ width: '100%', padding: '0.875rem', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: '600', cursor: 'pointer', minHeight: '44px' }}
        >
          Continue →
        </button>
      </div>
    </div>
  );
}
