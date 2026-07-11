'use client';

import { formatSessionDate } from '@/lib/format';
import type { RsvpStatus, Session } from '@/lib/api/schedule';
import { splitRoster, type RosterMember } from '@/lib/api/roster';
import { RsvpControl } from '@/components/campaign/schedule/RsvpControl';

interface SessionListProps {
  sessions: Session[];
  userId: string;
  isDM: boolean;
  roster: RosterMember[];
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

export function SessionList({ sessions, userId, isDM, roster, onRsvp, onEdit, onDelete }: SessionListProps) {
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
        const responses = session.rsvps.map(r => ({ account_id: r.account_id, status: r.status }));
        const { groups, notResponded } = splitRoster(roster, responses);
        const yes = groups.yes ?? [];
        const maybe = groups.maybe ?? [];
        const no = groups.no ?? [];
        const myStatus = session.rsvps.find(r => r.account_id === userId)?.status ?? null;
        const canManage = session.created_by === userId || isDM;
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

            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.6rem', marginBottom: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              {yes.length > 0 && <div>✅ Yes: {yes.map(m => m.display_name).join(', ')}</div>}
              {maybe.length > 0 && <div>❔ Maybe: {maybe.map(m => m.display_name).join(', ')}</div>}
              {no.length > 0 && <div>❌ No: {no.map(m => m.display_name).join(', ')}</div>}
              {notResponded.length > 0 && <div>⏳ Not yet responded: {notResponded.map(m => m.display_name).join(', ')}</div>}
            </div>
            <RsvpControl status={myStatus} onSet={status => onRsvp(session.id, status)} />
          </div>
        );
      })}
    </div>
  );
}
