'use client';

import { useState } from 'react';
import { buildMonthGrid, sameDay } from '@/lib/calendar';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const navButtonStyle = {
  padding: '0.3rem 0.7rem', borderRadius: '8px',
  border: '1px solid var(--color-border)', backgroundColor: 'transparent',
  color: 'var(--color-text)', fontSize: '1rem', cursor: 'pointer', minHeight: '36px',
};

function firstOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Date → 'YYYY-MM-DD' (local wall-clock), matching the datetime-local date part. */
export function toDayInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

interface Props {
  value: Date | null;
  onSelect: (d: Date) => void;
  onClose: () => void;
}

export function CalendarDatePicker({ value, onSelect, onClose }: Props) {
  const [month, setMonth] = useState<Date>(() => firstOfMonth(value ?? new Date()));
  const cells = buildMonthGrid(month.getFullYear(), month.getMonth());
  const monthLabel = month.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '14px', padding: '1rem', maxWidth: '340px', width: '100%' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month" style={navButtonStyle}>‹</button>
          <div style={{ fontFamily: 'var(--font-display), Georgia, serif', fontSize: '1rem', color: 'var(--color-text)', fontWeight: '700' }}>
            {monthLabel}
          </div>
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month" style={navButtonStyle}>›</button>
        </div>

        {/* Weekday row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.25rem', marginBottom: '0.25rem' }}>
          {WEEKDAYS.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: '0.65rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.25rem' }}>
          {cells.map((cell, i) => {
            const isSelected = value !== null && sameDay(cell.date, value);
            return (
              <button
                key={i}
                onClick={() => onSelect(cell.date)}
                style={{
                  aspectRatio: '1 / 1',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '8px',
                  border: isSelected ? '1px solid var(--color-primary)' : '1px solid transparent',
                  backgroundColor: isSelected ? 'var(--color-primary)' : 'transparent',
                  color: isSelected ? 'white' : cell.inMonth ? 'var(--color-text)' : 'var(--color-text-muted)',
                  opacity: cell.inMonth ? 1 : 0.45,
                  fontSize: '0.8rem', cursor: 'pointer',
                }}
              >
                {cell.date.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
