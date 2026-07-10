'use client';

import { formatSessionDate } from '@/lib/format';
import type { RsvpStatus, Session } from '@/lib/api/schedule';
import { RsvpControl } from '@/components/campaign/schedule/RsvpControl';

interface SessionListProps {
  sessions: Session[];
  userId: string;
  isReferee: boolean;
  onRsvp: (sessionId: string, status: RsvpStatus) => void;
  onEdit: (session: Session) => void;
  onDelete: (session: Session) => void;
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

function tally(session: Session): { yes: number; no: number; maybe: number } {
  return session.rsvps.reduce(
    (acc, r) => { acc[r.status] += 1; return acc; },
    { yes: 0, no: 0, maybe: 0 },
  );
}

export function SessionList({ sessions, userId, isReferee, onRsvp, onEdit, onDelete }: SessionListProps) {
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
        const counts = tally(session);
        const myStatus = session.rsvps.find(r => r.account_id === userId)?.status ?? null;
        const canManage = session.created_by === userId || isReferee;
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
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '700', color: 'var(--color-text)', fontSize: '0.95rem' }}>
                  {session.title}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-primary)', marginTop: '0.15rem' }}>
                  {formatSessionDate(session.scheduled_at)}
                </div>
              </div>
              {canManage && (
                <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
                  <button
                    onClick={() => onEdit(session)}
                    style={{
                      padding: '0.3rem 0.5rem', borderRadius: '6px',
                      border: '1px solid var(--color-border)', backgroundColor: 'transparent',
                      color: 'var(--color-text-muted)', fontSize: '0.72rem', cursor: 'pointer',
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(session)}
                    style={{
                      padding: '0.3rem 0.5rem', borderRadius: '6px',
                      border: '1px solid var(--color-border)', backgroundColor: 'transparent',
                      color: 'var(--color-danger)', fontSize: '0.72rem', cursor: 'pointer',
                    }}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
            {session.notes && (
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.4rem', whiteSpace: 'pre-wrap' }}>
                {session.notes}
              </div>
            )}

            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.6rem', marginBottom: '0.4rem' }}>
              ✅ {counts.yes} · ❔ {counts.maybe} · ❌ {counts.no}
            </div>
            <RsvpControl status={myStatus} onSet={status => onRsvp(session.id, status)} />
          </div>
        );
      })}
    </div>
  );
}
