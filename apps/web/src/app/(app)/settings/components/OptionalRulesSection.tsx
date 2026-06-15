'use client';

import { useOptionalRules } from '@/hooks/use-optional-rules';
import { sectionStyle, sectionHeaderStyle } from './styles';

export function OptionalRulesSection() {
  const [optionalRules, setOptionalRules] = useOptionalRules();

  return (
    <section style={sectionStyle}>
      <h2 style={sectionHeaderStyle}>Optional Rules</h2>
      {[
        { key: 'subParReroll' as const, label: 'Sub-Par Re-roll', desc: 'Allow re-rolling if all ability scores are below 9' },
        { key: 'hpRerollLowRolls' as const, label: 'Re-roll Low HP', desc: 'Re-roll HP if result is 1 or 2 at level-up' },
        { key: 'coinWeightEnabled' as const, label: 'Coin Weight', desc: 'Count coins toward encumbrance (100 coins = 1 item)' },
      ].map(({ key, label, desc }) => (
        <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
          <div>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>{label}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.125rem' }}>{desc}</div>
          </div>
          <button
            onClick={() => setOptionalRules(prev => ({ ...prev, [key]: !prev[key] }))}
            aria-label={optionalRules[key] ? `Disable ${label}` : `Enable ${label}`}
            style={{ width: '52px', height: '28px', borderRadius: '14px', border: 'none', cursor: 'pointer', backgroundColor: optionalRules[key] ? 'var(--color-primary)' : 'var(--color-border)', position: 'relative', transition: 'background-color 0.2s', flexShrink: 0 }}
          >
            <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: 'white', position: 'absolute', top: '3px', left: optionalRules[key] ? '27px' : '3px', transition: 'left 0.2s' }} />
          </button>
        </div>
      ))}
    </section>
  );
}
