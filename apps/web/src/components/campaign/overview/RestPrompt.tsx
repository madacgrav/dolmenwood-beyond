'use client';

import { useState } from 'react';
import { sameDwDate, formatDwDate } from '@dolmenwood/rules-engine';
import type { DwDate } from '@dolmenwood/rules-engine';
import { resetSpellsForRest } from '@/lib/api/spells';
import type { MemberCharacter } from '@/lib/api/campaigns';

interface Props {
  /** The viewer's own characters in this campaign. */
  characters: MemberCharacter[];
  currentDate: DwDate | null;
}

/**
 * Opt-in per-character rest: shown when a character hasn't rested on the
 * campaign's current in-world date. Resting runs the spells rest reset
 * (slots zeroed, preparations cleared) and stamps lastRestDate.
 */
export function RestPrompt({ characters, currentDate }: Props) {
  const [rested, setRested] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!currentDate) return null;
  const need = characters.filter(c => !rested[c.id] && !sameDwDate(c.last_rest_date, currentDate));
  if (need.length === 0) return null;

  async function handleRest(characterId: string) {
    if (!currentDate) return;
    setBusyId(characterId);
    await resetSpellsForRest(characterId, currentDate);
    setBusyId(null);
    setRested(prev => ({ ...prev, [characterId]: true }));
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: '10px',
        padding: '0.75rem 1rem',
      }}
    >
      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: '0.5rem' }}>
        🌙 A new day dawns — {formatDwDate(currentDate)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        {need.map(c => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {c.name}
            </span>
            <button
              onClick={() => handleRest(c.id)}
              disabled={busyId !== null}
              style={{
                padding: '0.3rem 0.75rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'var(--color-primary)',
                color: 'white',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
                minHeight: '30px',
                flexShrink: 0,
                opacity: busyId === c.id ? 0.6 : 1,
              }}
            >
              {busyId === c.id ? 'Resting…' : 'Rest'}
            </button>
          </div>
        ))}
      </div>
      <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
        Resting restores spell slots and clears prepared spells.
      </div>
    </div>
  );
}
