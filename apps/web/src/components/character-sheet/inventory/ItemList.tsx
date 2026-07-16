'use client';
import type { InventoryItem as DBInventoryItem } from '@/lib/api/inventory';
import { LOCATION_LABELS, sectionHead } from './types';
import { ItemRow } from './ItemRow';

interface Props {
  items: DBInventoryItem[];
  isOwner: boolean;
  onToggleLocation: (item: DBInventoryItem) => void;
  onSetQuantity: (id: string, quantity: number) => void;
  onDelete: (id: string) => void;
}

/** Item list grouped by location (equipped → stowed → tiny); empty groups are hidden. */
export function ItemList({ items, isOwner, onToggleLocation, onSetQuantity, onDelete }: Props) {
  return (
    <>
      {(['equipped', 'stowed', 'tiny'] as const).map(loc => {
        const locItems = items.filter(i => i.location === loc);
        if (locItems.length === 0) return null;
        return (
          <section key={loc}>
            <h3 style={sectionHead}>{LOCATION_LABELS[loc]} ({locItems.length})</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {locItems.map(item => (
                <ItemRow
                  key={item.id}
                  item={item}
                  isOwner={isOwner}
                  onToggleLocation={onToggleLocation}
                  onSetQuantity={onSetQuantity}
                  onDelete={onDelete}
                />
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
