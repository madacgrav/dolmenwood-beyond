'use client';
import { calculateSpeed } from '@dolmenwood/rules-engine';
import type { InventoryItem as DBInventoryItem } from '@/lib/api/inventory';

interface Props {
  items: DBInventoryItem[];
  coinWeight?: number;
}

/** Encumbrance + Speed card. Tiny items don't count toward carried weight. */
export function WeightBar({ items, coinWeight = 0 }: Props) {
  const itemWeight = items.reduce((sum, item) => {
    if (item.location === 'tiny') return sum;
    return sum + (item.weight_coins * item.quantity);
  }, 0);
  const totalWeight = itemWeight + coinWeight;
  const speed = calculateSpeed(totalWeight);
  const speedColor = speed >= 40 ? 'var(--color-primary)' : speed >= 30 ? 'var(--color-text)' : speed >= 20 ? 'var(--color-gold)' : 'var(--color-danger)';
  const maxWeight = 800;
  const weightPct = Math.min(1, totalWeight / maxWeight);

  return (
    <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '0.875rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.625rem' }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Carried Weight (Equipped + Stowed)</div>
          <div style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--color-text)' }}>{totalWeight} / 800 coins</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Speed</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: speedColor }}>{speed}′</div>
        </div>
      </div>
      <div style={{ height: '8px', borderRadius: '4px', backgroundColor: 'var(--color-border)', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${weightPct * 100}%`,
          backgroundColor: speedColor,
          borderRadius: '4px',
          transition: 'width 0.3s, background-color 0.3s',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.35rem', fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>
        {[{ w: 400, s: 40 }, { w: 600, s: 30 }, { w: 800, s: 20 }].map(({ w, s }) => (
          <span key={w} style={{ color: totalWeight >= w ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
            {w}¢→{s}′
          </span>
        ))}
      </div>
    </div>
  );
}
