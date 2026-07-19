'use client';

import { useCallback, useEffect, useState } from 'react';
import { loadDMCampaigns, loadPlayerCampaigns, createCampaign, joinCampaign } from '@/lib/api/campaigns';
import type { CampaignData, PackAnimal } from '@/lib/api/campaigns';
import { listCharacters } from '@/lib/api/characters';
import { DMCampaignCard } from './overview/DMCampaignCard';
import { PlayerCampaignCard } from './overview/PlayerCampaignCard';
import { CampaignCreateForm } from './overview/CampaignCreateForm';
import { JoinCampaignForm } from './overview/JoinCampaignForm';
import { EmptyState } from '@/components/ui/EmptyState';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';

interface Props {
  userId: string;
  /** Campaign selected in the page-level rail; empty = no campaigns yet. */
  campaignId: string;
  /** Notify the page when join/create changes the campaign list. */
  onCampaignsChanged: () => void;
}

/**
 * Party tab for ONE campaign: the DM card if the viewer runs it, otherwise the
 * player card. Join/create flows collapse behind a heading (or the empty state).
 */
export function OverviewTab({ userId, campaignId, onCampaignsChanged }: Props) {
  const [dmCampaigns, setDmCampaigns] = useState<CampaignData[]>([]);
  const [packAnimals, setPackAnimals] = useState<Record<string, PackAnimal[]>>({});
  const [playerCampaigns, setPlayerCampaigns] = useState<CampaignData[]>([]);
  const [myCharacters, setMyCharacters] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Create form state
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  // Join form state
  const [showJoin, setShowJoin] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joinCharacterId, setJoinCharacterId] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinSuccess, setJoinSuccess] = useState('');

  const load = useCallback(async () => {
    const [dm, player, chars] = await Promise.all([
      loadDMCampaigns(),
      loadPlayerCampaigns(),
      listCharacters(),
    ]);
    setDmCampaigns(dm?.campaigns ?? []);
    setPackAnimals(dm?.packAnimals ?? {});
    setPlayerCampaigns(player);
    setMyCharacters(chars.characters.map(c => ({ id: c.id, name: c.name })));
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
    onCampaignsChanged();
  }

  async function handleJoin() {
    const code = inviteCode.trim().toUpperCase();
    if (!code) { setJoinError('Enter an invite code.'); return; }
    if (!joinCharacterId) { setJoinError('Pick which character is joining.'); return; }
    setJoinLoading(true);
    setJoinError('');
    setJoinSuccess('');
    const { data, error } = await joinCampaign(code, joinCharacterId);
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
    onCampaignsChanged();
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

  const dmCampaign = dmCampaigns.find(c => c.id === campaignId);
  const playerCampaign = playerCampaigns.find(c => c.id === campaignId);
  const hasAny = dmCampaigns.length > 0 || playerCampaigns.length > 0;

  const joinForm = (
    <JoinCampaignForm
      inviteCode={inviteCode}
      error={joinError}
      success={joinSuccess}
      loading={joinLoading}
      hasCampaigns={hasAny}
      onCodeChange={code => { setInviteCode(code.toUpperCase()); setJoinError(''); setJoinSuccess(''); }}
      onJoin={handleJoin}
      characters={myCharacters}
      characterId={joinCharacterId}
      onCharacterChange={setJoinCharacterId}
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
      {dmCampaign && (
        <DMCampaignCard
          campaign={dmCampaign}
          packAnimals={packAnimals[dmCampaign.id] ?? []}
          onRefresh={load}
        />
      )}

      {!dmCampaign && playerCampaign && (
        <PlayerCampaignCard
          campaign={playerCampaign}
          userId={userId}
          myCharacters={myCharacters}
          onRefresh={load}
        />
      )}

      <CollapsibleSection title="Join or Create a Campaign">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {joinForm}
          {createForm}
        </div>
      </CollapsibleSection>
    </div>
  );
}
