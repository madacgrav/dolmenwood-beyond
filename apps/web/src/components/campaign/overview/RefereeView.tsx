'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { applyXPModifiers } from '@dolmenwood/rules-engine';
import {
  loadRefereeCampaigns,
  createCampaign,
  awardXP,
  insertPackAnimal,
  removePackAnimal,
} from '@/lib/data/campaigns';
import type { CampaignData, PackAnimal, PackAnimalType } from '@/lib/data/campaigns';
import { defaultXPAward } from './types';
import type { NewPackAnimalForm, XPAwardState } from './types';
import { CampaignCreateForm } from './CampaignCreateForm';
import { InviteCodePanel } from './InviteCodePanel';
import { MemberList } from './MemberList';
import { XPAwardPanel } from './XPAwardPanel';
import { PackAnimalsSection } from './PackAnimalsSection';

export function RefereeView({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [xpAwards, setXpAwards] = useState<Record<string, XPAwardState>>({});
  const [packAnimals, setPackAnimals] = useState<Record<string, PackAnimal[]>>({});
  const [showAddAnimal, setShowAddAnimal] = useState<Record<string, boolean>>({});
  const [newAnimal, setNewAnimal] = useState<Record<string, NewPackAnimalForm>>({});

  function xpAward(id: string): XPAwardState {
    return xpAwards[id] ?? defaultXPAward();
  }
  function patchXP(id: string, patch: Partial<XPAwardState>) {
    setXpAwards(prev => ({ ...prev, [id]: { ...(prev[id] ?? defaultXPAward()), ...patch } }));
  }

  const loadCampaigns = useCallback(async () => {
    const result = await loadRefereeCampaigns(supabase, userId);
    if (!result) {
      setCampaigns([]);
      setLoading(false);
      return;
    }
    setPackAnimals(result.packAnimals);
    setCampaigns(result.campaigns);
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

  async function handleCreate() {
    const trimmed = newName.trim();
    if (!trimmed) { setCreateError('Campaign name is required.'); return; }
    setCreateLoading(true);
    setCreateError('');

    const { error } = await createCampaign(supabase, trimmed);

    if (error) {
      setCreateError(error.message);
      setCreateLoading(false);
      return;
    }

    setNewName('');
    setCreating(false);
    setCreateLoading(false);
    await loadCampaigns();
  }

  async function copyInviteCode(code: string, campaignId: string) {
    await navigator.clipboard.writeText(code);
    setCopiedId(campaignId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function toggleMembers(id: string) {
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, showMembers: !c.showMembers } : c));
  }

  async function handleAwardXP(campaign: CampaignData) {
    // Belt-and-suspenders: only the referee who owns this campaign may award XP.
    // The DB also enforces this via RLS + referee_id scoping in loadCampaigns.
    if (!campaigns.some(c => c.id === campaign.id)) {
      patchXP(campaign.id, { error: 'Unauthorized: you do not own this campaign.' });
      return;
    }

    const state = xpAward(campaign.id);
    const base = parseInt(state.baseXP.trim(), 10);
    if (Number.isNaN(base) || base <= 0) { patchXP(campaign.id, { error: 'Enter a positive XP amount.' }); return; }

    const allChars = campaign.members.flatMap(m => m.characters);
    if (allChars.length === 0) { patchXP(campaign.id, { error: 'No characters to award XP to.' }); return; }

    patchXP(campaign.id, { awarding: true, error: '' });

    const updates = await Promise.all(
      allChars.map(ch => {
        const gain = state.applyModifier
          ? applyXPModifiers(base, ch.character_class, ch.ability_scores, ch.kindred)
          : base;
        return awardXP(supabase, ch.id, gain);
      })
    );

    const failed = updates.filter(r => r.error);
    if (failed.length > 0) {
      await loadCampaigns();
      patchXP(campaign.id, {
        awarding: false,
        error: `${failed.length}/${updates.length} award(s) failed: ${failed[0]!.error!.message}`,
      });
      return;
    }

    patchXP(campaign.id, { awarding: false, lastAwardAt: base, baseXP: '' });
    await loadCampaigns();
  }

  function getAnimal(campaignId: string) {
    return newAnimal[campaignId] ?? { name: '', mount_type: 'Mule' as PackAnimalType, speed: 30 };
  }
  function patchAnimal(campaignId: string, patch: Partial<NewPackAnimalForm>) {
    setNewAnimal(prev => ({ ...prev, [campaignId]: { ...getAnimal(campaignId), ...patch } }));
  }

  async function addPackAnimal(campaignId: string) {
    const animal = getAnimal(campaignId);
    if (!animal.name.trim()) return;
    const data = await insertPackAnimal(supabase, {
      ownerId: userId,
      campaignId,
      name: animal.name.trim(),
      mountType: animal.mount_type,
      speed: animal.speed,
    });
    if (data) {
      setPackAnimals(prev => ({ ...prev, [campaignId]: [...(prev[campaignId] ?? []), data] }));
      setShowAddAnimal(prev => ({ ...prev, [campaignId]: false }));
      patchAnimal(campaignId, { name: '', mount_type: 'Mule', speed: 30 });
    }
  }

  async function deletePackAnimal(campaignId: string, animalId: string) {
    if (!confirm('Remove this pack animal?')) return;
    setPackAnimals(prev => ({ ...prev, [campaignId]: (prev[campaignId] ?? []).filter(a => a.id !== animalId) }));
    await removePackAnimal(supabase, animalId);
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {[1, 2].map(i => (
          <div key={i} style={{ height: '100px', borderRadius: '10px', backgroundColor: 'var(--color-surface)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {campaigns.length === 0 && !creating && (
        <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏰</div>
          <h2 style={{ fontFamily: 'var(--font-display), Georgia, serif', color: 'var(--color-primary)', margin: '0 0 0.5rem' }}>
            No Campaigns Yet
          </h2>
          <p style={{ color: 'var(--color-text-muted)', maxWidth: '300px', margin: '0 auto 1.5rem', lineHeight: 1.5 }}>
            Create a campaign to get an invite code you can share with your players.
          </p>
          <button
            onClick={() => setCreating(true)}
            style={{
              padding: '0.75rem 1.5rem', borderRadius: '8px', border: 'none',
              backgroundColor: 'var(--color-primary)', color: 'white',
              fontWeight: '600', fontSize: '0.95rem', cursor: 'pointer', minHeight: '44px',
            }}
          >
            Create Campaign
          </button>
        </div>
      )}

      {/* Create form */}
      {creating && (
        <CampaignCreateForm
          name={newName}
          error={createError}
          loading={createLoading}
          onNameChange={setNewName}
          onCreate={handleCreate}
          onCancel={() => { setCreating(false); setNewName(''); setCreateError(''); }}
        />
      )}

      {/* Campaign cards */}
      {campaigns.map(campaign => (
        <div
          key={campaign.id}
          style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden' }}
        >
          {/* Header */}
          <div style={{ padding: '0.875rem 1rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-display), Georgia, serif', fontWeight: '700', color: 'var(--color-text)', fontSize: '1rem' }}>
                  {campaign.name}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.125rem' }}>
                  Created {new Date(campaign.created_at).toLocaleDateString()} · {campaign.members.length} member{campaign.members.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>

            {/* Invite code */}
            <InviteCodePanel
              inviteCode={campaign.invite_code}
              copied={copiedId === campaign.id}
              onCopy={() => copyInviteCode(campaign.invite_code, campaign.id)}
            />
          </div>

          {/* Members toggle */}
          <MemberList
            campaign={campaign}
            award={xpAward(campaign.id)}
            onToggle={() => toggleMembers(campaign.id)}
          />

          {/* Award XP */}
          <XPAwardPanel
            campaign={campaign}
            award={xpAward(campaign.id)}
            onPatch={patch => patchXP(campaign.id, patch)}
            onAward={() => handleAwardXP(campaign)}
          />

          {/* Pack Animals section */}
          <PackAnimalsSection
            animals={packAnimals[campaign.id] ?? []}
            showAdd={showAddAnimal[campaign.id] ?? false}
            newAnimal={getAnimal(campaign.id)}
            onToggleAdd={() => setShowAddAnimal(prev => ({ ...prev, [campaign.id]: !prev[campaign.id] }))}
            onPatchAnimal={patch => patchAnimal(campaign.id, patch)}
            onAdd={() => addPackAnimal(campaign.id)}
            onDelete={animalId => deletePackAnimal(campaign.id, animalId)}
          />
        </div>
      ))}

      {/* New campaign button (when campaigns exist) */}
      {campaigns.length > 0 && !creating && (
        <button
          onClick={() => setCreating(true)}
          style={{
            padding: '0.625rem', borderRadius: '8px',
            border: '1px dashed var(--color-border)',
            backgroundColor: 'transparent', color: 'var(--color-text-muted)',
            fontSize: '0.875rem', cursor: 'pointer', minHeight: '44px',
          }}
        >
          ＋ New Campaign
        </button>
      )}
    </div>
  );
}
