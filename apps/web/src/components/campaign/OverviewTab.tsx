'use client';

import { DungeonMasterView } from './overview/DungeonMasterView';
import { PlayerView } from './overview/PlayerView';

export function OverviewTab({ userId }: { userId: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <DungeonMasterView userId={userId} />
      <PlayerView userId={userId} />
    </div>
  );
}
