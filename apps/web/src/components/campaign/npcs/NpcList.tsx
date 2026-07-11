'use client';

import type { Npc } from '@/lib/api/npcs';
import { NpcCard } from './NpcCard';

interface Props {
  npcs: Npc[];
  userId: string;
  isDM: boolean;
  onEdit?: (npc: Npc) => void;
  onDelete?: (npcId: string) => void;
}

export function NpcList({ npcs, userId, isDM, onEdit, onDelete }: Props) {
  if (npcs.length === 0) {
    return (
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem 0' }}>
        No NPCs yet.
      </p>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {npcs.map(npc => (
        <NpcCard key={npc.id} npc={npc} userId={userId} isDM={isDM} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}
