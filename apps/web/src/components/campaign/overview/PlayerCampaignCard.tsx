'use client';

import type { CampaignData } from '@/lib/api/campaigns';
import { PartyRoster } from './PartyRoster';

interface Props {
  campaign: CampaignData;
  userId: string;
}

/** One campaign the viewer plays in: role banner + roster + rest prompt. */
export function PlayerCampaignCard({ campaign, userId }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <span style={{
          fontSize: '0.65rem', fontWeight: 700,
          backgroundColor: 'var(--color-primary)', color: 'white',
          padding: '0.2rem 0.5rem', borderRadius: '4px',
        }}>
          You are a Player
        </span>
      </div>
      <PartyRoster campaign={campaign} userId={userId} />
    </div>
  );
}
