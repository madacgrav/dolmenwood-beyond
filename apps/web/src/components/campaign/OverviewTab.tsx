'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Props {
  isReferee: boolean;
  userId: string;
}

interface MemberCharacter {
  id: string;
  name: string;
  character_class: string;
  level: number;
}

interface Member {
  account_id: string;
  display_name: string;
  joined_at: string;
  characters: MemberCharacter[];
}

interface CampaignData {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
  members: Member[];
  showMembers: boolean;
}

// ─── Referee View ─────────────────────────────────────────────────────────────

function RefereView({ userId }: { userId: string }) {
  const supabase = createClient();
  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadCampaigns = useCallback(async () => {
    const { data: rawCampaigns } = await supabase
      .from('campaigns')
      .select('id, name, invite_code, created_at')
      .eq('referee_id', userId)
      .order('created_at', { ascending: false });

    if (!rawCampaigns || rawCampaigns.length === 0) {
      setCampaigns([]);
      setLoading(false);
      return;
    }

    const campaignIds = rawCampaigns.map((c: { id: string }) => c.id);

    const [{ data: rawMembers }, { data: rawChars }] = await Promise.all([
      supabase
        .from('campaign_members')
        .select('campaign_id, account_id, joined_at, accounts(display_name)')
        .in('campaign_id', campaignIds),
      supabase
        .from('characters')
        .select('id, name, character_class, level, owner_id')
        .order('name'),
    ]);

    const members = (rawMembers ?? []) as unknown as Array<{
      campaign_id: string;
      account_id: string;
      joined_at: string;
      accounts: { display_name: string } | null;
    }>;
    const chars = (rawChars ?? []) as Array<MemberCharacter & { owner_id: string }>;

    setCampaigns(
      rawCampaigns.map((c: { id: string; name: string; invite_code: string; created_at: string }) => {
        const campaignMembers = members
          .filter(m => m.campaign_id === c.id)
          .map(m => ({
            account_id: m.account_id,
            display_name: m.accounts?.display_name ?? 'Unknown',
            joined_at: m.joined_at,
            characters: chars.filter(ch => ch.owner_id === m.account_id),
          }));
        return {
          ...c,
          members: campaignMembers,
          showMembers: true,
        };
      })
    );
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

  async function handleCreate() {
    const trimmed = newName.trim();
    if (!trimmed) { setCreateError('Campaign name is required.'); return; }
    setCreateLoading(true);
    setCreateError('');

    const { error } = await supabase.rpc('create_campaign', { p_name: trimmed });

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
        <div style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '10px',
          padding: '1rem',
        }}>
          <h3 style={{ fontFamily: 'var(--font-display), Georgia, serif', color: 'var(--color-text)', margin: '0 0 0.875rem', fontSize: '1rem' }}>
            New Campaign
          </h3>
          <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>
            Campaign Name
          </label>
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="e.g. The Dolmenwood Delve"
            autoFocus
            style={{
              width: '100%', padding: '0.5rem 0.625rem', borderRadius: '6px',
              border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)',
              color: 'var(--color-text)', fontSize: '0.95rem', minHeight: '44px',
              boxSizing: 'border-box', marginBottom: '0.75rem',
            }}
          />
          {createError && (
            <div style={{ fontSize: '0.78rem', color: 'var(--color-danger)', marginBottom: '0.625rem' }}>
              {createError}
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleCreate}
              disabled={createLoading}
              style={{
                flex: 1, padding: '0.625rem', borderRadius: '8px', border: 'none',
                backgroundColor: 'var(--color-primary)', color: 'white',
                fontWeight: '600', fontSize: '0.875rem', cursor: createLoading ? 'not-allowed' : 'pointer',
                opacity: createLoading ? 0.6 : 1, minHeight: '44px',
              }}
            >
              {createLoading ? 'Creating…' : 'Create'}
            </button>
            <button
              onClick={() => { setCreating(false); setNewName(''); setCreateError(''); }}
              style={{
                padding: '0.625rem 1rem', borderRadius: '8px',
                border: '1px solid var(--color-border)', backgroundColor: 'transparent',
                color: 'var(--color-text-muted)', fontSize: '0.875rem', cursor: 'pointer', minHeight: '44px',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
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
            <div style={{
              marginTop: '0.75rem',
              padding: '0.625rem 0.75rem',
              backgroundColor: 'var(--color-bg)',
              borderRadius: '8px',
              border: '1px solid var(--color-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem',
            }}>
              <div>
                <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.125rem' }}>
                  Invite Code
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '1.25rem', fontWeight: '700', color: 'var(--color-gold)', letterSpacing: '0.1em' }}>
                  {campaign.invite_code}
                </div>
              </div>
              <button
                onClick={() => copyInviteCode(campaign.invite_code, campaign.id)}
                style={{
                  padding: '0.5rem 0.875rem', borderRadius: '6px',
                  border: '1px solid var(--color-border)',
                  backgroundColor: copiedId === campaign.id ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'transparent',
                  color: copiedId === campaign.id ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  fontSize: '0.8rem', cursor: 'pointer', minHeight: '40px',
                  transition: 'all 0.15s ease',
                }}
              >
                {copiedId === campaign.id ? '✓ Copied!' : '📋 Copy'}
              </button>
            </div>
          </div>

          {/* Members toggle */}
          <div style={{ borderTop: '1px solid var(--color-border)' }}>
            <button
              onClick={() => toggleMembers(campaign.id)}
              style={{
                width: '100%', padding: '0.625rem 1rem',
                backgroundColor: 'var(--color-bg)', border: 'none',
                color: 'var(--color-text-muted)', fontSize: '0.8rem',
                cursor: 'pointer', textAlign: 'left', minHeight: '40px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}
            >
              <span>⚔️ Party ({campaign.members.length})</span>
              <span>{campaign.showMembers ? '▲' : '▼'}</span>
            </button>

            {campaign.showMembers && (
              <div>
                {campaign.members.length === 0 ? (
                  <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                    No players yet. Share the invite code above.
                  </div>
                ) : (
                  campaign.members.map(member => (
                    <div
                      key={member.account_id}
                      style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--color-border)' }}
                    >
                      <div style={{ fontWeight: '600', color: 'var(--color-text)', fontSize: '0.875rem', marginBottom: '0.375rem' }}>
                        {member.display_name}
                      </div>
                      {member.characters.length === 0 ? (
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>No characters yet</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          {member.characters.map(ch => (
                            <div key={ch.id} style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                              <span style={{ color: 'var(--color-text)' }}>{ch.name}</span>
                              {' · '}{ch.character_class} · Lv {ch.level}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
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

// ─── Player View ──────────────────────────────────────────────────────────────

function PlayerView({ userId }: { userId: string }) {
  const supabase = createClient();
  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteCode, setInviteCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinSuccess, setJoinSuccess] = useState('');

  const loadCampaigns = useCallback(async () => {
    // Get campaigns the player belongs to
    const { data: memberships } = await supabase
      .from('campaign_members')
      .select('campaign_id, joined_at')
      .eq('account_id', userId);

    if (!memberships || memberships.length === 0) {
      setCampaigns([]);
      setLoading(false);
      return;
    }

    const campaignIds = memberships.map((m: { campaign_id: string }) => m.campaign_id);

    const [{ data: rawCampaigns }, { data: rawMembers }, { data: rawChars }] = await Promise.all([
      supabase.from('campaigns').select('id, name, invite_code, created_at').in('id', campaignIds),
      supabase
        .from('campaign_members')
        .select('campaign_id, account_id, joined_at, accounts(display_name)')
        .in('campaign_id', campaignIds),
      supabase.from('characters').select('id, name, character_class, level, owner_id').order('name'),
    ]);

    const members = (rawMembers ?? []) as unknown as Array<{
      campaign_id: string;
      account_id: string;
      joined_at: string;
      accounts: { display_name: string } | null;
    }>;
    const chars = (rawChars ?? []) as Array<MemberCharacter & { owner_id: string }>;

    setCampaigns(
      (rawCampaigns ?? []).map((c: { id: string; name: string; invite_code: string; created_at: string }) => {
        const campaignMembers = members
          .filter(m => m.campaign_id === c.id)
          .map(m => ({
            account_id: m.account_id,
            display_name: m.accounts?.display_name ?? 'Unknown',
            joined_at: m.joined_at,
            characters: chars.filter(ch => ch.owner_id === m.account_id),
          }));
        return { ...c, members: campaignMembers, showMembers: true };
      })
    );
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

  async function handleJoin() {
    const code = inviteCode.trim().toUpperCase();
    if (!code) { setJoinError('Enter an invite code.'); return; }

    setJoinLoading(true);
    setJoinError('');
    setJoinSuccess('');

    const { data, error } = await supabase.rpc('join_campaign', { p_invite_code: code });

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
      <div style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: '10px',
        padding: '1rem',
      }}>
        <h3 style={{ fontFamily: 'var(--font-display), Georgia, serif', fontSize: '0.95rem', color: 'var(--color-text)', margin: '0 0 0.75rem' }}>
          {campaigns.length > 0 ? '＋ Join Another Campaign' : 'Enter Invite Code'}
        </h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            value={inviteCode}
            onChange={e => { setInviteCode(e.target.value.toUpperCase()); setJoinError(''); setJoinSuccess(''); }}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            placeholder="XXXXXX"
            maxLength={6}
            style={{
              flex: 1, padding: '0.5rem 0.625rem', borderRadius: '6px',
              border: `1px solid ${joinError ? 'var(--color-danger)' : 'var(--color-border)'}`,
              backgroundColor: 'var(--color-bg)', color: 'var(--color-text)',
              fontSize: '1rem', fontFamily: 'monospace', letterSpacing: '0.1em',
              textTransform: 'uppercase', minHeight: '44px',
            }}
          />
          <button
            onClick={handleJoin}
            disabled={joinLoading}
            style={{
              padding: '0.5rem 1rem', borderRadius: '8px', border: 'none',
              backgroundColor: 'var(--color-primary)', color: 'white',
              fontWeight: '600', fontSize: '0.875rem',
              cursor: joinLoading ? 'not-allowed' : 'pointer',
              opacity: joinLoading ? 0.6 : 1, minHeight: '44px', whiteSpace: 'nowrap',
            }}
          >
            {joinLoading ? 'Joining…' : 'Join'}
          </button>
        </div>
        {joinError && (
          <div style={{ fontSize: '0.78rem', color: 'var(--color-danger)', marginTop: '0.5rem' }}>{joinError}</div>
        )}
        {joinSuccess && (
          <div style={{ fontSize: '0.78rem', color: 'var(--color-primary)', marginTop: '0.5rem' }}>✓ {joinSuccess}</div>
        )}
      </div>

      {/* Party rosters */}
      {campaigns.map(campaign => (
        <div
          key={campaign.id}
          style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden' }}
        >
          <div style={{ padding: '0.875rem 1rem', borderBottom: '1px solid var(--color-border)' }}>
            <div style={{ fontFamily: 'var(--font-display), Georgia, serif', fontWeight: '700', fontSize: '1rem', color: 'var(--color-text)' }}>
              {campaign.name}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.125rem' }}>
              {campaign.members.length} adventurer{campaign.members.length !== 1 ? 's' : ''}
            </div>
          </div>

          {campaign.members.map(member => (
            <div
              key={member.account_id}
              style={{
                padding: '0.75rem 1rem',
                borderBottom: '1px solid var(--color-border)',
                backgroundColor: member.account_id === userId ? 'color-mix(in srgb, var(--color-primary) 5%, transparent)' : 'transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                <span style={{ fontWeight: '600', color: 'var(--color-text)', fontSize: '0.875rem' }}>
                  {member.display_name}
                </span>
                {member.account_id === userId && (
                  <span style={{ fontSize: '0.65rem', backgroundColor: 'var(--color-primary)', color: 'white', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                    You
                  </span>
                )}
              </div>
              {member.characters.length === 0 ? (
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>No characters yet</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {member.characters.map(ch => (
                    <div key={ch.id} style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                      <span style={{ color: 'var(--color-text)' }}>{ch.name}</span>
                      {' · '}{ch.character_class} · Lv {ch.level}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function OverviewTab({ isReferee, userId }: Props) {
  if (isReferee) return <RefereView userId={userId} />;
  return <PlayerView userId={userId} />;
}
