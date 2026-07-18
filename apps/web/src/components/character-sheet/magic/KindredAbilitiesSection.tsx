'use client';
import { useMemo, useState } from 'react';
import type { KindredTrait } from '@dolmenwood/rules-engine';
import { getSpellsForClass } from '@dolmenwood/rules-engine';
import type { DBSpell } from '@/lib/api/spells';
import { SECTION_HEADER, SELECT_STYLE } from './types';

interface Props {
  kindred: string;
  traits: KindredTrait[];
  readOnly?: boolean;
  kindredGlamour?: DBSpell | null;
  onRollGlamour?: () => Promise<boolean>;
  onPickGlamour?: (name: string) => Promise<boolean>;
  onDelete?: (id: string) => void;
}

const CARD_STYLE: React.CSSProperties = {
  backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)',
  borderRadius: '8px', padding: '0.625rem 0.875rem',
};

const SMALL_BTN: React.CSSProperties = {
  padding: '0.4rem 0.75rem', borderRadius: '6px', border: 'none',
  backgroundColor: 'var(--color-primary)', color: 'white',
  fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', minHeight: '36px',
};

/** Quasi-magical kindred abilities: trait cards, plus the kindred glamour roll/pick. */
export function KindredAbilitiesSection({
  kindred, traits, readOnly, kindredGlamour, onRollGlamour, onPickGlamour, onDelete,
}: Props) {
  const [pickedGlamour, setPickedGlamour] = useState('');

  const glamourOptions = useMemo(() => getSpellsForClass('Enchanter').map(s => s.name), []);

  async function pickGlamour() {
    if (!pickedGlamour || !onPickGlamour) return;
    const ok = await onPickGlamour(pickedGlamour);
    if (ok) setPickedGlamour('');
  }

  return (
    <section>
      <h3 style={{ ...SECTION_HEADER, marginBottom: '0.75rem' }}>Kindred Abilities — {kindred}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {traits.map(t => (
          <div key={t.name} style={CARD_STYLE}>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text)' }}>{t.name}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>{t.description}</div>

            {t.name === 'Glamours' && (
              kindredGlamour ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.6rem',
                  borderTop: '1px solid var(--color-border)', paddingTop: '0.6rem',
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.9rem', color: 'var(--color-text)' }}>{kindredGlamour.spell_name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Kindred Glamour</div>
                  </div>
                  {!readOnly && onDelete && (
                    <button
                      onClick={() => onDelete(kindredGlamour.id)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--color-danger)', fontSize: '1rem',
                        padding: '0.25rem', minHeight: '44px', minWidth: '44px',
                      }}
                      aria-label={`Delete ${kindredGlamour.spell_name}`}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ) : !readOnly ? (
                <div style={{
                  marginTop: '0.6rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.6rem',
                  display: 'flex', flexDirection: 'column', gap: '0.5rem',
                }}>
                  {onRollGlamour && (
                    <button onClick={() => onRollGlamour()} style={SMALL_BTN}>
                      🎲 Roll Glamour
                    </button>
                  )}
                  {onPickGlamour && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <select
                        value={pickedGlamour}
                        onChange={e => setPickedGlamour(e.target.value)}
                        style={{ ...SELECT_STYLE, flex: 1, minHeight: '36px' }}
                      >
                        <option value="">Choose a glamour…</option>
                        {glamourOptions.map(name => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                      <button onClick={pickGlamour} disabled={!pickedGlamour} style={{ ...SMALL_BTN, opacity: pickedGlamour ? 1 : 0.5 }}>
                        Add
                      </button>
                    </div>
                  )}
                </div>
              ) : null
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
