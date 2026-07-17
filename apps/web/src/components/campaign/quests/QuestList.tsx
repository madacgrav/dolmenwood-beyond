'use client';

import type { Quest } from '@/lib/api/quests';
import { QuestCard } from './QuestCard';
import { STATUS_META, STATUS_ORDER } from './types';

interface Props {
  quests: Quest[];
  onToggle: (quest: Quest) => void;
  onEdit: (quest: Quest) => void;
  onDelete: (questId: string) => void;
}

export function QuestList({ quests, onToggle, onEdit, onDelete }: Props) {
  if (quests.length === 0) {
    return (
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem 0' }}>
        No quests yet.
      </p>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {STATUS_ORDER.map(status => {
        const group = quests.filter(q => q.status === status);
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
              {group.map(quest => (
                <QuestCard key={quest.id} quest={quest} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
