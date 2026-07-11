'use client';

import { useCallback, useEffect, useState } from 'react';
import { loadNpcs, createNpc, type Npc, type NpcInput } from '@/lib/api/npcs';
import { listMyCampaignNames } from '@/lib/api/campaigns';
import { NpcList } from './NpcList';
import { NpcForm } from './NpcForm';

interface CampaignOption {
  id: string;
  name: string;
}

const EMPTY_INPUT: NpcInput = { name: '', relationship: '', status: 'alive', note: '' };

export function NpcTab({ userId, isDM }: { userId: string; isDM: boolean }) {
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [campaignId, setCampaignId] = useState('');
  const [npcs, setNpcs] = useState<Npc[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [formValue, setFormValue] = useState<NpcInput>(EMPTY_INPUT);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

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
    setFormValue(EMPTY_INPUT);
    setFormError('');
  }

  async function handleSubmit() {
    if (!formValue.name.trim()) { setFormError('Enter a name.'); return; }
    setSaving(true);
    setFormError('');
    const { error } = await createNpc(campaignId, {
      name: formValue.name.trim(),
      relationship: formValue.relationship.trim(),
      status: formValue.status,
      note: formValue.note.trim(),
    });
    setSaving(false);
    if (error) {
      setFormError(error.message);
    } else {
      resetForm();
      await refetch();
    }
  }

  if (campaigns.length === 0 && !loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-text-muted)' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>👥</div>
        <p>Join or create a campaign to track NPCs.</p>
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

      {showForm ? (
        <NpcForm
          mode="create"
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
        <NpcList npcs={npcs} userId={userId} isDM={isDM} />
      )}
    </div>
  );
}
