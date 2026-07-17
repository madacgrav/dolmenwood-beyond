'use client';

import type { Quest } from '@/lib/api/quests';

interface Props {
  quest: Quest;
  onToggle: (quest: Quest) => void;
  onEdit: (quest: Quest) => void;
  onDelete: (questId: string) => void;
}

export function QuestCard({ quest, onToggle, onEdit, onDelete }: Props) {
  const done = quest.status === 'completed';
  return (
    <div style={{
      padding: '0.625rem 0.75rem', borderRadius: '10px',
      border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)',
      opacity: done ? 0.6 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <button
          onClick={() => onToggle(quest)}
          style={{
            width: '28px', height: '28px', minHeight: '28px', flexShrink: 0,
            borderRadius: '6px', cursor: 'pointer',
            border: `2px solid ${done ? 'var(--color-primary)' : 'var(--color-border)'}`,
            backgroundColor: done ? 'var(--color-primary)' : 'transparent',
            color: 'white', fontSize: '0.85rem', lineHeight: 1,
          }}
          aria-label={done ? `Mark ${quest.title} active` : `Mark ${quest.title} completed`}
          aria-pressed={done}
        >
          {done ? '✓' : ''}
        </button>
        <span style={{
          color: 'var(--color-text)', fontWeight: '600', fontSize: '0.9rem',
          textDecoration: done ? 'line-through' : 'none',
        }}>
          {quest.title}
        </span>
        {quest.giver && (
          <>
            <span style={{ color: 'var(--color-text-muted)' }}>·</span>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
              {quest.giver}
            </span>
          </>
        )}
        <button
          onClick={() => onEdit(quest)}
          style={{
            marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-text-muted)', fontSize: '0.85rem',
            padding: '0.125rem', minHeight: '28px', minWidth: '28px',
          }}
          aria-label={`Edit ${quest.title}`}
        >
          ✎
        </button>
        <button
          onClick={() => onDelete(quest.id)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-danger)', fontSize: '0.85rem',
            padding: '0.125rem', minHeight: '28px', minWidth: '28px',
          }}
          aria-label={`Delete ${quest.title}`}
        >
          ✕
        </button>
      </div>
      {quest.note && (
        <p style={{
          margin: '0.375rem 0 0', fontSize: '0.8rem',
          color: 'var(--color-text-muted)', whiteSpace: 'pre-wrap',
        }}>
          {quest.note}
        </p>
      )}
      <p style={{ margin: '0.375rem 0 0', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
        Added by {quest.added_by_name}
      </p>
    </div>
  );
}
