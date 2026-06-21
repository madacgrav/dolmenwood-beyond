'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { loadSchedule, type Session } from '@/lib/data/schedule';
import { SessionList } from '@/components/campaign/schedule/SessionList';

interface CampaignOption {
  id: string;
  name: string;
}

export function ScheduleTab({ userId }: { userId: string }) {
  const supabase = createClient();
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [campaignId, setCampaignId] = useState('');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  // Load campaigns the user owns or belongs to (RLS-scoped).
  useEffect(() => {
    async function loadCampaigns() {
      const { data } = await supabase.from('campaigns').select('id, name').order('name');
      const list = (data ?? []) as CampaignOption[];
      setCampaigns(list);
      const first = list[0];
      if (first) setCampaignId(first.id);
      else setLoading(false);
    }
    loadCampaigns();
  }, [supabase]);

  useEffect(() => {
    if (!campaignId) return;
    let active = true;
    setLoading(true);
    (async () => {
      const data = await loadSchedule(supabase, campaignId);
      if (active) {
        setSessions(data);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [supabase, campaignId]);

  if (campaigns.length === 0 && !loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-text-muted)' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📅</div>
        <p>Join or create a campaign to schedule sessions.</p>
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

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem 0' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: '70px', borderRadius: '10px', backgroundColor: 'var(--color-surface)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      ) : (
        <SessionList sessions={sessions} userId={userId} />
      )}
    </div>
  );
}
