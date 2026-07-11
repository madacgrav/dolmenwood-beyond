import type { XPLogEntry } from '@dolmenwood/types';

export interface XPLogView {
  characterName: string;
  entries: (XPLogEntry & { actorName: string })[];
}

export async function fetchXPLog(characterId: string): Promise<XPLogView | null> {
  const res = await fetch(`/api/characters/${characterId}/xp-log`);
  if (!res.ok) return null;
  return res.json();
}
