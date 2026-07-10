'use client';

import { useEffect, useState, useCallback } from 'react';
import { loadProposals, createProposal, deleteProposal, setAvailability, type Proposal } from '@/lib/api/proposals';
import type { RosterMember } from '@/lib/api/roster';
import { ProposalForm, type ProposalFormField } from '@/components/campaign/schedule/ProposalForm';
import { ProposalList } from '@/components/campaign/schedule/ProposalList';
import { DeleteSessionModal } from '@/components/campaign/schedule/DeleteSessionModal';

export function ProposalsSection({ campaignId, userId, isReferee, roster, onConfirmed }: {
  campaignId: string; userId: string; isReferee: boolean; roster: RosterMember[]; onConfirmed?: () => void;
}) {
  const [proposals, setProposals] = useState<Proposal[]>([]);

  // Proposal form state (create)
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formWhen, setFormWhen] = useState('');   // datetime-local string
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete-proposal modal state
  const [deletingProposal, setDeletingProposal] = useState<Proposal | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const refetch = useCallback(async () => {
    if (!campaignId) return;
    setProposals(await loadProposals(campaignId));
  }, [campaignId]);

  useEffect(() => {
    if (!campaignId) return;
    let active = true;
    (async () => {
      const data = await loadProposals(campaignId);
      if (active) setProposals(data);
    })();
    return () => { active = false; };
  }, [campaignId]);

  function handleFormChange(field: ProposalFormField, value: string) {
    if (field === 'title') setFormTitle(value);
    else if (field === 'scheduledAt') setFormWhen(value);
    else setFormNotes(value);
  }

  function resetForm() {
    setShowForm(false);
    setFormTitle('');
    setFormWhen('');
    setFormNotes('');
    setFormError('');
  }

  async function handleSubmit() {
    if (!formTitle.trim()) { setFormError('Enter a title.'); return; }
    if (!formWhen) { setFormError('Pick a date and time.'); return; }

    setSaving(true);
    setFormError('');
    const scheduledAt = new Date(formWhen).toISOString();
    const { error } = await createProposal({
      campaignId,
      title: formTitle.trim(),
      scheduledAt,
      notes: formNotes.trim(),
    });
    setSaving(false);

    if (error) {
      setFormError(error.message);
    } else {
      resetForm();
      await refetch();
    }
  }

  async function handleAvailability(proposalId: string, available: boolean) {
    const { error } = await setAvailability(campaignId, proposalId, available);
    if (!error) {
      await refetch();
      // A full approval may have created a session; refresh the parent's sessions.
      onConfirmed?.();
    }
  }

  async function handleConfirmDelete() {
    if (!deletingProposal) return;
    setDeleting(true);
    setDeleteError('');
    const { error } = await deleteProposal(campaignId, deletingProposal.id);
    setDeleting(false);

    if (error) {
      setDeleteError(error.message);
    } else {
      setDeletingProposal(null);
      await refetch();
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ fontFamily: 'var(--font-display), Georgia, serif', fontSize: '1.05rem', color: 'var(--color-text)', fontWeight: '700' }}>
        Proposed Dates
      </div>

      {showForm ? (
        <ProposalForm
          title={formTitle}
          scheduledAt={formWhen}
          notes={formNotes}
          error={formError}
          loading={saving}
          mode="create"
          onChange={handleFormChange}
          onSubmit={handleSubmit}
          onCancel={resetForm}
        />
      ) : (
        <button
          onClick={() => setShowForm(true)}
          style={{
            padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--color-primary)',
            backgroundColor: 'transparent', color: 'var(--color-primary)',
            fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer', minHeight: '44px',
          }}
        >
          🗓️ Propose a date
        </button>
      )}

      <ProposalList
        proposals={proposals}
        userId={userId}
        isReferee={isReferee}
        roster={roster}
        onDelete={setDeletingProposal}
        onAvail={handleAvailability}
      />

      {deletingProposal && (
        <DeleteSessionModal
          sessionTitle={deletingProposal.title}
          deleting={deleting}
          error={deleteError}
          onCancel={() => { setDeletingProposal(null); setDeleteError(''); }}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
}
