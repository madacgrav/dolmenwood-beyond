'use client';

import { RefereeView } from './overview/RefereeView';
import { PlayerView } from './overview/PlayerView';

interface Props {
  isReferee: boolean;
  userId: string;
}

export function OverviewTab({ isReferee, userId }: Props) {
  if (isReferee) return <RefereeView userId={userId} />;
  return <PlayerView userId={userId} />;
}
