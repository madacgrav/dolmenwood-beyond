'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  loadQuests, createQuest, updateQuest, deleteQuest, type Quest, type QuestInput,
} from '@/lib/api/quests';
import { QuestList } from './QuestList';
import { QuestForm } from './QuestForm';
import { EmptyState } from '@/components/ui/EmptyState';

const EMPTY_INPUT: QuestInput = { title: '', giver: '', status: 'active', note: '' };

export function QuestTab({ campaignId }: { campaignId: string }) {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formValue, setFormValue] = useState<QuestInput>(EMPTY_INPUT);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const refetch = useCallback(async () => {
    if (!campaignId) return;
    setQuests(await loadQuests(campaignId));
  }, [campaignId]);

  useEffect(() => {
    if (!campaignId) return;
    let active = true;
    setLoading(true);
    (async () => {
      const data = await loadQuests(campaignId);
      if (active) {
        setQuests(data);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [campaignId]);

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setFormValue(EMPTY_INPUT);
    setFormError('');
  }

  function handleEdit(quest: Quest) {
    setEditingId(quest.id);
    setShowForm(true);
    setFormValue({ title: quest.title, giver: quest.giver, status: quest.status, note: quest.note });
    setFormError('');
  }

  async function handleToggle(quest: Quest) {
    const next: QuestInput = {
      title: quest.title,
      giver: quest.giver,
      note: quest.note,
      status: quest.status === 'completed' ? 'active' : 'completed',
    };
    const { error } = await updateQuest(campaignId, quest.id, next);
    if (!error) await refetch();
  }

  async function handleDelete(questId: string) {
    // ponytail: window.confirm for delete; swap for a modal like DeleteSessionModal if UX requires
    if (!window.confirm('Delete this quest?')) return;
    const { error } = await deleteQuest(campaignId, questId);
    if (!error) await refetch();
  }

  async function handleSubmit() {
    if (!formValue.title.trim()) { setFormError('Enter a title.'); return; }
    setSaving(true);
    setFormError('');
    const input: QuestInput = {
      title: formValue.title.trim(),
      giver: formValue.giver.trim(),
      status: formValue.status,
      note: formValue.note.trim(),
    };
    const { error } = editingId
      ? await updateQuest(campaignId, editingId, input)
      : await createQuest(campaignId, input);
    setSaving(false);
    if (error) {
      setFormError(error.message);
    } else {
      resetForm();
      await refetch();
    }
  }

  if (!campaignId) {
    return (
      <EmptyState emoji="📜" headline="No Quests Yet" message="Join or create a campaign to track quests." />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {showForm ? (
        <QuestForm
          mode={editingId ? 'edit' : 'create'}
          value={formValue}
          error={formError}
          loading={saving}
          onChange={patch => setFormValue(v => ({ ...v, ...patch }))}
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
          ➕ Add Quest
        </button>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem 0' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: '70px', borderRadius: '10px', backgroundColor: 'var(--color-surface)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      ) : (
        <QuestList quests={quests} onToggle={handleToggle} onEdit={handleEdit} onDelete={handleDelete} />
      )}
    </div>
  );
}
