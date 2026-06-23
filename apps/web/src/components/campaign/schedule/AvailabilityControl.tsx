'use client';

interface Props {
  available: boolean | null;
  onSet: (available: boolean) => void;
}

const OPTIONS: { value: boolean; label: string }[] = [
  { value: true, label: 'Available' },
  { value: false, label: 'Busy' },
];

export function AvailabilityControl({ available, onSet }: Props) {
  return (
    <div style={{ display: 'flex', gap: '0.375rem' }}>
      {OPTIONS.map(opt => {
        const active = available === opt.value;
        return (
          <button
            key={String(opt.value)}
            onClick={() => onSet(opt.value)}
            style={{
              flex: 1, padding: '0.4rem 0.5rem', borderRadius: '6px',
              border: active ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
              backgroundColor: active ? 'var(--color-primary)' : 'transparent',
              color: active ? 'white' : 'var(--color-text-muted)',
              fontWeight: active ? '700' : '500',
              fontSize: '0.78rem', cursor: 'pointer', minHeight: '36px',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
