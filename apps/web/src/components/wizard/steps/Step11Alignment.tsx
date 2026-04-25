'use client';
import { useRouter } from 'next/navigation';
import { useWizardStore } from '@/stores/wizard-store';
import { WizardProgress } from '@/components/wizard/WizardProgress';
import type { Alignment } from '@dolmenwood/types';

interface AlignmentOption {
  value: Alignment;
  label: string;
  icon: string;
  description: string;
}

const ALIGNMENTS: AlignmentOption[] = [
  {
    value: 'lawful',
    label: 'Lawful',
    icon: '⚖️',
    description: 'Upholds order, tradition, and the bonds of society. Serves the church, the crown, or the old compact.',
  },
  {
    value: 'neutral',
    label: 'Neutral',
    icon: '🌿',
    description: "Neither bound by law nor chaos. Follows nature's balance, personal codes, or pragmatic self-interest.",
  },
  {
    value: 'chaotic',
    label: 'Chaotic',
    icon: '🌀',
    description: 'Embraces freedom, impulse, and the untamed wild. May serve fairy powers or simply answer to no one.',
  },
];

// Classes restricted from chaotic alignment
const NO_CHAOTIC = new Set(['Cleric', 'Friar']);

export function Step11Alignment() {
  const router = useRouter();
  const { alignment, setAlignment, characterClass } = useWizardStore();

  function handleSelect(a: Alignment) {
    setAlignment(a);
    router.push('/characters/new/auto/12');
  }

  return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: '100dvh' }}>
      <WizardProgress step={11} totalSteps={13} title="Choose Alignment"
        onBack={() => router.push('/characters/new/auto/10')} />
      <div style={{ padding: '1rem', maxWidth: '500px', margin: '0 auto' }}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
          Alignment shapes your character's worldview in Dolmenwood.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {ALIGNMENTS.map(({ value, label, description, icon }) => {
            const restricted = value === 'chaotic' && characterClass != null && NO_CHAOTIC.has(characterClass);
            const isSelected = alignment === value;
            return (
              <button
                key={value}
                onClick={() => { if (!restricted) handleSelect(value); }}
                disabled={restricted}
                style={{
                  display: 'flex', gap: '1rem', alignItems: 'flex-start',
                  padding: '1rem', borderRadius: '10px', textAlign: 'left', width: '100%',
                  cursor: restricted ? 'not-allowed' : 'pointer',
                  backgroundColor: isSelected
                    ? 'color-mix(in srgb, var(--color-primary) 10%, var(--color-surface))'
                    : restricted
                      ? 'color-mix(in srgb, var(--color-border) 30%, var(--color-surface))'
                      : 'var(--color-surface)',
                  border: `2px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  opacity: restricted ? 0.5 : 1,
                }}
              >
                <span style={{ fontSize: '2rem', flexShrink: 0 }}>{icon}</span>
                <div>
                  <div style={{
                    fontFamily: 'var(--font-display), Georgia, serif',
                    fontWeight: '600', color: 'var(--color-text)', marginBottom: '0.25rem',
                  }}>
                    {label}
                  </div>
                  <div style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
                    {description}
                  </div>
                  {restricted && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-danger)', marginTop: '0.375rem' }}>
                      Not available for {characterClass}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
