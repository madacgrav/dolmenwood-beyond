'use client';

import type { Npc } from '@/lib/api/npcs';
import { NpcCard } from './NpcCard';
import { STATUS_META, STATUS_ORDER } from './types';

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {STATUS_ORDER.map(status => {
        const group = npcs.filter(n => n.status === status);
        if (group.length === 0) return null;
        return (
          <div key={status}>
            <h3 style={{
              margin: '0 0 0.375rem', fontSize: '0.7rem', fontWeight: '700',
              textTransform: 'uppercase', letterSpacing: '0.05em',
              color: STATUS_META[status].color,
            }}>
              {STATUS_META[status].label} ({group.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {group.map(npc => (
                <NpcCard key={npc.id} npc={npc} userId={userId} isDM={isDM} onEdit={onEdit} onDelete={onDelete} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
