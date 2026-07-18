'use client';
import { useEffect, useState } from 'react';
import type { InventoryItem as DBInventoryItem } from '@/lib/api/inventory';

interface Props {
  item: DBInventoryItem;
  isOwner: boolean;
  onToggleLocation: (item: DBInventoryItem) => void;
  onSetQuantity: (id: string, quantity: number) => void;
  onSetNotes: (id: string, notes: string | null) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onDelete: (id: string) => void;
}

const stepBtn: React.CSSProperties = {
  width: '32px', height: '44px', borderRadius: '6px',
  border: '1px solid var(--color-border)',
  backgroundColor: 'var(--color-bg)', color: 'var(--color-text)',
  fontSize: '1.1rem', cursor: 'pointer', flexShrink: 0,
};

/** Single inventory item card: name, type details, qty/weight chips, owner actions. */
export function ItemRow({ item, isOwner, onToggleLocation, onSetQuantity, onSetNotes, onMove, canMoveUp, canMoveDown, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(item.quantity));
  const [showNotes, setShowNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState(item.notes ?? '');

  useEffect(() => {
    if (!editing) setDraft(String(item.quantity));
  }, [item.quantity, editing]);

  useEffect(() => {
    if (!showNotes) setNotesDraft(item.notes ?? '');
  }, [item.notes, showNotes]);

  function commitDraft() {
    onSetQuantity(item.id, parseInt(draft) || 0);
    setEditing(false);
  }

  function commitNotes() {
    const trimmed = notesDraft.trim();
    if ((item.notes ?? '') !== trimmed) onSetNotes(item.id, trimmed || null);
  }

  return (
    <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '0.625rem 0.875rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.item_name}</div>
        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
          {item.item_type}
          {item.weapon_damage_dice ? ` · ${item.weapon_damage_dice}` : ''}
          {item.armor_ac_bonus != null ? ` · AC ${item.armor_ac_bonus}` : ''}
        </div>
      </div>
      {isOwner ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <button
            onClick={() => onSetQuantity(item.id, item.quantity - 1)}
            disabled={item.quantity <= 0}
            style={{ ...stepBtn, opacity: item.quantity <= 0 ? 0.4 : 1 }}
            aria-label={`Remove one ${item.item_name}`}
          >−</button>
          {editing ? (
            <input
              autoFocus
              inputMode="numeric"
              pattern="[0-9]*"
              value={draft}
              onChange={e => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
              onBlur={commitDraft}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              style={{ width: '4ch', textAlign: 'center', fontVariantNumeric: 'tabular-nums', minHeight: '44px', border: '1px solid var(--color-border)', borderRadius: '6px', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontWeight: '700', fontSize: '1rem' }}
              aria-label={`Set quantity for ${item.item_name}`}
            />
          ) : (
            <button
              onClick={() => setEditing(true)}
              style={{ minWidth: '3ch', minHeight: '44px', textAlign: 'center', fontVariantNumeric: 'tabular-nums', fontWeight: '700', fontSize: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: item.quantity === 0 ? 'var(--color-danger)' : 'var(--color-text)', padding: '0 0.25rem' }}
              aria-label={`Edit quantity of ${item.item_name}, currently ${item.quantity}`}
            >
              {item.quantity}
            </button>
          )}
          <button
            onClick={() => onSetQuantity(item.id, item.quantity + 1)}
            style={stepBtn}
            aria-label={`Add one ${item.item_name}`}
          >+</button>
        </div>
      ) : (
        <span style={{ fontSize: '0.75rem', backgroundColor: 'var(--color-bg)', borderRadius: '4px', padding: '2px 6px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>×{item.quantity}</span>
      )}
      {item.location !== 'tiny' && (
        <span style={{ fontSize: '0.75rem', backgroundColor: 'var(--color-bg)', borderRadius: '4px', padding: '2px 6px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
          {item.weight_coins * item.quantity}¢
        </span>
      )}
      {isOwner && (
        <button
          onClick={() => onToggleLocation(item)}
          title="Cycle location: stowed → equipped → tiny"
          style={{ background: 'none', border: '1px solid var(--color-border)', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '0.7rem', padding: '0.2rem 0.375rem', borderRadius: '4px', minHeight: '44px', whiteSpace: 'nowrap' }}
        >
          {item.location === 'equipped' ? '⚔️' : item.location === 'stowed' ? '🎒' : '🔮'}
        </button>
      )}
      {isOwner && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <button
            onClick={() => onMove(item.id, 'up')}
            disabled={!canMoveUp}
            style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: '4px', cursor: canMoveUp ? 'pointer' : 'default', color: 'var(--color-text-muted)', fontSize: '0.6rem', padding: '0 0.3rem', minHeight: '21px', opacity: canMoveUp ? 1 : 0.35 }}
            aria-label={`Move ${item.item_name} up`}
          >▲</button>
          <button
            onClick={() => onMove(item.id, 'down')}
            disabled={!canMoveDown}
            style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: '4px', cursor: canMoveDown ? 'pointer' : 'default', color: 'var(--color-text-muted)', fontSize: '0.6rem', padding: '0 0.3rem', minHeight: '21px', opacity: canMoveDown ? 1 : 0.35 }}
            aria-label={`Move ${item.item_name} down`}
          >▼</button>
        </div>
      )}
      {(isOwner || item.notes) && (
        <button
          onClick={() => setShowNotes(s => !s)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', padding: '0.25rem', minHeight: '44px', opacity: item.notes ? 1 : 0.45 }}
          aria-label={item.notes ? `Show notes for ${item.item_name}` : `Add notes for ${item.item_name}`}
          aria-expanded={showNotes}
        >
          📝
        </button>
      )}
      {isOwner && (
        <button
          onClick={() => onDelete(item.id)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontSize: '1rem', padding: '0.25rem', minHeight: '44px', minWidth: '44px' }}
          aria-label={`Delete ${item.item_name}`}
        >
          ✕
        </button>
      )}
    </div>
    {showNotes && (
      isOwner ? (
        <textarea
          value={notesDraft}
          onChange={e => setNotesDraft(e.target.value)}
          onBlur={commitNotes}
          placeholder="Notes (custom gear, quest items…)"
          rows={2}
          maxLength={500}
          style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.82rem', fontFamily: 'inherit' }}
          aria-label={`Notes for ${item.item_name}`}
        />
      ) : (
        <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', whiteSpace: 'pre-wrap' }}>{item.notes}</div>
      )
    )}
    </div>
  );
}
