'use client';

import { useState } from 'react';
import { MONTHS, dayLabel, formatDwDate, monthLength, moonPhase } from '@dolmenwood/rules-engine';
import type { DwDate, MoonPhase } from '@dolmenwood/rules-engine';
import { advanceCampaignDay, setCampaignDate } from '@/lib/api/campaigns';

const MOON_GLYPH: Record<MoonPhase, string> = {
  new: '🌑',
  waxing: '🌓',
  full: '🌕',
  waning: '🌗',
};

const MOON_LABEL: Record<MoonPhase, string> = {
  new: 'New Moon',
  waxing: 'Waxing Moon',
  full: 'Full Moon',
  waning: 'Waning Moon',
};

interface Props {
  date: DwDate | null;
  /** DM-only controls: set + advance. Both required together. */
  campaignId?: string;
  isDM?: boolean;
  onChange?: (date: DwDate) => void;
}

const buttonStyle: React.CSSProperties = {
  padding: '0.375rem 0.75rem',
  borderRadius: '6px',
  border: '1px solid var(--color-border)',
  backgroundColor: 'var(--color-bg)',
  color: 'var(--color-text)',
  fontSize: '0.75rem',
  fontWeight: 600,
  cursor: 'pointer',
  minHeight: '32px',
};

export function CurrentDateCard({ date, campaignId, isDM, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<DwDate>(date ?? { year: 1, month: 1, day: 1 });

  const canControl = Boolean(isDM && campaignId);
  if (!date && !canControl) return null;

  async function handleAdvance() {
    if (!campaignId) return;
    setBusy(true);
    const next = await advanceCampaignDay(campaignId);
    setBusy(false);
    if (next) onChange?.(next);
  }

  async function handleSet() {
    if (!campaignId) return;
    setBusy(true);
    const saved = await setCampaignDate(campaignId, form);
    setBusy(false);
    if (saved) {
      setEditing(false);
      onChange?.(saved);
    }
  }

  const month = date ? MONTHS[date.month - 1] : undefined;
  const phase = date ? moonPhase(date) : null;
  const solar = date && month?.solarEvent && month.solarEvent.day === date.day ? month.solarEvent.name : null;
  const isWysenday = Boolean(date && month && date.day > month.weekDays);
  const formMonth = MONTHS[form.month - 1];

  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: '10px',
        padding: '0.75rem 1rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
        <div style={{ minWidth: 0 }}>
          {date && month ? (
            <>
              <div style={{ fontFamily: 'var(--font-display), Georgia, serif', fontWeight: '700', fontSize: '0.95rem', color: 'var(--color-text)' }}>
                {formatDwDate(date)}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.125rem' }}>
                {isWysenday ? 'Wysenday' : dayLabel(date)} · {month.seasonLabel}
                {solar && <span style={{ color: 'var(--color-gold)' }}> · ☀️ {solar}</span>}
              </div>
            </>
          ) : (
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>No date set</div>
          )}
        </div>
        {date && phase && (
          <div style={{ textAlign: 'center', flexShrink: 0 }} title={MOON_LABEL[phase]}>
            <div style={{ fontSize: '1.25rem', lineHeight: 1 }}>{MOON_GLYPH[phase]}</div>
            <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', marginTop: '0.125rem' }}>{MOON_LABEL[phase]}</div>
          </div>
        )}
      </div>

      {canControl && (
        <div style={{ marginTop: '0.625rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {date && (
            <button onClick={handleAdvance} disabled={busy} style={{ ...buttonStyle, backgroundColor: 'var(--color-primary)', color: 'white', border: 'none' }}>
              Advance day →
            </button>
          )}
          <button
            onClick={() => { setForm(date ?? { year: 1, month: 1, day: 1 }); setEditing(e => !e); }}
            disabled={busy}
            style={buttonStyle}
          >
            {editing ? 'Cancel' : 'Set date…'}
          </button>
        </div>
      )}

      {canControl && editing && (
        <div style={{ marginTop: '0.625rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="number"
            value={form.day}
            min={1}
            max={monthLength(form.month)}
            onChange={e => setForm(f => ({ ...f, day: Math.max(1, Math.min(monthLength(f.month), Number(e.target.value) || 1)) }))}
            style={{ width: '3.5rem', padding: '0.375rem', borderRadius: '6px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.8rem' }}
            aria-label="Day"
          />
          <select
            value={form.month}
            onChange={e => setForm(f => {
              const m = Number(e.target.value);
              return { ...f, month: m, day: Math.min(f.day, monthLength(m)) };
            })}
            style={{ padding: '0.375rem', borderRadius: '6px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.8rem' }}
            aria-label="Month"
          >
            {MONTHS.map((m, i) => (
              <option key={m.name} value={i + 1}>{m.name}</option>
            ))}
          </select>
          <input
            type="number"
            value={form.year}
            onChange={e => setForm(f => ({ ...f, year: Number(e.target.value) || 1 }))}
            style={{ width: '4.5rem', padding: '0.375rem', borderRadius: '6px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.8rem' }}
            aria-label="Year"
          />
          <button onClick={handleSet} disabled={busy} style={{ ...buttonStyle, backgroundColor: 'var(--color-primary)', color: 'white', border: 'none' }}>
            Save
          </button>
          {formMonth && (
            <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>
              {formMonth.name}: {monthLength(form.month)} days
            </span>
          )}
        </div>
      )}
    </div>
  );
}
