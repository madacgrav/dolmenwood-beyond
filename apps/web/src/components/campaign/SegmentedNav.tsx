'use client';

interface Item { id: string; label: string; emoji: string; }

interface Props {
  items: Item[];
  active: string;
  onChange: (id: string) => void;
}

/** Flat dashboard segmented control (campaign hub section nav). */
export function SegmentedNav({ items, active, onChange }: Props) {
  return (
    <div style={{
      display: 'flex', gap: '3px', padding: '3px',
      backgroundColor: 'var(--color-dash-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)',
    }}>
      {items.map(item => {
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            aria-pressed={isActive}
            style={{
              flex: 1, minWidth: 0, minHeight: '44px',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem',
              border: 'none', borderRadius: '6px', cursor: 'pointer',
              backgroundColor: isActive ? 'var(--color-primary)' : 'transparent',
              color: isActive ? 'white' : 'var(--color-text-muted)',
              fontSize: '0.8rem', fontWeight: isActive ? 700 : 400,
              padding: '0 0.25rem',
            }}
          >
            <span aria-hidden="true">{item.emoji}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
