'use client';

import { useEffect, useState, useCallback } from 'react';
import { loadSchedule, createSession, updateSession, deleteSession, setRsvp, type RsvpStatus, type Session } from '@/lib/api/schedule';
import { listMyCampaignNames } from '@/lib/api/campaigns';
import { loadRoster, type RosterMember } from '@/lib/api/roster';
import { toDatetimeLocal } from '@/lib/format';
import { sameDay } from '@/lib/calendar';
import { SessionList } from '@/components/campaign/schedule/SessionList';
import { SessionForm, type SessionFormField } from '@/components/campaign/schedule/SessionForm';
import { SessionCalendar } from '@/components/campaign/schedule/SessionCalendar';
import { DeleteSessionModal } from '@/components/campaign/schedule/DeleteSessionModal';
import { ProposalsSection } from '@/components/campaign/schedule/ProposalsSection';

function firstOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

interface CampaignOption {
  id: string;
  name: string;
}

export function ScheduleTab({ userId, isReferee }: { userId: string; isReferee: boolean }) {
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [campaignId, setCampaignId] = useState('');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Session form state (shared by create + edit)
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formWhen, setFormWhen] = useState('');   // datetime-local string
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete-session modal state
  const [deletingSession, setDeletingSession] = useState<Session | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // View state
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [month, setMonth] = useState<Date>(() => firstOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // Load campaigns the user owns or belongs to.
  useEffect(() => {
    async function loadCampaigns() {
      const list: CampaignOption[] = await listMyCampaignNames();
      setCampaigns(list);
      const first = list[0];
      if (first) setCampaignId(first.id);
      else setLoading(false);
    }
    loadCampaigns();
  }, []);

  const refetch = useCallback(async () => {
    if (!campaignId) return;
    setSessions(await loadSchedule(campaignId));
  }, [campaignId]);

  useEffect(() => {
    if (!campaignId) return;
    let active = true;
    setLoading(true);
    (async () => {
      const data = await loadSchedule(campaignId);
      if (active) {
        setSessions(data);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [campaignId]);

  useEffect(() => {
    if (!campaignId) return;
    let active = true;
    (async () => {
      const data = await loadRoster(campaignId);
      if (active) setRoster(data);
    })();
    return () => { active = false; };
  }, [campaignId]);

  function handleFormChange(field: SessionFormField, value: string) {
    if (field === 'title') setFormTitle(value);
    else if (field === 'scheduledAt') setFormWhen(value);
    else setFormNotes(value);
  }

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setFormTitle('');
    setFormWhen('');
    setFormNotes('');
    setFormError('');
  }

  function handleEdit(session: Session) {
    setEditingId(session.id);
    setShowForm(true);
    setFormTitle(session.title);
    setFormWhen(toDatetimeLocal(session.scheduled_at));
    setFormNotes(session.notes);
    setFormError('');
  }

  async function handleSubmit() {
    if (!formTitle.trim()) { setFormError('Enter a title.'); return; }
    if (!formWhen) { setFormError('Pick a date and time.'); return; }

    setSaving(true);
    setFormError('');
    const scheduledAt = new Date(formWhen).toISOString();
    const { error } = editingId
      ? await updateSession(campaignId, editingId, {
          title: formTitle.trim(),
          scheduledAt,
          notes: formNotes.trim(),
        })
      : await createSession({
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

  async function handleRsvp(sessionId: string, status: RsvpStatus) {
    const { error } = await setRsvp(campaignId, sessionId, status);
    if (!error) await refetch();
  }

  async function handleConfirmDelete() {
    if (!deletingSession) return;
    setDeleting(true);
    setDeleteError('');
    const { error } = await deleteSession(campaignId, deletingSession.id);
    setDeleting(false);

    if (error) {
      setDeleteError(error.message);
    } else {
      setDeletingSession(null);
      await refetch();
    }
  }

  if (campaigns.length === 0 && !loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-text-muted)' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📅</div>
        <p>Join or create a campaign to schedule sessions.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {campaigns.length > 1 && (
        <select
          value={campaignId}
          onChange={e => setCampaignId(e.target.value)}
          style={{
            padding: '0.5rem 0.625rem', borderRadius: '8px',
            border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface)', color: 'var(--color-text)',
            fontSize: '0.9rem', minHeight: '40px',
          }}
        >
          {campaigns.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      )}

      {campaignId && (
        <ProposalsSection campaignId={campaignId} userId={userId} isReferee={isReferee} roster={roster} onConfirmed={refetch} />
      )}

      {showForm ? (
        <SessionForm
          title={formTitle}
          scheduledAt={formWhen}
          notes={formNotes}
          error={formError}
          loading={saving}
          mode={editingId ? 'edit' : 'create'}
          onChange={handleFormChange}
          onSubmit={handleSubmit}
          onCancel={resetForm}
        />
      ) : (
        <button
          onClick={() => setShowForm(true)}
          style={{
            padding: '0.625rem', borderRadius: '8px', border: 'none',
            backgroundColor: 'var(--color-primary)', color: 'white',
            fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer', minHeight: '44px',
          }}
        >
          ➕ New session
        </button>
      )}

      {/* List / grid toggle */}
      <div style={{ display: 'flex', gap: '0.375rem' }}>
        {(['list', 'grid'] as const).map(v => {
          const active = view === v;
          return (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                flex: 1, padding: '0.4rem', borderRadius: '8px',
                border: active ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                backgroundColor: active ? 'var(--color-primary)' : 'transparent',
                color: active ? 'white' : 'var(--color-text-muted)',
                fontWeight: active ? '700' : '500',
                fontSize: '0.8rem', cursor: 'pointer', minHeight: '36px',
              }}
            >
              {v === 'list' ? '📋 List' : '📅 Month'}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem 0' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: '70px', borderRadius: '10px', backgroundColor: 'var(--color-surface)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      ) : (
        <>
          {view === 'grid' && (
            <SessionCalendar
              sessions={sessions}
              month={month}
              onPrev={() => { setSelectedDay(null); setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1)); }}
              onNext={() => { setSelectedDay(null); setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1)); }}
              selectedDay={selectedDay}
              onSelectDay={d => setSelectedDay(d)}
            />
          )}
          <SessionList
            sessions={view === 'grid' && selectedDay
              ? sessions.filter(s => sameDay(new Date(s.scheduled_at), selectedDay))
              : sessions}
            userId={userId}
            isReferee={isReferee}
            roster={roster}
            onRsvp={handleRsvp}
            onEdit={handleEdit}
            onDelete={setDeletingSession}
          />
        </>
      )}

      {deletingSession && (
        <DeleteSessionModal
          sessionTitle={deletingSession.title}
          deleting={deleting}
          error={deleteError}
          onCancel={() => { setDeletingSession(null); setDeleteError(''); }}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
}
