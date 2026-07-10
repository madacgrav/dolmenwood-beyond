'use client';

import { formatSessionDate } from '@/lib/format';
import type { Proposal } from '@/lib/api/proposals';
import { AvailabilityControl } from '@/components/campaign/schedule/AvailabilityControl';

interface ProposalListProps {
  proposals: Proposal[];
  userId: string;
  isReferee: boolean;
  onDelete: (proposal: Proposal) => void;
  onAvail: (proposalId: string, available: boolean) => void;
}

/** Sort: soonest proposed date first. */
function sortProposals(proposals: Proposal[]): Proposal[] {
  return [...proposals].sort(
    (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime(),
  );
}

export function ProposalList({ proposals, userId, isReferee, onDelete, onAvail }: ProposalListProps) {
  if (proposals.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--color-text-muted)' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🗓️</div>
        <p style={{ fontSize: '0.85rem' }}>No dates proposed yet.</p>
      </div>
    );
  }

  const ordered = sortProposals(proposals);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {ordered.map(proposal => {
        const canManage = proposal.created_by === userId || isReferee;
        const isConfirmed = proposal.status === 'confirmed';
        const myAvailable = proposal.availability.find(a => a.account_id === userId)?.available ?? null;
        const approved = proposal.availability.filter(a => a.available).length;
        const approverNames = proposal.availability.filter(a => a.available).map(a => a.display_name);
        return (
          <div
            key={proposal.id}
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '10px',
              padding: '0.875rem 1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '700', color: 'var(--color-text)', fontSize: '0.95rem' }}>
                  {proposal.title}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-primary)', marginTop: '0.15rem' }}>
                  {formatSessionDate(proposal.scheduled_at)}
                </div>
              </div>
              {canManage && (
                <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
                  <button
                    onClick={() => onDelete(proposal)}
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
            {proposal.notes && (
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.4rem', whiteSpace: 'pre-wrap' }}>
                {proposal.notes}
              </div>
            )}

            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.6rem', marginBottom: '0.4rem' }}>
              ✅ {approved} / {proposal.participant_count} available
              {approverNames.length > 0 && ` · ${approverNames.join(', ')}`}
            </div>
            {isConfirmed ? (
              <div style={{ fontSize: '0.78rem', color: 'var(--color-primary)', fontWeight: '700' }}>
                ✓ Confirmed
              </div>
            ) : (
              <AvailabilityControl available={myAvailable} onSet={available => onAvail(proposal.id, available)} />
            )}
          </div>
        );
      })}
    </div>
  );
}
