'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BankingTab } from '@/components/campaign/BankingTab';
import { OverviewTab } from '@/components/campaign/OverviewTab';
import { ScheduleTab } from '@/components/campaign/ScheduleTab';
import { NpcTab } from '@/components/campaign/npcs/NpcTab';
import { QuestTab } from '@/components/campaign/quests/QuestTab';
import { SegmentedNav } from '@/components/campaign/SegmentedNav';
import { usePageHeader } from '@/components/layout/PageHeaderContext';
import { loadDMCampaigns } from '@/lib/api/campaigns';

type TabId = 'overview' | 'bank' | 'schedule' | 'npcs' | 'quests';

export default function CampaignPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [hasDMCampaigns, setHasDMCampaigns] = useState(false);
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const res = await fetch('/api/account');
      if (res.ok) {
        const account: { id: string } = await res.json();
        setUserId(account.id);
      }
      const dm = await loadDMCampaigns();
      setHasDMCampaigns(!!dm && dm.campaigns.length > 0);
      setLoading(false);
    }
    init();
  }, []);

  const tabs: { id: TabId; label: string; emoji: string; dmOnly?: boolean }[] = [
    { id: 'overview', label: 'Party', emoji: '⚔️' },
    { id: 'schedule', label: 'Schedule', emoji: '📅' },
    { id: 'quests', label: 'Quests', emoji: '📜' },
    { id: 'npcs', label: 'NPCs', emoji: '👥' },
    { id: 'bank', label: 'Bank', emoji: '🏦', dmOnly: true },
  ];

  const visibleTabs = tabs.filter(t => !t.dmOnly || hasDMCampaigns);

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

      <div style={{ padding: '1rem', maxWidth: '600px', margin: '0 auto' }}>
        {activeTab === 'overview' && userId && (
          <OverviewTab userId={userId} />
        )}

        {activeTab === 'bank' && hasDMCampaigns && (
          <div>
            <div style={{ marginBottom: '1rem' }}>
              <h2 style={{ fontFamily: 'var(--font-display), Georgia, serif', fontSize: '1.1rem', color: 'var(--color-text)', margin: '0 0 0.25rem' }}>
                Party Bank
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0 }}>
                View all character deposits and transfer funds back to players.
              </p>
            </div>
            <BankingTab />
          </div>
        )}

        {activeTab === 'schedule' && userId && (
          <ScheduleTab userId={userId} />
        )}

        {activeTab === 'npcs' && userId && (
          <NpcTab userId={userId} />
        )}

        {activeTab === 'quests' && userId && (
          <QuestTab />
        )}
      </div>
    </div>
  );
}

