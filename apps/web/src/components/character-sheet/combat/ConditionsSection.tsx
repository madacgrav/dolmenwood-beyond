'use client';
import { useState } from 'react';
import { sectionHead } from './shared';

const CONDITIONS = ['Poisoned', 'Paralysed', 'Unconscious'] as const;
type Condition = typeof CONDITIONS[number];

export function ConditionsSection() {
  const [conditions, setConditions] = useState<Set<Condition>>(new Set());

  function toggleCondition(c: Condition) {
    setConditions(prev => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c); else next.add(c);
      return next;
    });
  }

  return (
    <section>
      <h3 style={sectionHead}>Conditions</h3>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {CONDITIONS.map(c => {
          const active = conditions.has(c);
          return (
            <button
              key={c}
              onClick={() => toggleCondition(c)}
              style={{
                padding: '0.375rem 0.875rem', borderRadius: '20px',
                border: `2px solid ${active ? 'var(--color-danger)' : 'var(--color-border)'}`,
                backgroundColor: active ? 'color-mix(in srgb, var(--color-danger) 15%, var(--color-bg))' : 'var(--color-surface)',
                color: active ? 'var(--color-danger)' : 'var(--color-text-muted)',
                fontWeight: active ? '700' : '400', fontSize: '0.85rem', cursor: 'pointer', minHeight: '44px',
              }}
            >
              {active ? '⚠️ ' : ''}{c}
            </button>
          );
        })}
      </div>
    </section>
  );
}
