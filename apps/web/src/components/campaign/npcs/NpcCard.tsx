'use client';

import type { Npc } from '@/lib/api/npcs';
import { STATUS_META } from './types';

interface Props {
  npc: Npc;
  userId: string;
  isDM: boolean;
  onEdit?: (npc: Npc) => void;
  onDelete?: (npcId: string) => void;
}

export function NpcCard({ npc, userId, isDM, onEdit, onDelete }: Props) {
  const canEdit = npc.added_by === userId || isDM;
  return (
    <div style={{
      padding: '0.625rem 0.75rem', borderRadius: '10px',
      border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)',
      opacity: npc.status === 'dead' ? 0.6 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ color: 'var(--color-text)', fontWeight: '600', fontSize: '0.9rem' }}>
          {npc.name}
        </span>
        {npc.relationship && (
          <>
            <span style={{ color: 'var(--color-text-muted)' }}>·</span>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
              {npc.relationship}
            </span>
          </>
        )}
        <span style={{
          marginLeft: 'auto', fontSize: '0.7rem', color: STATUS_META[npc.status].color,
          border: `1px solid ${STATUS_META[npc.status].color}`, borderRadius: '999px',
          padding: '0.1rem 0.5rem',
        }}>
          {STATUS_META[npc.status].label}
        </span>
        {canEdit && onEdit && (
          <button
            onClick={() => onEdit(npc)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-text-muted)', fontSize: '0.85rem',
              padding: '0.125rem', minHeight: '28px', minWidth: '28px',
            }}
            aria-label={`Edit ${npc.name}`}
          >
            ✎
          </button>
        )}
        {canEdit && onDelete && (
          <button
            onClick={() => onDelete(npc.id)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-danger)', fontSize: '0.85rem',
              padding: '0.125rem', minHeight: '28px', minWidth: '28px',
            }}
            aria-label={`Delete ${npc.name}`}
          >
            ✕
          </button>
        )}
      </div>
      {npc.note && (
        <p style={{
          margin: '0.375rem 0 0', fontSize: '0.8rem',
          color: 'var(--color-text-muted)', whiteSpace: 'pre-wrap',
        }}>
          {npc.note}
        </p>
      )}
      <p style={{ margin: '0.375rem 0 0', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
        Added by {npc.added_by_name}
      </p>
    </div>
  );
}
