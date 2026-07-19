'use client';

import { useMemo, useState } from 'react';
import { rollDie, rollFromNotation, type DieType } from '@dolmenwood/rules-engine';
import { usePageHeader } from '@/components/layout/PageHeaderContext';

const DICE: DieType[] = [4, 6, 8, 10, 12, 20, 100];

interface RollEntry {
  id: number;
  label: string;
  value: number;
}

export default function DicePage() {
  const [history, setHistory] = useState<RollEntry[]>([]);
  const [notation, setNotation] = useState('');
  const [seq, setSeq] = useState(0);

  function add(label: string, value: number) {
    setSeq(s => s + 1);
    setHistory(h => [{ id: seq, label, value }, ...h].slice(0, 20));
  }

  function rollNotation() {
    const trimmed = notation.trim();
    if (!trimmed) return;
    try {
      add(trimmed, rollFromNotation(trimmed));
    } catch {
      // ignore invalid notation
    }
  }

  const latest = history[0];

  usePageHeader(useMemo(() => ({ title: 'Dice' }), []));

  return (
    <div style={{ padding: '1rem', maxWidth: '600px', margin: '0 auto', minHeight: '100dvh' }}>
      {/* Latest result */}
      <div style={{
        backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: '12px', padding: '1.5rem', textAlign: 'center', marginBottom: '1.25rem',
      }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {latest ? latest.label : 'Tap a die to roll'}
        </div>
        <div style={{
          fontSize: '4rem', fontWeight: '800', lineHeight: 1.1,
          color: 'var(--color-primary)', fontVariantNumeric: 'tabular-nums',
        }}>
          {latest ? latest.value : '—'}
        </div>
      </div>

      {/* Die buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.625rem', marginBottom: '1.25rem' }}>
        {DICE.map(d => (
          <button
            key={d}
            onClick={() => add(`d${d}`, rollDie(d))}
            style={{
              padding: '0.75rem', borderRadius: '10px', cursor: 'pointer',
              backgroundColor: 'var(--color-surface)', color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              fontSize: '1rem', fontWeight: '700', minHeight: '52px',
            }}
          >
            d{d}
          </button>
        ))}
      </div>

      {/* Notation input */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <input
          value={notation}
          onChange={e => setNotation(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') rollNotation(); }}
          placeholder="e.g. 2d6"
          style={{
            flex: 1, padding: '0.625rem 0.75rem', borderRadius: '8px',
            backgroundColor: 'var(--color-bg)', color: 'var(--color-text)',
            border: '1px solid var(--color-border)', fontSize: '1rem',
            outline: 'none', minHeight: '44px', boxSizing: 'border-box',
          }}
        />
        <button
          onClick={rollNotation}
          style={{
            padding: '0 1.25rem', borderRadius: '8px', cursor: 'pointer',
            backgroundColor: 'var(--color-primary)', color: 'white',
            border: 'none', fontSize: '0.95rem', fontWeight: '600',
            minHeight: '44px', whiteSpace: 'nowrap',
          }}
        >
          🎲 Roll
        </button>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
            History
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {history.map(entry => (
              <div key={entry.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.5rem 0.75rem', borderRadius: '8px',
                backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)',
              }}>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{entry.label}</span>
                <span style={{ color: 'var(--color-text)', fontWeight: '700', fontVariantNumeric: 'tabular-nums' }}>{entry.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
