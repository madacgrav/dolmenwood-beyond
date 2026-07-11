'use client';

import { MONTHS, dayLabel, formatDwDate, moonPhase } from '@dolmenwood/rules-engine';
import type { DwDate, MoonPhase } from '@dolmenwood/rules-engine';

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
}

export function CurrentDateCard({ date }: Props) {
  if (!date) return null;
  const month = MONTHS[date.month - 1];
  if (!month) return null;
  const phase = moonPhase(date);
  const solar = month.solarEvent && month.solarEvent.day === date.day ? month.solarEvent.name : null;
  const isWysenday = date.day > month.weekDays;

  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: '10px',
        padding: '0.75rem 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-display), Georgia, serif', fontWeight: '700', fontSize: '0.95rem', color: 'var(--color-text)' }}>
          {formatDwDate(date)}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.125rem' }}>
          {isWysenday ? 'Wysenday' : dayLabel(date)} · {month.seasonLabel}
          {solar && <span style={{ color: 'var(--color-gold)' }}> · ☀️ {solar}</span>}
        </div>
      </div>
      <div style={{ textAlign: 'center', flexShrink: 0 }} title={MOON_LABEL[phase]}>
        <div style={{ fontSize: '1.25rem', lineHeight: 1 }}>{MOON_GLYPH[phase]}</div>
        <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', marginTop: '0.125rem' }}>{MOON_LABEL[phase]}</div>
      </div>
    </div>
  );
}
