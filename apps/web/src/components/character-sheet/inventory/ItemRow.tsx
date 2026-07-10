'use client';
import type { InventoryItem as DBInventoryItem } from '@/lib/api/inventory';

interface Props {
  item: DBInventoryItem;
  isOwner: boolean;
  onToggleLocation: (item: DBInventoryItem) => void;
  onDelete: (id: string) => void;
}

/** Single inventory item card: name, type details, qty/weight chips, owner actions. */
export function ItemRow({ item, isOwner, onToggleLocation, onDelete }: Props) {
  return (
    <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '0.625rem 0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.item_name}</div>
        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
          {item.item_type}
          {item.weapon_damage_dice ? ` · ${item.weapon_damage_dice}` : ''}
          {item.armor_ac_bonus != null ? ` · AC ${item.armor_ac_bonus}` : ''}
        </div>
      </div>
      <span style={{ fontSize: '0.75rem', backgroundColor: 'var(--color-bg)', borderRadius: '4px', padding: '2px 6px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>×{item.quantity}</span>
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
        <button
          onClick={() => onDelete(item.id)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontSize: '1rem', padding: '0.25rem', minHeight: '44px', minWidth: '44px' }}
          aria-label={`Delete ${item.item_name}`}
        >
          ✕
        </button>
      )}
    </div>
  );
}
