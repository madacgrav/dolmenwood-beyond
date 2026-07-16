'use client';
import { useCallback, useEffect, useState } from 'react';
import type { InventoryItem as DBInventoryItem } from '@/lib/api/inventory';
import { listLights, lightSource, burnTurn, extinguish, type ActiveLightDoc } from '@/lib/api/light';
import { lightSourceFor } from '@/lib/light-data';
import { sectionHead } from './types';

interface Props {
  characterId: string;
  items: DBInventoryItem[];
  isOwner: boolean;
  /** Called after lighting succeeds so the item list can drop one from that stack. */
  onItemConsumed: (itemId: string) => void;
}

/** Manual burn-down tracker for light/heat sources (torches, oil, candles,
 *  firewood). Lighting consumes one from inventory; the player taps
 *  "Turn passes" as in-game time goes by — there is no automatic clock. */
export function LightTracker({ characterId, items, isOwner, onItemConsumed }: Props) {
  const [lights, setLights] = useState<ActiveLightDoc[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    listLights(characterId).then(setLights);
  }, [characterId]);

  const run = useCallback(async (fn: () => Promise<ActiveLightDoc[]>) => {
    setError('');
    try {
      setLights(await fn());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'request failed');
    }
  }, []);

  const lightable = items.filter(i => lightSourceFor(i.item_name) && i.quantity > 0);

  if (!isOwner && lights.length === 0) return null;

  return (
    <section>
      <h3 style={sectionHead}>Light & Fire</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {lights.map(light => {
          const icon = lightSourceFor(light.itemName)?.icon ?? '🔥';
          const out = light.turnsRemaining === 0;
          return (
            <div key={light.id} style={{
              backgroundColor: 'var(--color-surface)',
              border: `1px solid ${out ? 'var(--color-danger)' : 'var(--color-border)'}`,
              borderRadius: '10px',
              padding: '0.75rem 0.875rem',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}>
              <span style={{ fontSize: '1.25rem', opacity: out ? 0.5 : 1 }}>{icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--color-text)' }}>{light.itemName}</div>
                <div style={{ fontSize: '0.72rem', color: out ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                  {out ? 'Burned out' : `${light.turnsRemaining} of ${light.totalTurns} turns left`}
                </div>
              </div>
              <span style={{
                minWidth: '3ch', textAlign: 'center',
                fontSize: '1.25rem', fontWeight: '700',
                fontVariantNumeric: 'tabular-nums',
                color: out ? 'var(--color-danger)' : 'var(--color-text)',
              }}>
                {light.turnsRemaining}
              </span>
              {isOwner && !out && (
                <button
                  onClick={() => run(() => burnTurn(characterId, light.id))}
                  style={{
                    padding: '0 0.875rem', height: '44px', borderRadius: '8px',
                    border: 'none',
                    backgroundColor: 'var(--color-primary)', color: 'white',
                    fontSize: '0.82rem', fontWeight: '700', cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ⏳ Turn passes
                </button>
              )}
              {isOwner && (
                <button
                  onClick={() => run(() => extinguish(characterId, light.id))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontSize: '1rem', padding: '0.25rem', minHeight: '44px', minWidth: '44px' }}
                  aria-label={`Extinguish ${light.itemName}`}
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}

        {lights.length === 0 && (
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontStyle: 'italic', margin: 0 }}>
            Nothing burning.
          </p>
        )}

        {isOwner && lightable.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {lightable.map(item => (
              <button
                key={item.id}
                onClick={() => run(async () => {
                  const next = await lightSource(characterId, item.id);
                  onItemConsumed(item.id);
                  return next;
                })}
                style={{
                  padding: '0.375rem 0.875rem', borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)', color: 'var(--color-primary)',
                  fontSize: '0.82rem', fontWeight: '700', cursor: 'pointer',
                  minHeight: '44px',
                }}
              >
                {lightSourceFor(item.item_name)?.icon} Light {item.item_name} (×{item.quantity})
              </button>
            ))}
          </div>
        )}

        {error && (
          <div style={{ fontSize: '0.78rem', color: 'var(--color-danger)' }}>{error}</div>
        )}
      </div>
    </section>
  );
}
