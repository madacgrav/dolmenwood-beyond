'use client';
import { primaryBtn } from '@/components/wizard/shared';
import { useRouter } from 'next/navigation';
import { WizardProgress } from '@/components/wizard/WizardProgress';
import { calculateSpeed } from '@dolmenwood/rules-engine';

const TIERS: { speed: 10 | 20 | 30 | 40; label: string }[] = [
  { speed: 40, label: 'Unencumbered' },
  { speed: 30, label: 'Lightly Encumbered' },
  { speed: 20, label: 'Encumbered' },
  { speed: 10, label: 'Heavily Encumbered' },
];

// Simplified equipped weight estimate — will be computed from inventory later
const ESTIMATED_WEIGHT = 200;

export function Step10Speed({ basePath = '/characters/new/auto' }: { basePath?: string }) {
  const router = useRouter();
  const speed = calculateSpeed(ESTIMATED_WEIGHT);

  return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: '100dvh' }}>
      <WizardProgress step={10} totalSteps={13} title="Speed"
        onBack={() => router.push(`${basePath}/9`)} />
      <div style={{ padding: '1rem', maxWidth: '500px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '4rem', fontWeight: '800', color: 'var(--color-primary)', lineHeight: 1 }}>
            {speed}
          </div>
          <div style={{ color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>ft. per round</div>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
            Based on ~{ESTIMATED_WEIGHT} coins of equipped gear
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {TIERS.map(tier => {
            const isActive = tier.speed === speed;
            return (
              <div key={tier.speed} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.75rem', borderRadius: '8px',
                backgroundColor: isActive
                  ? 'color-mix(in srgb, var(--color-primary) 10%, var(--color-surface))'
                  : 'var(--color-surface)',
                border: `1px solid ${isActive ? 'var(--color-primary)' : 'var(--color-border)'}`,
              }}>
                <span style={{ color: isActive ? 'var(--color-text)' : 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                  {tier.label}
                </span>
                <span style={{
                  fontWeight: '700', fontVariantNumeric: 'tabular-nums',
                  color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                }}>
                  {tier.speed} ft
                </span>
              </div>
            );
          })}
        </div>

        <button onClick={() => router.push(`${basePath}/11`)} style={primaryBtn}>
          Continue →
        </button>
      </div>
    </div>
  );
}
