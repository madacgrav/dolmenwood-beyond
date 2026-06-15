'use client';
import { primaryBtn } from '@/components/wizard/shared';
import { useRouter } from 'next/navigation';
import { useWizardStore } from '@/stores/wizard-store';
import { WizardProgress } from '@/components/wizard/WizardProgress';
import { getXPModifier, getPrimeAbilities, getXPThresholdForNextLevel } from '@dolmenwood/rules-engine';

export function Step12LevelXP() {
  const router = useRouter();
  const { abilityScores, characterClass } = useWizardStore();
  const primes = characterClass ? getPrimeAbilities(characterClass) : [];
  const primeScores = primes.map(p => abilityScores[p.toLowerCase() as keyof typeof abilityScores] ?? 10);
  const xpMod = primeScores.length > 0 ? getXPModifier(primeScores) : 0;
  const nextLevelXP = characterClass ? getXPThresholdForNextLevel(characterClass, 1) : 0;

  const stats = [
    { label: 'Level', value: '1' },
    { label: 'Current XP', value: '0' },
    { label: 'XP Modifier', value: `${xpMod >= 0 ? '+' : ''}${xpMod}%` },
    { label: 'Next Level', value: nextLevelXP > 0 ? `${nextLevelXP} XP` : '—' },
  ];

  return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: '100dvh' }}>
      <WizardProgress step={12} totalSteps={13} title="Level & XP"
        onBack={() => router.push('/characters/new/auto/11')} />
      <div style={{ padding: '1rem', maxWidth: '500px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {stats.map(({ label, value }) => (
            <div key={label} style={{
              backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)',
              borderRadius: '10px', padding: '0.875rem', textAlign: 'center',
            }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {label}
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--color-text)', marginTop: '0.25rem', fontVariantNumeric: 'tabular-nums' }}>
                {value}
              </div>
            </div>
          ))}
        </div>

        {primes.length > 0 && (
          <div style={{
            backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: '10px', padding: '0.875rem', marginBottom: '1.5rem',
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
              Prime Abilities
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {primes.map(p => (
                <span key={p} style={{
                  padding: '0.25rem 0.625rem', borderRadius: '6px',
                  backgroundColor: 'color-mix(in srgb, var(--color-primary) 15%, transparent)',
                  color: 'var(--color-primary)', fontSize: '0.875rem', fontWeight: '600',
                }}>
                  {p.toUpperCase()} {abilityScores[p.toLowerCase() as keyof typeof abilityScores]}
                </span>
              ))}
            </div>
          </div>
        )}

        {xpMod !== 0 && (
          <div style={{
            padding: '0.875rem', borderRadius: '8px', marginBottom: '1.5rem',
            backgroundColor: xpMod > 0
              ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)'
              : 'color-mix(in srgb, var(--color-danger) 10%, transparent)',
            border: `1px solid ${xpMod > 0 ? 'var(--color-primary)' : 'var(--color-danger)'}`,
          }}>
            <p style={{ margin: 0, fontSize: '0.875rem', color: xpMod > 0 ? 'var(--color-primary)' : 'var(--color-danger)' }}>
              {xpMod > 0
                ? `✦ Your prime abilities grant a +${xpMod}% XP bonus — you'll level up faster!`
                : `⚠ Your prime abilities impose a ${Math.abs(xpMod)}% XP penalty.`}
            </p>
          </div>
        )}

        <button onClick={() => router.push('/characters/new/auto/13')} style={primaryBtn}>
          Continue →
        </button>
      </div>
    </div>
  );
}
