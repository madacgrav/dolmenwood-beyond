'use client';

import type { RsvpStatus } from '@/lib/data/schedule';

interface Props {
  status: RsvpStatus | null;
  onSet: (status: RsvpStatus) => void;
}

const OPTIONS: { value: RsvpStatus; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'no', label: 'No' },
];

export function RsvpControl({ status, onSet }: Props) {
  return (
    <div style={{ display: 'flex', gap: '0.375rem' }}>
      {OPTIONS.map(opt => {
        const active = status === opt.value;
        return (
          <button
            key={opt.value}
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
