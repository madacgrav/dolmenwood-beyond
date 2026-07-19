'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  characterId: string;
  editMode: boolean;
  readOnly: boolean;
  onToggleEdit: () => void;
  onDelete?: () => void;
}

/**
 * Character-sheet contextual actions for the app-bar slot: Edit/Done toggle +
 * ⋮ overflow menu (XP History, Level Up History, Export PDF, Delete), or the
 * read-only badge on the referee view.
 */
export function SheetActions({ characterId, editMode, readOnly, onToggleEdit, onDelete }: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const router = useRouter();

  if (readOnly) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
        fontSize: '0.78rem', fontWeight: '600',
        color: 'var(--color-text-muted)',
        border: '1px solid var(--color-border)',
        borderRadius: '8px',
        padding: '0.25rem 0.6rem',
        backgroundColor: 'var(--color-surface)',
        whiteSpace: 'nowrap',
      }}>
        👁 Read-Only
      </span>
    );
  }

  return (
    <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center', position: 'relative' }}>
      <button
        onClick={onToggleEdit}
        style={{
          background: editMode ? 'var(--color-primary)' : 'none',
          border: editMode ? 'none' : '1px solid var(--color-border)',
          borderRadius: '8px', cursor: 'pointer',
          color: editMode ? 'white' : 'var(--color-text-muted)',
          fontSize: '0.85rem', padding: '0.25rem 0.6rem',
          minHeight: '40px', display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
          whiteSpace: 'nowrap',
        }}
      >
        {editMode ? '✓ Done' : '✏️ Edit'}
      </button>
      <button
        onClick={() => setShowMenu(m => !m)}
        aria-label="More options"
        style={{
          background: 'none', border: '1px solid var(--color-border)', borderRadius: '8px',
          cursor: 'pointer', color: 'var(--color-text-muted)',
          fontSize: '1.1rem', padding: '0.25rem 0.5rem',
          minHeight: '40px', minWidth: '40px',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        ⋮
      </button>
      {showMenu && (
        <>
          <div onClick={() => setShowMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 98 }} />
          <div style={{
            position: 'absolute', top: '100%', right: 0, marginTop: '0.25rem',
            backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: '10px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            zIndex: 99, minWidth: '180px', overflow: 'hidden',
          }}>
            <button
              onClick={() => { setShowMenu(false); router.push(`/characters/${characterId}/xp-log`); }}
              style={{
                width: '100%', padding: '0.75rem 1rem', background: 'none', border: 'none',
                textAlign: 'left', cursor: 'pointer', color: 'var(--color-text)',
                fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
                minHeight: '44px', justifyContent: 'flex-start',
              }}
            >
              📈 XP History
            </button>
            <button
              onClick={() => { setShowMenu(false); router.push(`/characters/${characterId}/level-up-log`); }}
              style={{
                width: '100%', padding: '0.75rem 1rem', background: 'none', border: 'none',
                textAlign: 'left', cursor: 'pointer', color: 'var(--color-text)',
                fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
                minHeight: '44px', justifyContent: 'flex-start',
              }}
            >
              📜 Level Up History
            </button>
            <a
              href={`/api/characters/${characterId}/pdf`}
              onClick={() => setShowMenu(false)}
              style={{
                width: '100%', padding: '0.75rem 1rem',
                borderTop: '1px solid var(--color-border)',
                textAlign: 'left', cursor: 'pointer', color: 'var(--color-text)',
                fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
                minHeight: '44px', textDecoration: 'none', justifyContent: 'flex-start',
                boxSizing: 'border-box',
              }}
            >
              📄 Export PDF
            </a>
            {onDelete && (
              <button
                onClick={() => { setShowMenu(false); onDelete(); }}
                style={{
                  width: '100%', padding: '0.75rem 1rem', background: 'none',
                  borderTop: '1px solid var(--color-border)', borderLeft: 'none', borderRight: 'none', borderBottom: 'none',
                  textAlign: 'left', cursor: 'pointer', color: 'var(--color-danger)',
                  fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
                  minHeight: '44px', justifyContent: 'flex-start',
                }}
              >
                🗑 Delete Character
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
