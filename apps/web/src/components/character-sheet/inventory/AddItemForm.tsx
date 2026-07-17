'use client';
import type { InventoryItem as DBInventoryItem } from '@/lib/api/inventory';
import { ITEM_TYPES, ITEM_TYPE_LABELS, type ItemType } from './types';
import type { AddItemController } from './use-add-item';

interface Props {
  controller: AddItemController;
}

/** Add-item panel with two modes: free-form custom entry and catalog picker. */
export function AddItemForm({ controller }: Props) {
  const {
    addMode, setAddMode, newItem, setNewItem,
    catalogItems, catalogSearch, setCatalogSearch, catalogLoading,
    selectCatalogItem, addItem, setShowAddForm,
  } = controller;

  const filteredCatalog = catalogItems.filter(c =>
    catalogSearch.length < 2 || c.name.toLowerCase().includes(catalogSearch.toLowerCase())
  );

  return (
    <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-primary)', borderRadius: '10px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={() => setAddMode('custom')}
          style={{ flex: 1, padding: '0.4rem', borderRadius: '6px', border: '1px solid var(--color-border)', backgroundColor: addMode === 'custom' ? 'var(--color-primary)' : 'var(--color-bg)', color: addMode === 'custom' ? 'white' : 'var(--color-text)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '600', minHeight: '36px' }}
        >
          ✍️ Custom
        </button>
        <button
          onClick={() => setAddMode('catalog')}
          style={{ flex: 1, padding: '0.4rem', borderRadius: '6px', border: '1px solid var(--color-border)', backgroundColor: addMode === 'catalog' ? 'var(--color-primary)' : 'var(--color-bg)', color: addMode === 'catalog' ? 'white' : 'var(--color-text)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '600', minHeight: '36px' }}
        >
          📖 Catalog
        </button>
      </div>

      {addMode === 'catalog' ? (
        <>
          <input
            type="search"
            placeholder="Search equipment catalog…"
            value={catalogSearch}
            onChange={e => setCatalogSearch(e.target.value)}
            autoFocus
            style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.9rem', minHeight: '44px' }}
          />
          {catalogLoading ? (
            <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '1rem', fontSize: '0.85rem' }}>Loading…</div>
          ) : (
            <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {filteredCatalog.slice(0, 40).map(cat => (
                <button
                  key={cat.id}
                  onClick={() => selectCatalogItem(cat)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.5rem 0.75rem', borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-bg)', cursor: 'pointer', textAlign: 'left', minHeight: '44px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text)' }}>{cat.name}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                      {cat.item_type}{cat.weapon_damage_dice ? ` · ${cat.weapon_damage_dice}` : ''}{cat.armor_ac_bonus != null ? ` · AC ${cat.armor_ac_bonus}` : ''}
                      {cat.cost_gp != null ? ` · ${cat.cost_gp} gp` : ''}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', marginLeft: '0.5rem' }}>{cat.weight}¢</span>
                </button>
              ))}
              {filteredCatalog.length === 0 && (
                <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem', padding: '1rem 0' }}>No items match "{catalogSearch}"</p>
              )}
            </div>
          )}
          <button
            onClick={() => setShowAddForm(false)}
            style={{ padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', cursor: 'pointer', fontSize: '0.9rem', minHeight: '44px' }}
          >
            Cancel
          </button>
        </>
      ) : (
        <>
          <input
            type="text"
            placeholder="Item name"
            value={newItem.item_name}
            onChange={e => setNewItem(p => ({ ...p, item_name: e.target.value }))}
            style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.9rem', minHeight: '44px' }}
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <select
              value={newItem.item_type}
              onChange={e => setNewItem(p => ({ ...p, item_type: e.target.value as ItemType }))}
              style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.9rem', minHeight: '44px' }}
            >
              {ITEM_TYPES.map(t => <option key={t} value={t}>{ITEM_TYPE_LABELS[t]}</option>)}
            </select>
            <select
              value={newItem.location}
              onChange={e => setNewItem(p => ({ ...p, location: e.target.value as DBInventoryItem['location'] }))}
              style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.9rem', minHeight: '44px' }}
            >
              <option value="stowed">🎒 Stowed</option>
              <option value="equipped">⚔️ Equipped</option>
              <option value="tiny">🔮 Tiny</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.2rem' }}>Qty</label>
              <input type="number" min={1} value={newItem.quantity}
                onChange={e => setNewItem(p => ({ ...p, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.9rem', minHeight: '44px', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.2rem' }}>Weight (¢)</label>
              <input type="number" min={0} value={newItem.weight_coins}
                onChange={e => setNewItem(p => ({ ...p, weight_coins: Math.max(0, parseInt(e.target.value) || 0) }))}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.9rem', minHeight: '44px', boxSizing: 'border-box' }}
              />
            </div>
          </div>
          {newItem.item_type === 'weapon' && (
            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.2rem' }}>Damage Dice (e.g. 1d8)</label>
              <input type="text" placeholder="1d6" value={newItem.weapon_damage_dice}
                onChange={e => setNewItem(p => ({ ...p, weapon_damage_dice: e.target.value }))}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.9rem', minHeight: '44px', boxSizing: 'border-box' }}
              />
            </div>
          )}
          {newItem.item_type === 'armor' && (
            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.2rem' }}>AC Value (total, e.g. 14 for chainmail)</label>
              <input type="number" placeholder="12" value={newItem.armor_ac_bonus}
                onChange={e => setNewItem(p => ({ ...p, armor_ac_bonus: e.target.value }))}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.9rem', minHeight: '44px', boxSizing: 'border-box' }}
              />
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => setShowAddForm(false)}
              style={{ flex: 1, padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', cursor: 'pointer', fontSize: '0.9rem', minHeight: '44px' }}>
              Cancel
            </button>
            <button onClick={addItem}
              style={{ flex: 1, padding: '0.625rem', borderRadius: '8px', border: 'none', backgroundColor: 'var(--color-primary)', color: 'white', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '600', minHeight: '44px' }}>
              Add
            </button>
          </div>
        </>
      )}
    </div>
  );
}
