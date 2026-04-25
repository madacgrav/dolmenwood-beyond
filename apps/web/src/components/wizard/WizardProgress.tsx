interface WizardProgressProps {
  step: number;
  totalSteps: number;
  title: string;
  onBack?: () => void;
}

export function WizardProgress({ step, totalSteps, title, onBack }: WizardProgressProps) {
  const pct = (step / totalSteps) * 100;

  return (
    <div style={{ padding: '1rem 1rem 0' }}>
      {/* Top row: back + step count */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.75rem', gap: '0.75rem' }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-text-muted)', fontSize: '1.25rem',
              padding: '0', minHeight: '44px', minWidth: '44px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
            aria-label="Go back"
          >
            ‹
          </button>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
            <span style={{
              fontFamily: 'var(--font-display), Georgia, serif',
              fontSize: '1rem', fontWeight: '600', color: 'var(--color-text)',
            }}>
              {title}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              {step} / {totalSteps}
            </span>
          </div>
          {/* Progress bar */}
          <div style={{ height: '4px', borderRadius: '2px', backgroundColor: 'var(--color-border)' }}>
            <div style={{
              height: '100%', borderRadius: '2px',
              backgroundColor: 'var(--color-primary)',
              width: `${pct}%`,
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>
      </div>
    </div>
  );
}
