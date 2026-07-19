'use client';

import { useCallback, useEffect, useState } from 'react';
import { loadDMCampaigns, loadPlayerCampaigns, createCampaign, joinCampaign } from '@/lib/api/campaigns';
import type { CampaignData, PackAnimal } from '@/lib/api/campaigns';
import { DMCampaignCard } from './overview/DMCampaignCard';
import { PlayerCampaignCard } from './overview/PlayerCampaignCard';
import { CampaignCreateForm } from './overview/CampaignCreateForm';
import { JoinCampaignForm } from './overview/JoinCampaignForm';
import { EmptyState } from '@/components/ui/EmptyState';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';

/**
 * Party tab — one role-aware card per campaign: the viewer's DM'd campaigns get
 * the DM card, campaigns they only play in get the player card. Join/create
 * flows collapse behind a heading (or the empty state when there's nothing).
 */
export function OverviewTab({ userId }: { userId: string }) {
  const [dmCampaigns, setDmCampaigns] = useState<CampaignData[]>([]);
  const [packAnimals, setPackAnimals] = useState<Record<string, PackAnimal[]>>({});
  const [playerCampaigns, setPlayerCampaigns] = useState<CampaignData[]>([]);
  const [loading, setLoading] = useState(true);

  // Create form state
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  // Join form state
  const [showJoin, setShowJoin] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinSuccess, setJoinSuccess] = useState('');

  const load = useCallback(async () => {
    const [dm, player] = await Promise.all([loadDMCampaigns(), loadPlayerCampaigns()]);
    setDmCampaigns(dm?.campaigns ?? []);
    setPackAnimals(dm?.packAnimals ?? {});
    setPlayerCampaigns(player);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    const trimmed = newName.trim();
    if (!trimmed) { setCreateError('Campaign name is required.'); return; }
    setCreateLoading(true);
    setCreateError('');
    const { error } = await createCampaign(trimmed);
    if (error) {
      setCreateError(error.message);
      setCreateLoading(false);
      return;
    }
    setNewName('');
    setCreating(false);
    setCreateLoading(false);
    await load();
  }

  async function handleJoin() {
    const code = inviteCode.trim().toUpperCase();
    if (!code) { setJoinError('Enter an invite code.'); return; }
    setJoinLoading(true);
    setJoinError('');
    setJoinSuccess('');
    const { data, error } = await joinCampaign(code);
    if (error) {
      setJoinError(error.message);
      setJoinLoading(false);
      return;
    }
    if (!data) {
      setJoinError('Invalid invite code. Check with your Dungeon Master.');
      setJoinLoading(false);
      return;
    }
    setInviteCode('');
    setJoinSuccess('Joined! Welcome to the party.');
    setJoinLoading(false);
    await load();
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

  const dmIds = new Set(dmCampaigns.map(c => c.id));
  const playerOnly = playerCampaigns.filter(c => !dmIds.has(c.id));
  const hasAny = dmCampaigns.length > 0 || playerOnly.length > 0;

  const joinForm = (
    <JoinCampaignForm
      inviteCode={inviteCode}
      error={joinError}
      success={joinSuccess}
      loading={joinLoading}
      hasCampaigns={hasAny}
      onCodeChange={code => { setInviteCode(code.toUpperCase()); setJoinError(''); setJoinSuccess(''); }}
      onJoin={handleJoin}
    />
  );

  const createForm = creating ? (
    <CampaignCreateForm
      name={newName}
      error={createError}
      loading={createLoading}
      onNameChange={setNewName}
      onCreate={handleCreate}
      onCancel={() => { setCreating(false); setNewName(''); setCreateError(''); }}
    />
  ) : (
    <button
      onClick={() => setCreating(true)}
      style={{
        padding: '0.625rem', borderRadius: '8px',
        border: '1px dashed var(--color-border)',
        backgroundColor: 'transparent', color: 'var(--color-text-muted)',
        fontSize: '0.875rem', cursor: 'pointer', minHeight: '44px', width: '100%',
      }}
    >
      ＋ New Campaign
    </button>
  );

  if (!hasAny) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <EmptyState
          emoji="🏰"
          headline="No Campaigns Yet"
          message="Create a campaign to run as DM, or join one with an invite code from your Dungeon Master."
          cta={{ label: 'Create Campaign', onClick: () => setCreating(true) }}
          escapeHatch={
            showJoin ? joinForm : (
              <button
                onClick={() => setShowJoin(true)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--color-primary)', fontSize: '0.85rem',
                  textDecoration: 'underline', minHeight: '44px',
                }}
              >
                I have an invite code
              </button>
            )
          }
        />
        {creating && createForm}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {dmCampaigns.map(campaign => (
        <DMCampaignCard
          key={campaign.id}
          campaign={campaign}
          packAnimals={packAnimals[campaign.id] ?? []}
          onRefresh={load}
        />
      ))}

      {playerOnly.map(campaign => (
        <PlayerCampaignCard key={campaign.id} campaign={campaign} userId={userId} />
      ))}

      <CollapsibleSection title="Join or Create a Campaign">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {joinForm}
          {createForm}
        </div>
      </CollapsibleSection>
    </div>
  );
}
