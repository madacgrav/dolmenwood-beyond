'use client';

import { useCallback, useEffect, useState } from 'react';
import { loadNpcs, createNpc, updateNpc, deleteNpc, type Npc, type NpcInput } from '@/lib/api/npcs';
import { NpcList } from './NpcList';
import { NpcForm } from './NpcForm';
import { EmptyState } from '@/components/ui/EmptyState';

const EMPTY_INPUT: NpcInput = { name: '', relationship: '', status: 'alive', note: '' };

interface Props {
  userId: string;
  campaignId: string;
  /** DM-ship of the selected campaign (derived by the page-level rail). */
  isDM: boolean;
}

export function NpcTab({ userId, campaignId, isDM }: Props) {
  const [npcs, setNpcs] = useState<Npc[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formValue, setFormValue] = useState<NpcInput>(EMPTY_INPUT);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const refetch = useCallback(async () => {
    if (!campaignId) return;
    setNpcs(await loadNpcs(campaignId));
  }, [campaignId]);

  useEffect(() => {
    if (!campaignId) return;
    let active = true;
    setLoading(true);
    (async () => {
      const data = await loadNpcs(campaignId);
      if (active) {
        setNpcs(data);
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

  function handleEdit(npc: Npc) {
    setEditingId(npc.id);
    setShowForm(true);
    setFormValue({ name: npc.name, relationship: npc.relationship, status: npc.status, note: npc.note });
    setFormError('');
  }

  async function handleDelete(npcId: string) {
    // ponytail: window.confirm for delete; swap for a modal like DeleteSessionModal if UX requires
    if (!window.confirm('Delete this NPC?')) return;
    const { error } = await deleteNpc(campaignId, npcId);
    if (!error) await refetch();
  }

  async function handleSubmit() {
    if (!formValue.name.trim()) { setFormError('Enter a name.'); return; }
    setSaving(true);
    setFormError('');
    const input = {
      name: formValue.name.trim(),
      relationship: formValue.relationship.trim(),
      status: formValue.status,
      note: formValue.note.trim(),
    };
    const { error } = editingId
      ? await updateNpc(campaignId, editingId, input)
      : await createNpc(campaignId, input);
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
      <EmptyState emoji="👥" headline="No NPCs Yet" message="Join or create a campaign to track NPCs." />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {showForm ? (
        <NpcForm
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
          ➕ Add NPC
        </button>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem 0' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: '70px', borderRadius: '10px', backgroundColor: 'var(--color-surface)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      ) : (
        <NpcList npcs={npcs} userId={userId} isDM={isDM} onEdit={handleEdit} onDelete={handleDelete} />
      )}
    </div>
  );
}
