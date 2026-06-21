'use client';

import { formatSessionDate } from '@/lib/format';
import type { Session } from '@/lib/data/schedule';

interface SessionListProps {
  sessions: Session[];
  userId: string;
}

/** Sort: upcoming (>= now) ascending first, then past descending. */
function sortSessions(sessions: Session[]): Session[] {
  const now = Date.now();
  const upcoming = sessions
    .filter(s => new Date(s.scheduled_at).getTime() >= now)
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  const past = sessions
    .filter(s => new Date(s.scheduled_at).getTime() < now)
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
  return [...upcoming, ...past];
}

export function SessionList({ sessions }: SessionListProps) {
  if (sessions.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-text-muted)' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📅</div>
        <p>No sessions scheduled yet.</p>
      </div>
    );
  }

  const now = Date.now();
  const ordered = sortSessions(sessions);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {ordered.map(session => {
        const isPast = new Date(session.scheduled_at).getTime() < now;
        return (
          <div
            key={session.id}
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '10px',
              padding: '0.875rem 1rem',
              opacity: isPast ? 0.65 : 1,
            }}
          >
            <div style={{ fontWeight: '700', color: 'var(--color-text)', fontSize: '0.95rem' }}>
              {session.title}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-primary)', marginTop: '0.15rem' }}>
              {formatSessionDate(session.scheduled_at)}
            </div>
            {session.notes && (
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.4rem', whiteSpace: 'pre-wrap' }}>
                {session.notes}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
