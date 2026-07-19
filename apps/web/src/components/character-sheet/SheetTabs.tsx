'use client';

export type TabName = 'stats' | 'combat' | 'inventory' | 'magic' | 'notes';

const TABS: { id: TabName; label: string }[] = [
  { id: 'stats', label: 'Stats' },
  { id: 'combat', label: 'Combat' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'magic', label: 'Magic and Abilities' },
  { id: 'notes', label: 'Notes' },
];

interface Props {
  active: TabName;
  onChange: (tab: TabName) => void;
}

/** Character-sheet tab bar styled as document dividers (shared by owner + view routes). */
export function SheetTabs({ active, onChange }: Props) {
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 10,
      backgroundColor: 'var(--color-bg)',
      borderBottom: '1px solid var(--color-border)',
      display: 'flex', overflowX: 'auto',
      scrollbarWidth: 'none',
      gap: '2px', padding: '0.375rem 0.375rem 0',
    }}>
      {TABS.map(tab => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            style={{
              flex: '1 0 auto',
              padding: '0.5rem 0.75rem',
              borderTop: isActive ? '1px solid var(--color-border)' : '1px solid transparent',
              borderLeft: isActive ? '1px solid var(--color-border)' : '1px solid transparent',
              borderRight: isActive ? '1px solid var(--color-border)' : '1px solid transparent',
              borderBottom: 'none',
              borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
              background: isActive
                ? 'linear-gradient(var(--color-sheet-surface), var(--color-sheet-surface-deep))'
                : 'transparent',
              color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
              fontWeight: isActive ? '700' : '400',
              fontFamily: isActive ? 'var(--font-display), Georgia, serif' : 'inherit',
              fontSize: '0.85rem',
              cursor: 'pointer',
              minHeight: '44px',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
