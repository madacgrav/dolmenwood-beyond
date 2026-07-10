'use client';

import { DungeonMasterView } from './overview/DungeonMasterView';
import { PlayerView } from './overview/PlayerView';

interface Props {
  isDM: boolean;
  userId: string;
}

export function OverviewTab({ isDM, userId }: Props) {
  if (isDM) return <DungeonMasterView userId={userId} />;
  return <PlayerView userId={userId} />;
}
