'use client';

import { useEffect, useState, useCallback } from 'react';
import { loadPlayerCampaigns, joinCampaign } from '@/lib/api/campaigns';
import type { CampaignData } from '@/lib/api/campaigns';
import { JoinCampaignForm } from './JoinCampaignForm';
import { PartyRoster } from './PartyRoster';

export function PlayerView({ userId }: { userId: string }) {
  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteCode, setInviteCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinSuccess, setJoinSuccess] = useState('');

  const loadCampaigns = useCallback(async () => {
    setCampaigns(await loadPlayerCampaigns());
    setLoading(false);
  }, []);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

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
      setJoinError('Invalid invite code. Check with your referee.');
      setJoinLoading(false);
      return;
    }

    setInviteCode('');
    setJoinSuccess('Joined! Welcome to the party.');
    setJoinLoading(false);
    await loadCampaigns();
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {[1, 2].map(i => (
          <div key={i} style={{ height: '80px', borderRadius: '10px', backgroundColor: 'var(--color-surface)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Join campaign form */}
      {campaigns.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏰</div>
          <h2 style={{ fontFamily: 'var(--font-display), Georgia, serif', color: 'var(--color-primary)', margin: '0 0 0.5rem' }}>
            Join a Campaign
          </h2>
          <p style={{ color: 'var(--color-text-muted)', maxWidth: '300px', margin: '0 auto 1.5rem', lineHeight: 1.5 }}>
            Ask your referee for the invite code to join their campaign.
          </p>
        </div>
      )}

      {/* Always show join form for players */}
      <JoinCampaignForm
        inviteCode={inviteCode}
        error={joinError}
        success={joinSuccess}
        loading={joinLoading}
        hasCampaigns={campaigns.length > 0}
        onCodeChange={code => { setInviteCode(code.toUpperCase()); setJoinError(''); setJoinSuccess(''); }}
        onJoin={handleJoin}
      />

      {/* Party rosters */}
      {campaigns.map(campaign => (
        <PartyRoster key={campaign.id} campaign={campaign} userId={userId} />
      ))}
    </div>
  );
}
