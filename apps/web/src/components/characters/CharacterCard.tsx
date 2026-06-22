'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import type { Character } from '@dolmenwood/types';
import { calculateAC, getAttackBonus, getKindredACBonus } from '@dolmenwood/rules-engine';
import { HPBar } from '@/components/ui/HPBar';

interface CharacterCardProps {
  character: Character;
  armorBonus?: number;
  onDelete: (id: string) => Promise<unknown>;
}

export function CharacterCard({ character, armorBonus = 0, onDelete }: CharacterCardProps) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const touchStartX = useRef<number>(0);
  const SWIPE_THRESHOLD = 80;

  const ac = calculateAC({
    dexScore: character.abilityScores.dex,
    armorBonus,
    kindredACBonus: getKindredACBonus(character.kindred),
    classACBonus: 0,
    shieldBonus: 0,
  });

  const attackBonus = getAttackBonus(character.characterClass, character.level);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? 0;
  }

  function handleTouchMove(e: React.TouchEvent) {
    const delta = (e.touches[0]?.clientX ?? 0) - touchStartX.current;
    if (delta < 0) setSwipeOffset(Math.max(delta, -SWIPE_THRESHOLD - 20));
  }

  function handleTouchEnd() {
    if (swipeOffset < -SWIPE_THRESHOLD) {
      setShowDeleteConfirm(true);
    }
    setSwipeOffset(0);
  }

  function openDeleteConfirm(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDeleteError(null);
    setShowDeleteConfirm(true);
  }

  async function handleConfirmDelete() {
    setDeleting(true);
    setDeleteError(null);
    const error = await onDelete(character.id);
    setDeleting(false);
    if (error) {
      setDeleteError('Failed to delete. Please try again.');
    } else {
      setShowDeleteConfirm(false);
    }
  }

  return (
    <>
      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '12px' }}>
        {/* Delete background (swipe reveal) */}
        <div style={{
          position: 'absolute', right: 0, top: 0, bottom: 0,
          width: '80px', backgroundColor: 'var(--color-danger)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '12px',
        }}>
          <span style={{ color: 'white', fontSize: '1.25rem' }}>🗑</span>
        </div>

        {/* Card */}
        <Link href={`/characters/${character.id}`} style={{ textDecoration: 'none' }}>
          <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '12px',
              padding: '1rem',
              display: 'flex',
              gap: '0.875rem',
              alignItems: 'flex-start',
              transform: `translateX(${swipeOffset}px)`,
              transition: swipeOffset === 0 ? 'transform 0.2s ease' : 'none',
              cursor: 'pointer',
              position: 'relative',
              zIndex: 1,
            }}
          >
            {/* Portrait */}
            <div style={{
              width: '56px', height: '56px', borderRadius: '8px', flexShrink: 0,
              backgroundColor: 'var(--color-border)',
              backgroundImage: character.portraitUrl ? `url(${character.portraitUrl})` : undefined,
              backgroundSize: 'cover', backgroundPosition: 'center',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.5rem',
            }}>
              {!character.portraitUrl && kindredEmoji(character.kindred)}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h3 style={{
                  margin: 0, fontSize: '1rem', fontWeight: '600',
                  color: 'var(--color-text)',
                  fontFamily: 'var(--font-display), Georgia, serif',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {character.name}
                </h3>
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, marginLeft: '0.5rem', alignItems: 'center' }}>
                  <StatChip label="AC" value={ac} />
                  <StatChip label="ATK" value={attackBonus >= 0 ? `+${attackBonus}` : attackBonus} />
                  {/* Delete button — accessible on desktop and mobile */}
                  <button
                    onClick={openDeleteConfirm}
                    aria-label={`Delete ${character.name}`}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--color-text-muted)', fontSize: '1.1rem',
                      padding: '2px 4px', lineHeight: 1, minHeight: '32px', minWidth: '28px',
                      borderRadius: '4px',
                    }}
                  >
                    ⋮
                  </button>
                </div>
              </div>

              <p style={{
                margin: '0.2rem 0 0.5rem',
                fontSize: '0.8rem', color: 'var(--color-text-muted)',
              }}>
                {character.kindred} {character.characterClass} · Level {character.level}
              </p>

              <HPBar current={character.hpCurrent} max={character.hpMax} />
            </div>
          </div>
        </Link>
      </div>

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1.5rem',
        }}>
          <div style={{
            backgroundColor: 'var(--color-surface)',
            borderRadius: '12px', padding: '1.5rem',
            width: '100%', maxWidth: '360px',
          }}>
            <h3 style={{ margin: '0 0 0.5rem', color: 'var(--color-text)', fontFamily: 'var(--font-display), Georgia, serif' }}>
              Delete {character.name}?
            </h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', margin: '0 0 1.25rem' }}>
              This will permanently delete this character and all their data. This cannot be undone.
            </p>
            {deleteError && (
              <p style={{ color: 'var(--color-danger)', fontSize: '0.85rem', margin: '0 0 1rem' }}>
                {deleteError}
              </p>
            )}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteError(null); }}
                disabled={deleting}
                style={{ flex: 1, padding: '0.75rem', backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '8px', cursor: 'pointer', color: 'var(--color-text)', minHeight: '44px', opacity: deleting ? 0.5 : 1 }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                style={{ flex: 1, padding: '0.75rem', backgroundColor: 'var(--color-danger)', border: 'none', borderRadius: '8px', cursor: deleting ? 'not-allowed' : 'pointer', color: 'white', fontWeight: '600', minHeight: '44px', opacity: deleting ? 0.7 : 1 }}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function StatChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      backgroundColor: 'var(--color-bg)', borderRadius: '6px',
      padding: '2px 8px', minWidth: '36px',
    }}>
      <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', lineHeight: 1 }}>{label}</span>
      <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}

function kindredEmoji(kindred: Character['kindred']): string {
  const map: Record<Character['kindred'], string> = {
    Human: '🧑', Breggle: '🐏', Elf: '🧝', Grimalkin: '🐱', Mossling: '🌿', Woodgrue: '🌲',
  };
  return map[kindred] ?? '🧑';
}
