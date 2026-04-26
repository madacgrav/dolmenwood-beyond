'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { calculateSpeed } from '@dolmenwood/rules-engine';

interface DBInventoryItem {
  id: string;
  character_id: string;
  item_name: string;
  item_type: string;
  quantity: number;
  weight_coins: number;
  notes?: string;
}

interface Props { characterId: string; }

const ITEM_TYPES = ['weapon', 'armour', 'gear', 'consumable', 'other'] as const;
type ItemType = typeof ITEM_TYPES[number];

export function InventoryTab({ characterId }: Props) {
  const supabase = createClient();
  const [items, setItems] = useState<DBInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState({ item_name: '', item_type: 'gear' as ItemType, quantity: 1, weight_coins: 0 });
  const [coins, setCoins] = useState({ gp: 0, sp: 0, cp: 0 });

  useEffect(() => {
    async function fetchItems() {
      const { data } = await supabase
        .from('character_inventory')
        .select('*')
        .eq('character_id', characterId)
        .order('item_type');
      setItems((data ?? []) as DBInventoryItem[]);
      setLoading(false);
    }
    fetchItems();
  }, [characterId, supabase]);

  const totalWeight = items.reduce((sum, item) => sum + (item.weight_coins * item.quantity), 0);
  const speed = calculateSpeed(totalWeight);

  async function addItem() {
    if (!newItem.item_name.trim()) return;
    const payload = { ...newItem, character_id: characterId };
    const { data, error } = await supabase.from('character_inventory').insert(payload).select().single();
    if (!error && data) {
      setItems(prev => [...prev, data as DBInventoryItem]);
      setNewItem({ item_name: '', item_type: 'gear', quantity: 1, weight_coins: 0 });
      setShowAddForm(false);
    }
  }

  async function deleteItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id));
    await supabase.from('character_inventory').delete().eq('id', id);
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: '52px', borderRadius: '8px', backgroundColor: 'var(--color-surface)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Weight + Speed */}
      <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '0.875rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Total Weight</div>
          <div style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--color-text)' }}>{totalWeight} coins</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Movement Speed</div>
          <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--color-primary)' }}>{speed}′</div>
        </div>
      </div>

      {/* Coins */}
      <section>
        <h3 style={{ margin: '0 0 0.75rem', fontFamily: 'var(--font-display), Georgia, serif', fontSize: '0.9rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Coins
        </h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['gp', 'sp', 'cp'] as const).map(coin => (
            <div key={coin} style={{ flex: 1, backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '0.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.65rem', color: coin === 'gp' ? 'var(--color-gold)' : 'var(--color-text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>{coin}</span>
              <input
                type="number"
                min={0}
                value={coins[coin]}
                onChange={e => setCoins(prev => ({ ...prev, [coin]: Math.max(0, parseInt(e.target.value) || 0) }))}
                style={{ width: '100%', textAlign: 'center', backgroundColor: 'transparent', border: 'none', color: 'var(--color-text)', fontSize: '1.1rem', fontWeight: '700', minHeight: '36px' }}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Item list */}
      <section>
        <h3 style={{ margin: '0 0 0.75rem', fontFamily: 'var(--font-display), Georgia, serif', fontSize: '0.9rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Equipment ({items.length})
        </h3>
        {items.length === 0 && !showAddForm && (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '2rem 0' }}>
            No equipment. Tap ⊕ to add items.
          </p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {items.map(item => (
            <div key={item.id} style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '0.625rem 0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--color-text)' }}>{item.item_name}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{item.item_type}</div>
              </div>
              <span style={{ fontSize: '0.75rem', backgroundColor: 'var(--color-bg)', borderRadius: '4px', padding: '2px 6px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>×{item.quantity}</span>
              <span style={{ fontSize: '0.75rem', backgroundColor: 'var(--color-bg)', borderRadius: '4px', padding: '2px 6px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{item.weight_coins * item.quantity}¢</span>
              <button
                onClick={() => deleteItem(item.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontSize: '1rem', padding: '0.25rem', minHeight: '36px', minWidth: '36px' }}
                aria-label={`Delete ${item.item_name}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {/* Add item form */}
        {showAddForm && (
          <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-primary)', borderRadius: '10px', padding: '1rem', marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h4 style={{ margin: 0, fontFamily: 'var(--font-display), Georgia, serif', fontSize: '0.9rem', color: 'var(--color-text)' }}>Add Item</h4>
            <input
              type="text"
              placeholder="Item name"
              value={newItem.item_name}
              onChange={e => setNewItem(p => ({ ...p, item_name: e.target.value }))}
              style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.9rem', minHeight: '44px' }}
            />
            <select
              value={newItem.item_type}
              onChange={e => setNewItem(p => ({ ...p, item_type: e.target.value as ItemType }))}
              style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.9rem', minHeight: '44px' }}
            >
              {ITEM_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>Quantity</label>
                <input
                  type="number" min={1}
                  value={newItem.quantity}
                  onChange={e => setNewItem(p => ({ ...p, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.9rem', minHeight: '44px' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>Weight (coins)</label>
                <input
                  type="number" min={0}
                  value={newItem.weight_coins}
                  onChange={e => setNewItem(p => ({ ...p, weight_coins: Math.max(0, parseInt(e.target.value) || 0) }))}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.9rem', minHeight: '44px' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setShowAddForm(false)}
                style={{ flex: 1, padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', cursor: 'pointer', fontSize: '0.9rem', minHeight: '44px' }}
              >
                Cancel
              </button>
              <button
                onClick={addItem}
                style={{ flex: 1, padding: '0.625rem', borderRadius: '8px', border: 'none', backgroundColor: 'var(--color-primary)', color: 'white', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '600', minHeight: '44px' }}
              >
                Add
              </button>
            </div>
          </div>
        )}
      </section>

      {/* FAB */}
      <button
        onClick={() => setShowAddForm(o => !o)}
        style={{
          position: 'fixed', bottom: '96px', right: '1.25rem',
          width: '56px', height: '56px', borderRadius: '50%',
          backgroundColor: 'var(--color-primary)', color: 'white',
          border: 'none', cursor: 'pointer',
          fontSize: '1.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)', zIndex: 40,
        }}
        aria-label="Add inventory item"
      >
        ⊕
      </button>
    </div>
  );
}
