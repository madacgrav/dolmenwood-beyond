'use client';
import type { AmmoItem } from '@/lib/data/inventory';
import { sectionHead } from './shared';

interface Props {
  ammoItems: AmmoItem[];
  adjustAmmo: (item: AmmoItem, delta: number) => Promise<void>;
  openBattle: (item: AmmoItem) => void;
}

export function AmmoSection({ ammoItems, adjustAmmo, openBattle }: Props) {
  return (
    <section>
      <h3 style={sectionHead}>Ammunition</h3>
      {ammoItems.length === 0 ? (
        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontStyle: 'italic', margin: 0 }}>
          No ammo in inventory. Add arrows, quarrels, or bolts in the Inventory tab.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {ammoItems.map(ammo => (
            <div key={ammo.id} style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '10px',
              padding: '0.75rem 0.875rem',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}>
              <span style={{ flex: 1, fontSize: '0.9rem', fontWeight: '600', color: 'var(--color-text)' }}>
                🏹 {ammo.item_name}
              </span>
              <button
                onClick={() => adjustAmmo(ammo, -1)}
                disabled={ammo.quantity <= 0}
                style={{
                  width: '36px', height: '44px', borderRadius: '6px',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-bg)', color: 'var(--color-text)',
                  fontSize: '1.1rem', cursor: 'pointer',
                  opacity: ammo.quantity <= 0 ? 0.4 : 1,
                }}
                aria-label={`Remove one ${ammo.item_name}`}
              >−</button>
              <span style={{
                minWidth: '3ch', textAlign: 'center',
                fontSize: '1.1rem', fontWeight: '700',
                color: ammo.quantity === 0 ? 'var(--color-danger)' : 'var(--color-text)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {ammo.quantity}
              </span>
              <button
                onClick={() => adjustAmmo(ammo, 1)}
                style={{
                  width: '36px', height: '44px', borderRadius: '6px',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-bg)', color: 'var(--color-text)',
                  fontSize: '1.1rem', cursor: 'pointer',
                }}
                aria-label={`Add one ${ammo.item_name}`}
              >+</button>
              {ammo.quantity > 0 && (
                <button
                  onClick={() => openBattle(ammo)}
                  style={{
                    padding: '0 0.875rem', height: '44px', borderRadius: '8px',
                    border: 'none',
                    backgroundColor: 'var(--color-primary)', color: 'white',
                    fontSize: '0.82rem', fontWeight: '700', cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ⚔️ Battle
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
