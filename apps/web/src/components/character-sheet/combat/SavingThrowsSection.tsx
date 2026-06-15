'use client';
import { useState } from 'react';
import { rollDie, type DieType } from '@dolmenwood/rules-engine';
import { sectionHead } from './shared';

const SAVE_NAMES = [
  { key: 'doom', label: 'Death / Doom' },
  { key: 'ray', label: 'Wands / Rays' },
  { key: 'hold', label: 'Paralysis / Hold' },
  { key: 'blast', label: 'Breath / Blast' },
  { key: 'spell', label: 'Spells / Rods' },
] as const;

type SaveKey = typeof SAVE_NAMES[number]['key'];

interface RollResult { roll: number; passed: boolean; target: number; }

interface Props {
  saves: Record<string, number>;
  readOnly: boolean;
}

const ResultBadge = ({ pass, roll, target }: { pass: boolean; roll: number; target: number }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
    fontSize: '0.8rem', fontWeight: '700',
    color: pass ? 'var(--color-primary)' : 'var(--color-danger)',
    backgroundColor: pass ? 'color-mix(in srgb, var(--color-primary) 12%, var(--color-bg))' : 'color-mix(in srgb, var(--color-danger) 12%, var(--color-bg))',
    borderRadius: '6px', padding: '0.2rem 0.5rem',
  }}>
    🎲 {roll} {pass ? '✓' : '✗'} <span style={{ fontWeight: '400', fontSize: '0.72rem' }}>vs {target}+</span>
  </span>
);

export function SavingThrowsSection({ saves, readOnly }: Props) {
  const [saveRolls, setSaveRolls] = useState<Partial<Record<SaveKey, RollResult>>>({});

  function rollSave(key: SaveKey) {
    if (!saves) return;
    const target = saves[key] ?? 15;
    const roll = rollDie(20 as DieType);
    setSaveRolls(prev => ({ ...prev, [key]: { roll, passed: roll >= target, target } }));
  }

  return (
    <section>
      <h3 style={sectionHead}>Saving Throws <span style={{ fontSize: '0.72rem', fontWeight: '400', textTransform: 'none', letterSpacing: 0 }}>— tap to roll</span></h3>
      <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden' }}>
        {SAVE_NAMES.map(({ key, label }, i) => {
          const target = saves[key] ?? 15;
          const result = saveRolls[key];
          return (
            <button
              key={key}
              onClick={() => rollSave(key)}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                width: '100%', padding: '0.625rem 0.875rem',
                borderBottom: i < SAVE_NAMES.length - 1 ? '1px solid var(--color-border)' : 'none',
                backgroundColor: 'transparent', border: 'none',
                borderBottomColor: i < SAVE_NAMES.length - 1 ? 'var(--color-border)' : 'transparent',
                borderBottomWidth: i < SAVE_NAMES.length - 1 ? '1px' : '0',
                borderBottomStyle: 'solid',
                cursor: 'pointer', textAlign: 'left', minHeight: '48px',
                transition: 'background-color 0.15s',
              }}
            >
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text)' }}>{label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {result ? (
                  <ResultBadge pass={result.passed} roll={result.roll} target={target} />
                ) : (
                  <span style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--color-primary)', fontVariantNumeric: 'tabular-nums' }}>
                    {target}+
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      {Object.keys(saveRolls).length > 0 && !readOnly && (
        <button
          onClick={() => setSaveRolls({})}
          style={{ marginTop: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--color-text-muted)', padding: '0.25rem' }}
        >
          ↺ Clear rolls
        </button>
      )}
    </section>
  );
}
