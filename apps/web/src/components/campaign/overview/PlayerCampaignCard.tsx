'use client';

import { useState } from 'react';
import type { CampaignData } from '@/lib/api/campaigns';
import { setMemberCharacter } from '@/lib/api/campaigns';
import { PartyRoster } from './PartyRoster';

interface Props {
  campaign: CampaignData;
  userId: string;
  /** All of the viewer's characters, for switching which one is enrolled. */
  myCharacters: { id: string; name: string }[];
  onRefresh: () => Promise<void>;
}

/** One campaign the viewer plays in: role banner + roster + rest prompt. */
export function PlayerCampaignCard({ campaign, userId, myCharacters, onRefresh }: Props) {
  const enrolled = campaign.members.find(m => m.account_id === userId)?.characters ?? [];
  // Legacy account-level membership hydrates as every owned character; the
  // selector collapses it to one. Default the picker to a single enrolled char.
  const current = enrolled.length === 1 ? enrolled[0]!.id : '';
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleChange(characterId: string) {
    if (!characterId || characterId === current) return;
    setSaving(true);
    setError('');
    const { error: err } = await setMemberCharacter(campaign.id, characterId);
    if (err) setError(err.message);
    else await onRefresh();
    setSaving(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
        <label style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
          My character:
          <select
            value={current}
            disabled={saving}
            onChange={e => handleChange(e.target.value)}
            style={{
              padding: '0.25rem 0.5rem', borderRadius: '6px',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)', color: 'var(--color-text)',
              fontSize: '0.78rem', minHeight: '36px',
            }}
          >
            {current === '' && <option value="">choose…</option>}
            {myCharacters.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <span style={{
          fontSize: '0.65rem', fontWeight: 700, whiteSpace: 'nowrap',
          backgroundColor: 'var(--color-primary)', color: 'white',
          padding: '0.2rem 0.5rem', borderRadius: '4px',
        }}>
          You are a Player
        </span>
      </div>
      {enrolled.length > 1 && (
        <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--color-danger)' }}>
          Multiple characters are enrolled — pick one above to fix your membership.
        </p>
      )}
      {error && <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--color-danger)' }}>{error}</p>}
      <PartyRoster campaign={campaign} userId={userId} />
    </div>
  );
}
