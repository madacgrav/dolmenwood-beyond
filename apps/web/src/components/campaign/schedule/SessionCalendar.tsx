'use client';

import { buildMonthGrid, sameDay } from '@/lib/calendar';
import type { Session } from '@/lib/data/schedule';

interface Props {
  sessions: Session[];
  month: Date;
  onPrev: () => void;
  onNext: () => void;
  selectedDay: Date | null;
  onSelectDay: (d: Date) => void;
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const navButtonStyle = {
  padding: '0.3rem 0.7rem', borderRadius: '8px',
  border: '1px solid var(--color-border)', backgroundColor: 'transparent',
  color: 'var(--color-text)', fontSize: '1rem', cursor: 'pointer', minHeight: '36px',
};

export function SessionCalendar({ sessions, month, onPrev, onNext, selectedDay, onSelectDay }: Props) {
  const cells = buildMonthGrid(month.getFullYear(), month.getMonth());
  const monthLabel = month.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div style={{
      backgroundColor: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: '10px',
      padding: '0.875rem',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <button onClick={onPrev} aria-label="Previous month" style={navButtonStyle}>‹</button>
        <div style={{ fontFamily: 'var(--font-display), Georgia, serif', fontSize: '1rem', color: 'var(--color-text)', fontWeight: '700' }}>
          {monthLabel}
        </div>
        <button onClick={onNext} aria-label="Next month" style={navButtonStyle}>›</button>
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
          const count = sessions.filter(s => sameDay(new Date(s.scheduled_at), cell.date)).length;
          const isSelected = selectedDay !== null && sameDay(cell.date, selectedDay);
          return (
            <button
              key={i}
              onClick={() => onSelectDay(cell.date)}
              style={{
                aspectRatio: '1 / 1',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: '0.15rem',
                borderRadius: '8px',
                border: isSelected ? '1px solid var(--color-primary)' : '1px solid transparent',
                backgroundColor: isSelected ? 'var(--color-bg)' : 'transparent',
                color: cell.inMonth ? 'var(--color-text)' : 'var(--color-text-muted)',
                opacity: cell.inMonth ? 1 : 0.45,
                fontSize: '0.8rem', cursor: 'pointer',
              }}
            >
              <span>{cell.date.getDate()}</span>
              {count > 0 && (
                <span style={{
                  width: '5px', height: '5px', borderRadius: '50%',
                  backgroundColor: 'var(--color-primary)',
                }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
