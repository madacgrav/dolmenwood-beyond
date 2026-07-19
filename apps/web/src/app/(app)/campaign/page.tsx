'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BankingTab } from '@/components/campaign/BankingTab';
import { OverviewTab } from '@/components/campaign/OverviewTab';
import { ScheduleTab } from '@/components/campaign/ScheduleTab';
import { NpcTab } from '@/components/campaign/npcs/NpcTab';
import { QuestTab } from '@/components/campaign/quests/QuestTab';
import { SegmentedNav } from '@/components/campaign/SegmentedNav';
import { usePageHeader } from '@/components/layout/PageHeaderContext';
import { listMyCampaignNames } from '@/lib/api/campaigns';

type TabId = 'overview' | 'bank' | 'schedule' | 'npcs' | 'quests';

interface CampaignOption { id: string; name: string; is_dm: boolean; }

export default function CampaignPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);

  const refreshCampaigns = useCallback(async () => {
    const list = await listMyCampaignNames();
    setCampaigns(list);
    setSelectedId(prev => (prev && list.some(c => c.id === prev) ? prev : list[0]?.id ?? ''));
  }, []);

  useEffect(() => {
    async function init() {
      const res = await fetch('/api/account');
      if (res.ok) {
        const account: { id: string } = await res.json();
        setUserId(account.id);
      }
      await refreshCampaigns();
      setLoading(false);
    }
    init();
  }, [refreshCampaigns]);

  const selected = campaigns.find(c => c.id === selectedId);
  const isDM = selected?.is_dm ?? false;

  // Bank is per selected campaign now — leave it when switching to a non-DM campaign.
  useEffect(() => {
    if (activeTab === 'bank' && !isDM) setActiveTab('overview');
  }, [activeTab, isDM]);

  const tabs: { id: TabId; label: string; emoji: string; dmOnly?: boolean }[] = [
    { id: 'overview', label: 'Party', emoji: '⚔️' },
    { id: 'schedule', label: 'Schedule', emoji: '📅' },
    { id: 'quests', label: 'Quests', emoji: '📜' },
    { id: 'npcs', label: 'NPCs', emoji: '👥' },
    { id: 'bank', label: 'Bank', emoji: '🏦', dmOnly: true },
  ];

  const visibleTabs = tabs.filter(t => !t.dmOnly || isDM);

  usePageHeader(useMemo(() => ({
    title: 'Campaign',
    action: (
      <Link
        href="/campaign/houses"
        style={{ fontSize: '1.1rem', textDecoration: 'none', minWidth: '40px', minHeight: '40px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
        aria-label="Noble Houses"
      >
        🏰
      </Link>
    ),
  }), []));

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', backgroundColor: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Loading…</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: 'var(--color-bg)', paddingBottom: '5rem' }}>
      {/* Section nav */}
      {visibleTabs.length > 1 && (
        <div style={{
          position: 'sticky', top: 0, zIndex: 10,
          backgroundColor: 'var(--color-bg)',
          padding: '0.75rem 1rem 0.5rem',
        }}>
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <SegmentedNav
              items={visibleTabs}
              active={activeTab}
              onChange={id => setActiveTab(id as TabId)}
            />
          </div>
        </div>
      )}

      <div style={{ padding: '1rem', maxWidth: '600px', margin: '0 auto', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
        {/* Campaign side tabs */}
        {campaigns.length > 0 && (
          <nav aria-label="Campaigns" style={{
            display: 'flex', flexDirection: 'column', gap: '2px',
            flexShrink: 0, width: '96px',
            position: 'sticky', top: '76px',
          }}>
            {campaigns.map(c => {
              const active = c.id === selectedId;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  aria-pressed={active}
                  title={c.name}
                  style={{
                    padding: '0.5rem 0.5rem',
                    border: active ? '1px solid var(--color-border)' : '1px solid transparent',
                    borderRight: active ? '1px solid transparent' : undefined,
                    borderRadius: 'var(--radius-md) 0 0 var(--radius-md)',
                    backgroundColor: active ? 'var(--color-dash-surface)' : 'transparent',
                    color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    fontWeight: active ? 700 : 400,
                    fontSize: '0.72rem', cursor: 'pointer', minHeight: '44px',
                    textAlign: 'left', justifyContent: 'flex-start',
                    overflow: 'hidden', display: 'flex', alignItems: 'center',
                  }}
                >
                  <span style={{
                    overflow: 'hidden', textOverflow: 'ellipsis',
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    lineHeight: 1.25,
                  }}>
                    {c.is_dm ? '👑 ' : ''}{c.name}
                  </span>
                </button>
              );
            })}
          </nav>
        )}

        {/* Tab content, scoped to the selected campaign */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {activeTab === 'overview' && userId && (
            <OverviewTab userId={userId} campaignId={selectedId} onCampaignsChanged={refreshCampaigns} />
          )}

          {activeTab === 'bank' && isDM && (
            <div>
              <div style={{ marginBottom: '1rem' }}>
                <h2 style={{ fontFamily: 'var(--font-display), Georgia, serif', fontSize: '1.1rem', color: 'var(--color-text)', margin: '0 0 0.25rem' }}>
                  Party Bank
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0 }}>
                  View all character deposits and transfer funds back to players.
                </p>
              </div>
              <BankingTab campaignId={selectedId} />
            </div>
          )}

          {activeTab === 'schedule' && userId && (
            <ScheduleTab userId={userId} campaignId={selectedId} isDM={isDM} />
          )}

          {activeTab === 'npcs' && userId && (
            <NpcTab userId={userId} campaignId={selectedId} isDM={isDM} />
          )}

          {activeTab === 'quests' && userId && (
            <QuestTab campaignId={selectedId} />
          )}
        </div>
      </div>
    </div>
  );
}
