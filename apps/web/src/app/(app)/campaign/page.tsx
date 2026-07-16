'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BankingTab } from '@/components/campaign/BankingTab';
import { OverviewTab } from '@/components/campaign/OverviewTab';
import { ScheduleTab } from '@/components/campaign/ScheduleTab';
import { NpcTab } from '@/components/campaign/npcs/NpcTab';
import { loadDMCampaigns } from '@/lib/api/campaigns';

type TabId = 'overview' | 'bank' | 'schedule' | 'npcs';

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

  const tabs: { id: TabId; label: string; dmOnly?: boolean }[] = [
    { id: 'overview', label: '⚔️ Party' },
    { id: 'bank', label: '🏦 Bank', dmOnly: true },
    { id: 'schedule', label: '📅 Schedule' },
    { id: 'npcs', label: '👥 NPCs' },
  ];

  const visibleTabs = tabs.filter(t => !t.dmOnly || hasDMCampaigns);

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', backgroundColor: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Loading…</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: 'var(--color-bg)', paddingBottom: '5rem' }}>
      {/* Header */}
      <div style={{ padding: '1.25rem 1rem 0', maxWidth: '600px', margin: '0 auto' }}>
        <h1 style={{
          fontFamily: 'var(--font-display), Georgia, serif',
          fontSize: '1.5rem', color: 'var(--color-primary)',
          margin: '0 0 0.25rem',
        }}>
          Campaign
        </h1>
        <Link href="/campaign/houses" style={{ display: 'inline-block', fontSize: '0.8rem', color: 'var(--color-primary)', textDecoration: 'none', marginBottom: '0.75rem' }}>
          🏰 Noble Houses →
        </Link>
      </div>

      {/* Tabs */}
      {visibleTabs.length > 1 && (
        <div style={{
          position: 'sticky', top: 0, zIndex: 10,
          backgroundColor: 'var(--color-bg)',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex', maxWidth: '600px', margin: '0 auto',
        }}>
          {visibleTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: '1 0 auto',
                padding: '0.625rem 0.75rem',
                border: 'none',
                backgroundColor: 'transparent',
                color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--color-text-muted)',
                fontWeight: activeTab === tab.id ? '700' : '400',
                fontSize: '0.875rem',
                cursor: 'pointer',
                borderBottom: activeTab === tab.id ? '2px solid var(--color-primary)' : '2px solid transparent',
                minHeight: '44px',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          ))}
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
      </div>
    </div>
  );
}

