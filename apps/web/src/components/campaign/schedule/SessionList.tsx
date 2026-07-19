'use client';

import { useState } from 'react';
import { formatSessionDate } from '@/lib/format';
import type { RsvpStatus, Session } from '@/lib/api/schedule';
import { splitRoster, type RosterMember } from '@/lib/api/roster';
import { RsvpControl } from '@/components/campaign/schedule/RsvpControl';
import { EmptyState } from '@/components/ui/EmptyState';

interface SessionListProps {
  sessions: Session[];
  userId: string;
  isDM: boolean;
  roster: RosterMember[];
  onRsvp: (sessionId: string, status: RsvpStatus) => void;
  onEdit: (session: Session) => void;
  onDelete: (session: Session) => void;
}

/** Sort: upcoming ascending, past descending. */
function sortAsc(sessions: Session[]) {
  return [...sessions].sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
}
function sortDesc(sessions: Session[]) {
  return [...sessions].sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
}

function GroupHeader({ label }: { label: string }) {
  return (
    <div style={{
      fontFamily: 'var(--font-display), Georgia, serif',
      fontSize: '0.8rem', color: 'var(--color-text-muted)',
      textTransform: 'uppercase', letterSpacing: '0.08em',
      margin: '0.25rem 0 0',
    }}>
      {label}
    </div>
  );
}

export function SessionList({ sessions, userId, isDM, roster, onRsvp, onEdit, onDelete }: SessionListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (sessions.length === 0) {
    return <EmptyState emoji="📅" headline="No Sessions Yet" message="No sessions scheduled yet." />;
  }

  const now = Date.now();
  const upcoming = sortAsc(sessions.filter(s => new Date(s.scheduled_at).getTime() >= now));
  const past = sortDesc(sessions.filter(s => new Date(s.scheduled_at).getTime() < now));

  function renderRow(session: Session, isPast: boolean) {
    const responses = session.rsvps.map(r => ({ account_id: r.account_id, status: r.status }));
    const { groups, notResponded } = splitRoster(roster, responses);
    const yes = groups.yes ?? [];
    const maybe = groups.maybe ?? [];
    const no = groups.no ?? [];
    const myStatus = session.rsvps.find(r => r.account_id === userId)?.status ?? null;
    const canManage = session.created_by === userId || isDM;
    const expanded = expandedId === session.id;

    return (
      <div
        key={session.id}
        style={{
          backgroundColor: 'var(--color-dash-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          opacity: isPast ? 0.6 : 1,
          overflow: 'hidden',
        }}
      >
        {/* Single-line row */}
        <button
          onClick={() => setExpandedId(expanded ? null : session.id)}
          aria-expanded={expanded}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.625rem 0.875rem', background: 'none', border: 'none',
            cursor: 'pointer', minHeight: '44px', textAlign: 'left',
            justifyContent: 'flex-start',
          }}
        >
          <span style={{ flex: 1, minWidth: 0, fontWeight: '700', color: 'var(--color-text)', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {session.title}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)', whiteSpace: 'nowrap' }}>
            {formatSessionDate(session.scheduled_at)}
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
            ✓{yes.length} ?{maybe.length} ✗{no.length}
          </span>
        </button>

        {/* Expanded detail */}
        {expanded && (
          <div style={{ padding: '0 0.875rem 0.75rem' }}>
            {session.notes && (
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem', whiteSpace: 'pre-wrap' }}>
                {session.notes}
              </div>
            )}
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              {yes.length > 0 && <div>✅ Yes: {yes.map(m => m.display_name).join(', ')}</div>}
              {maybe.length > 0 && <div>❔ Maybe: {maybe.map(m => m.display_name).join(', ')}</div>}
              {no.length > 0 && <div>❌ No: {no.map(m => m.display_name).join(', ')}</div>}
              {notResponded.length > 0 && <div>⏳ Not yet responded: {notResponded.map(m => m.display_name).join(', ')}</div>}
            </div>
            <RsvpControl status={myStatus} onSet={status => onRsvp(session.id, status)} />
            {canManage && (
              <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.5rem' }}>
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
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {upcoming.length > 0 && <GroupHeader label="Upcoming" />}
      {upcoming.map(s => renderRow(s, false))}
      {past.length > 0 && <GroupHeader label="Past" />}
      {past.map(s => renderRow(s, true))}
    </div>
  );
}
