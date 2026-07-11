import type { XPLogEntry } from '@dolmenwood/types';
import { requireAccountId } from '@/lib/auth/session';
import { canReadCharacter, fetchCharacterDocById, forbidden, notFound } from '@/lib/authz';
import { displayNamesFor } from './campaigns';

export interface XPLogView {
  characterName: string;
  entries: (XPLogEntry & { actorName: string })[];
}

/** Owner or DM-of-owner. Entries newest-first, actor ids resolved to names. */
export async function fetchXPLog(characterId: string): Promise<XPLogView> {
  const me = await requireAccountId();
  const doc = await fetchCharacterDocById(characterId);
  if (!doc) throw notFound('character');
  if (!(await canReadCharacter(me, doc))) throw forbidden();
  const entries = [...(doc.xpLog ?? [])].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const names = await displayNamesFor(entries.map((e) => e.actorId));
  return {
    characterName: doc.name,
    entries: entries.map((e) => ({ ...e, actorName: names[e.actorId] ?? 'Unknown' })),
  };
}
