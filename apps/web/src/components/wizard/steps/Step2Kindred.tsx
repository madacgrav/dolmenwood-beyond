'use client';

import { useRouter } from 'next/navigation';
import { useWizardStore } from '@/stores/wizard-store';
import { WizardProgress } from '@/components/wizard/WizardProgress';
import { getKindredData, getKindredTraits, ALL_KINDREDS } from '@dolmenwood/rules-engine';
import type { Kindred } from '@dolmenwood/types';

const KINDRED_DESCRIPTIONS: Record<Kindred, string> = {
  Human: 'Adaptable and ambitious folk who can pursue any calling.',
  Breggle: 'Horned and woolly, with a fierce spirit and charming gaze.',
  Elf: 'Otherworldly and ancient, touched by fairy glamours.',
  Grimalkin: 'Feline wanderers with a taste for secrets and sorcery.',
  Mossling: 'Gentle mushroom-folk, wise in the ways of the forest.',
  Woodgrue: 'Wild and cunning forest tricksters, small but fierce.',
};

const KINDRED_PRIME_ABILITIES: Record<Kindred, string[]> = {
  Human: ['Any'], Breggle: ['STR', 'CHA'], Elf: ['INT', 'DEX'],
  Grimalkin: ['DEX', 'CHA'], Mossling: ['WIS', 'CON'], Woodgrue: ['DEX', 'WIS'],
};

export function Step2Kindred({ basePath = '/characters/new/auto' }: { basePath?: string }) {
  const router = useRouter();
  const { abilityScores, kindred: selected, setKindred } = useWizardStore();

  const sorted = (Object.entries(abilityScores) as [string, number][])
    .sort(([, a], [, b]) => b - a);
  const top2 = new Set(sorted.slice(0, 2).map(([k]) => k.toUpperCase()));

  function suitsBadge(k: Kindred): boolean {
    if (k === 'Human') return false;
    const primes = KINDRED_PRIME_ABILITIES[k] ?? [];
    return primes.some(p => top2.has(p));
  }

  function handleSelect(k: Kindred) {
    setKindred(k);
    router.push(`${basePath}/3`);
  }

  return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: '100dvh' }}>
      <WizardProgress
        step={2} totalSteps={13} title="Choose Kindred"
        onBack={() => router.push(`${basePath}/1`)}
      />
      <div style={{ padding: '1rem', maxWidth: '500px', margin: '0 auto' }}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
          Choose your character&apos;s kindred (ancestry).
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {ALL_KINDREDS.map((k) => {
            const traits = getKindredTraits(k).slice(0, 2);
            const suits = suitsBadge(k as Kindred);
            const isSelected = selected === k;

            return (
              <button
                key={k}
                onClick={() => handleSelect(k as Kindred)}
                style={{
                  display: 'flex', flexDirection: 'column', gap: '0.5rem',
                  padding: '1rem', borderRadius: '10px', textAlign: 'left',
                  backgroundColor: isSelected
                    ? 'color-mix(in srgb, var(--color-primary) 10%, var(--color-surface))'
                    : 'var(--color-surface)',
                  border: `2px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  cursor: 'pointer', width: '100%', minHeight: '44px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    fontFamily: 'var(--font-display), Georgia, serif',
                    fontWeight: '600', color: 'var(--color-text)', fontSize: '1rem',
                  }}>{k}</span>
                  {suits && (
                    <span style={{
                      fontSize: '0.7rem', padding: '2px 8px', borderRadius: '999px',
                      backgroundColor: 'color-mix(in srgb, var(--color-gold) 20%, transparent)',
                      color: 'var(--color-gold)', fontWeight: '600',
                    }}>
                      ✦ Suits your rolls
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--color-text-muted)' }}>
                  {KINDRED_DESCRIPTIONS[k as Kindred]}
                </p>
                {traits.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.25rem' }}>
                    {traits.map(t => (
                      <span key={t.name} style={{
                        fontSize: '0.7rem', padding: '2px 8px', borderRadius: '999px',
                        backgroundColor: 'var(--color-bg)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text-muted)',
                      }}>{t.name}</span>
                    ))}
                    {getKindredTraits(k).length > 2 && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', alignSelf: 'center' }}>
                        +{getKindredTraits(k).length - 2} more
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
