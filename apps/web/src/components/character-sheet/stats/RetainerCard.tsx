'use client';
import type { DBRetainer } from '@/lib/api/retainers';

interface Props {
  r: DBRetainer;
  expanded: boolean;
  readOnly?: boolean;
  loyaltyBase: number;
  onToggle: () => void;
  updateRetainerHP: (id: string, delta: number) => Promise<void>;
  handlePromoteClick: (id: string) => void;
  dismissRetainer: (id: string) => Promise<void>;
}

export function RetainerCard({
  r,
  expanded,
  readOnly,
  loyaltyBase,
  onToggle,
  updateRetainerHP,
  handlePromoteClick,
  dismissRetainer,
}: Props) {
  const hpPct = r.hp_max > 0 ? Math.max(0, r.hp_current / r.hp_max) : 0;
  const hpColor = hpPct > 0.66 ? 'var(--color-primary)' : hpPct > 0.33 ? 'var(--color-gold)' : 'var(--color-danger)';
  return (
    <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden' }}>
      <button
        onClick={onToggle}
        style={{ width: '100%', padding: '0.625rem 0.875rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', minHeight: '52px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--color-text)' }}>{r.name}</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginLeft: '0.5rem' }}>
              {r.kindred} {r.character_class} L{r.level}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: hpColor, fontWeight: '700' }}>
              ❤️ {r.hp_current}/{r.hp_max}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{expanded ? '▲' : '▼'}</span>
          </div>
        </div>
        <div style={{ height: '4px', borderRadius: '2px', backgroundColor: 'var(--color-border)', marginTop: '0.375rem', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${hpPct * 100}%`, backgroundColor: hpColor, borderRadius: '2px' }} />
        </div>
      </button>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--color-border)', padding: '0.75rem 0.875rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Stat row */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {[
              { label: 'AC', value: r.ac },
              { label: 'ATK', value: r.attack_bonus >= 0 ? `+${r.attack_bonus}` : r.attack_bonus },
              { label: 'Morale', value: r.morale },
              { label: 'Loyalty', value: r.loyalty },
            ].map(({ label, value }) => (
              <div key={label} style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '0.3rem 0.6rem', textAlign: 'center', minWidth: '52px' }}>
                <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{label}</div>
                <div style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--color-primary)' }}>{value}</div>
              </div>
            ))}
          </div>
          {/* HP controls */}
          {!readOnly && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>HP:</span>
            {[-1, 1].map(d => (
              <button key={d} onClick={() => updateRetainerHP(r.id, d)}
                style={{ padding: '0.25rem 0.625rem', borderRadius: '6px', border: '1px solid var(--color-border)', backgroundColor: d < 0 ? 'color-mix(in srgb, var(--color-danger) 15%, var(--color-bg))' : 'color-mix(in srgb, var(--color-primary) 15%, var(--color-bg))', color: d < 0 ? 'var(--color-danger)' : 'var(--color-primary)', cursor: 'pointer', fontWeight: '700', fontSize: '0.9rem', minHeight: '36px', minWidth: '44px' }}>
                {d > 0 ? '+1' : '−1'}
              </button>
            ))}
            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: hpColor }}>{r.hp_current} / {r.hp_max}</span>
          </div>
          )}
          {/* Wage */}
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            Wage: {r.wage_amount} gp/{r.wage_type === 'daily' ? 'day' : 'XP share'}
            {' · '}Base Loyalty: {loyaltyBase}
          </div>
          {!readOnly && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button onClick={() => handlePromoteClick(r.id)}
              style={{ padding: '0.375rem 0.875rem', borderRadius: '6px', border: '1px solid var(--color-gold)', backgroundColor: 'color-mix(in srgb, var(--color-gold) 10%, var(--color-bg))', color: 'var(--color-gold)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600', minHeight: '36px' }}>
              ⭐ Promote to Character
            </button>
            <button onClick={() => dismissRetainer(r.id)}
              style={{ padding: '0.375rem 0.875rem', borderRadius: '6px', border: '1px solid var(--color-danger)', backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, var(--color-bg))', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600', minHeight: '36px' }}>
              Dismiss retainer
            </button>
          </div>
          )}
        </div>
      )}
    </div>
  );
}
