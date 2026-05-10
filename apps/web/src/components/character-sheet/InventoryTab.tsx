'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
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
  location: 'equipped' | 'stowed' | 'tiny';
  weapon_damage_dice?: string | null;
  armor_ac_bonus?: number | null;
}

interface CatalogItem {
  id: string;
  name: string;
  item_type: string;
  weight: number;
  cost_gp: number | null;
  weapon_damage_dice: string | null;
  armor_ac_bonus: number | null;
  notes: string | null;
}

interface Props {
  characterId: string;
  ownerId: string;
  readOnly?: boolean;
}

const ITEM_TYPES = ['weapon', 'armour', 'gear', 'consumable', 'other'] as const;
type ItemType = typeof ITEM_TYPES[number];

const LOCATION_LABELS: Record<string, string> = {
  equipped: '⚔️ Equipped',
  stowed: '🎒 Stowed',
  tiny: '🔮 Tiny',
};

const sectionHead: React.CSSProperties = {
  margin: '0 0 0.75rem',
  fontFamily: 'var(--font-display), Georgia, serif',
  fontSize: '0.9rem',
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
};

// Restock catalog — prices in SP (silver standard: 1 GP = 20 SP, 1 SP = 10 CP)
interface RestockEntry {
  name: string;
  unit: number;    // quantity added per purchase
  priceSp: number; // price in SP (fractional: 0.05 SP = 0.5 CP ≈ 1 cp)
  category: string;
}

const RESTOCK_ITEMS: RestockEntry[] = [
  { name: 'Arrows',               unit: 20, priceSp: 1,    category: 'ammo' },
  { name: 'Crossbow Quarrels',    unit: 20, priceSp: 2,    category: 'ammo' },
  { name: 'Sling Stones',         unit: 20, priceSp: 0.25, category: 'ammo' },
  { name: 'Oil Flask',            unit: 1,  priceSp: 1,    category: 'gear' },
  { name: 'Torch',                unit: 1,  priceSp: 0.05, category: 'gear' },
  { name: 'Preserved Rations',    unit: 1,  priceSp: 1,    category: 'gear' },
  { name: 'Waterskin Refill',     unit: 1,  priceSp: 0.05, category: 'gear' },
  { name: 'Horse Feed (per day)', unit: 1,  priceSp: 0.25, category: 'gear' },
  { name: 'Dog Feed (per day)',   unit: 1,  priceSp: 0.10, category: 'gear' },
];

export function InventoryTab({ characterId, ownerId, readOnly = false }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<DBInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addMode, setAddMode] = useState<'custom' | 'catalog'>('custom');
  const [newItem, setNewItem] = useState({
    item_name: '', item_type: 'gear' as ItemType, quantity: 1, weight_coins: 0,
    location: 'stowed' as DBInventoryItem['location'], weapon_damage_dice: '', armor_ac_bonus: '',
  });
  const [coins, setCoins] = useState({ gp: 0, sp: 0, cp: 0 });
  const [bankBalance, setBankBalance] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showDeposit, setShowDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositDesc, setDepositDesc] = useState('');
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositError, setDepositError] = useState('');
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogLoading, setCatalogLoading] = useState(false);

  // Restock state
  const [showRestock, setShowRestock] = useState(false);
  const [restockQtys, setRestockQtys] = useState<Record<string, number>>({});
  const [restockLoading, setRestockLoading] = useState(false);
  const [restockSuccess, setRestockSuccess] = useState(false);
  const [restockError, setRestockError] = useState('');

  const isOwner = !readOnly && currentUserId === ownerId;

  const fetchBankBalance = useCallback(async () => {
    const { data } = await supabase
      .from('bank_ledger')
      .select('amount_gp')
      .eq('character_id', characterId);
    const total = (data ?? []).reduce((sum: number, r: { amount_gp: number }) => sum + r.amount_gp, 0);
    setBankBalance(total);
  }, [characterId, supabase]);

  useEffect(() => {
    async function fetchAll() {
      const [{ data: { user } }, { data: invItems }, { data: charData }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('character_inventory').select('*').eq('character_id', characterId).order('location').order('item_type'),
        supabase.from('characters').select('coins_gp, coins_sp, coins_cp').eq('id', characterId).single(),
      ]);
      setCurrentUserId(user?.id ?? null);
      const mapped = (invItems ?? []).map((i: Record<string, unknown>) => ({
        id: i.id as string,
        character_id: i.character_id as string,
        item_name: i.item_name as string,
        item_type: i.item_type as string,
        quantity: i.quantity as number,
        weight_coins: i.weight_coins as number,
        notes: i.notes as string | undefined,
        location: ((i.location as string) ?? 'stowed') as DBInventoryItem['location'],
        weapon_damage_dice: i.weapon_damage_dice as string | null | undefined,
        armor_ac_bonus: i.armor_ac_bonus as number | null | undefined,
      }));
      setItems(mapped);
      if (charData) {
        const row = charData as Record<string, unknown>;
        setCoins({
          gp: (row.coins_gp as number) ?? 0,
          sp: (row.coins_sp as number) ?? 0,
          cp: (row.coins_cp as number) ?? 0,
        });
      }
      setLoading(false);
    }
    fetchAll();
    fetchBankBalance();
  }, [characterId, supabase, fetchBankBalance]);

  useEffect(() => {
    if (addMode !== 'catalog') return;
    setCatalogLoading(true);
    supabase.from('catalog_items').select('id, name, item_type, weight, cost_gp, weapon_damage_dice, armor_ac_bonus, notes')
      .order('name')
      .then(({ data }) => {
        setCatalogItems((data ?? []) as CatalogItem[]);
        setCatalogLoading(false);
      });
  }, [addMode, supabase]);

  async function saveCoins(updated: { gp: number; sp: number; cp: number }) {
    await supabase.from('characters').update({
      coins_gp: updated.gp,
      coins_sp: updated.sp,
      coins_cp: updated.cp,
    }).eq('id', characterId);
  }

  function handleCoinChange(coin: 'gp' | 'sp' | 'cp', value: string) {
    const n = Math.max(0, parseInt(value) || 0);
    const updated = { ...coins, [coin]: n };
    setCoins(updated);
    saveCoins(updated);
  }

  async function handleDeposit() {
    const amount = parseInt(depositAmount);
    if (!amount || amount <= 0) { setDepositError('Enter a positive amount.'); return; }
    if (amount > coins.gp) { setDepositError(`You only have ${coins.gp} gp on hand.`); return; }
    setDepositLoading(true);
    setDepositError('');

    const newGp = coins.gp - amount;
    const [{ error: ledgerErr }, { error: coinErr }] = await Promise.all([
      supabase.from('bank_ledger').insert({
        character_id: characterId,
        amount_gp: amount,
        description: depositDesc.trim() || 'Deposit',
        performed_by: currentUserId,
      }),
      supabase.from('characters').update({ coins_gp: newGp }).eq('id', characterId),
    ]);

    if (ledgerErr || coinErr) {
      setDepositError((ledgerErr ?? coinErr)!.message);
    } else {
      setCoins(c => ({ ...c, gp: newGp }));
      await fetchBankBalance();
      setShowDeposit(false);
      setDepositAmount('');
      setDepositDesc('');
    }
    setDepositLoading(false);
  }

  const totalWeight = items.reduce((sum, item) => {
    if (item.location === 'tiny') return sum;
    return sum + (item.weight_coins * item.quantity);
  }, 0);
  const speed = calculateSpeed(totalWeight);
  const speedColor = speed >= 40 ? 'var(--color-primary)' : speed >= 30 ? 'var(--color-text)' : speed >= 20 ? 'var(--color-gold)' : 'var(--color-danger)';
  const maxWeight = 800;
  const weightPct = Math.min(1, totalWeight / maxWeight);

  function selectCatalogItem(cat: CatalogItem) {
    const mappedType = cat.item_type === 'armor' ? 'armour' : cat.item_type as ItemType;
    setNewItem({
      item_name: cat.name,
      item_type: ITEM_TYPES.includes(mappedType as ItemType) ? mappedType as ItemType : 'gear',
      quantity: 1,
      weight_coins: cat.weight,
      location: cat.item_type === 'armor' || cat.item_type === 'weapon' ? 'equipped' : 'stowed',
      weapon_damage_dice: cat.weapon_damage_dice ?? '',
      armor_ac_bonus: cat.armor_ac_bonus != null ? String(cat.armor_ac_bonus) : '',
    });
    setAddMode('custom');
  }

  async function addItem() {
    if (!newItem.item_name.trim()) return;
    const payload: Record<string, unknown> = {
      character_id: characterId,
      item_name: newItem.item_name.trim(),
      item_type: newItem.item_type,
      quantity: newItem.quantity,
      weight_coins: newItem.weight_coins,
      location: newItem.location,
    };
    if (newItem.weapon_damage_dice.trim()) payload.weapon_damage_dice = newItem.weapon_damage_dice.trim();
    const acBonus = parseInt(newItem.armor_ac_bonus);
    if (!isNaN(acBonus)) payload.armor_ac_bonus = acBonus;
    const { data, error } = await supabase.from('character_inventory').insert(payload).select().single();
    if (!error && data) {
      const mapped = { ...(data as DBInventoryItem), location: (data as Record<string, unknown>).location as DBInventoryItem['location'] ?? 'stowed' };
      setItems(prev => [...prev, mapped]);
      setNewItem({ item_name: '', item_type: 'gear', quantity: 1, weight_coins: 0, location: 'stowed', weapon_damage_dice: '', armor_ac_bonus: '' });
      setShowAddForm(false);
    }
  }

  async function toggleLocation(item: DBInventoryItem) {
    const cycle: DBInventoryItem['location'][] = ['stowed', 'equipped', 'tiny'];
    const next = cycle[(cycle.indexOf(item.location) + 1) % cycle.length]!;
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, location: next } : i));
    await supabase.from('character_inventory').update({ location: next }).eq('id', item.id);
  }

  async function deleteItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id));
    await supabase.from('character_inventory').delete().eq('id', id);
  }

  // Restock helpers
  function restockTotalSp(): number {
    return RESTOCK_ITEMS.reduce((sum, entry) => {
      const qty = restockQtys[entry.name] ?? 0;
      return sum + qty * entry.priceSp;
    }, 0);
  }

  /** Total SP value of coins on hand (1 GP = 20 SP, 1 CP = 0.1 SP) */
  function totalSpOnHand(c: { gp: number; sp: number; cp: number }): number {
    return c.gp * 20 + c.sp + c.cp / 10;
  }

  /** Deduct amountSp from coin purse, returning updated coin counts */
  function deductSp(
    current: { gp: number; sp: number; cp: number },
    amountSp: number,
  ): { gp: number; sp: number; cp: number } {
    // Work in CP to avoid floating-point drift
    const totalCp = current.gp * 200 + current.sp * 10 + current.cp;
    const costCp = Math.round(amountSp * 10);
    const remainCp = Math.max(0, totalCp - costCp);
    const gp = Math.floor(remainCp / 200);
    const spRem = Math.floor((remainCp % 200) / 10);
    const cp = remainCp % 10;
    return { gp, sp: spRem, cp };
  }

  async function handleRestock(forceConfirm = false) {
    const totalSp = restockTotalSp();
    if (totalSp === 0) return;
    const available = totalSpOnHand(coins);
    if (totalSp > available && !forceConfirm) {
      setRestockError('insufficient');
      return;
    }
    setRestockLoading(true);
    setRestockError('');
    try {
      for (const entry of RESTOCK_ITEMS) {
        const qty = restockQtys[entry.name] ?? 0;
        if (qty <= 0) continue;
        const totalQty = qty * entry.unit;
        const existing = items.find(
          i => i.item_name.toLowerCase() === entry.name.toLowerCase(),
        );
        if (existing) {
          const newQty = existing.quantity + totalQty;
          await supabase.from('character_inventory').update({ quantity: newQty }).eq('id', existing.id);
          setItems(prev => prev.map(i => i.id === existing.id ? { ...i, quantity: newQty } : i));
        } else {
          const payload = {
            character_id: characterId,
            item_name: entry.name,
            item_type: entry.category === 'ammo' ? 'consumable' : 'gear',
            quantity: totalQty,
            weight_coins: 0,
            location: 'stowed',
          };
          const { data, error } = await supabase
            .from('character_inventory')
            .insert(payload)
            .select()
            .single();
          if (!error && data) {
            setItems(prev => [
              ...prev,
              {
                ...(data as DBInventoryItem),
                location: ((data as Record<string, unknown>).location as DBInventoryItem['location']) ?? 'stowed',
              },
            ]);
          }
        }
      }
      if (totalSp > 0) {
        const newCoins = deductSp(coins, totalSp);
        await saveCoins(newCoins);
        setCoins(newCoins);
      }
      setRestockQtys({});
      setRestockSuccess(true);
      setTimeout(() => {
        setRestockSuccess(false);
        setShowRestock(false);
      }, 1500);
    } catch {
      setRestockError('error');
    }
    setRestockLoading(false);
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

  const filteredCatalog = catalogItems.filter(c =>
    catalogSearch.length < 2 || c.name.toLowerCase().includes(catalogSearch.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Encumbrance + Speed */}
      <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '0.875rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.625rem' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Carried Weight (Equipped + Stowed)</div>
            <div style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--color-text)' }}>{totalWeight} / 800 coins</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Speed</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: speedColor }}>{speed}′</div>
          </div>
        </div>
        <div style={{ height: '8px', borderRadius: '4px', backgroundColor: 'var(--color-border)', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${weightPct * 100}%`,
            backgroundColor: speedColor,
            borderRadius: '4px',
            transition: 'width 0.3s, background-color 0.3s',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.35rem', fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>
          {[{ w: 400, s: 40 }, { w: 600, s: 30 }, { w: 800, s: 20 }].map(({ w, s }) => (
            <span key={w} style={{ color: totalWeight >= w ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
              {w}¢→{s}′
            </span>
          ))}
        </div>
      </div>

      {/* Coins */}
      <section>
        <h3 style={sectionHead}>Coins on Hand</h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['gp', 'sp', 'cp'] as const).map(coin => (
            <div key={coin} style={{ flex: 1, backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '0.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.65rem', color: coin === 'gp' ? 'var(--color-gold)' : 'var(--color-text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>{coin}</span>
              <input
                type="number"
                min={0}
                value={coins[coin]}
                onChange={e => handleCoinChange(coin, e.target.value)}
                disabled={!isOwner}
                style={{ width: '100%', textAlign: 'center', backgroundColor: 'transparent', border: 'none', color: 'var(--color-text)', fontSize: '1.1rem', fontWeight: '700', minHeight: '44px' }}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Bank Balance */}
      <section>
        <div style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '10px',
          padding: '0.875rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.25rem' }}>🏦</span>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>In the Bank</div>
                <div style={{ fontSize: '1.1rem', fontWeight: '700', color: bankBalance > 0 ? 'var(--color-gold)' : 'var(--color-text-muted)' }}>
                  {bankBalance} gp
                </div>
              </div>
            </div>
            {isOwner && (
              <button
                onClick={() => { setShowDeposit(d => !d); setDepositError(''); setDepositAmount(''); setDepositDesc(''); }}
                style={{
                  padding: '0.4rem 0.875rem',
                  backgroundColor: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px', cursor: 'pointer',
                  fontSize: '0.8rem', fontWeight: '600',
                  color: 'var(--color-primary)', minHeight: '44px',
                }}
              >
                {showDeposit ? 'Cancel' : '⬆ Deposit'}
              </button>
            )}
          </div>

          {showDeposit && (
            <div style={{ marginTop: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.625rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.875rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.2rem' }}>Amount (gp)</label>
                  <input
                    type="number" min={1} max={coins.gp}
                    value={depositAmount}
                    onChange={e => setDepositAmount(e.target.value)}
                    placeholder="0"
                    style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.9rem', minHeight: '40px', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ flex: 2 }}>
                  <label style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.2rem' }}>Note (optional)</label>
                  <input
                    type="text"
                    value={depositDesc}
                    onChange={e => setDepositDesc(e.target.value)}
                    placeholder="e.g. Storing quest reward"
                    style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.9rem', minHeight: '40px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              {depositError && (
                <div style={{ fontSize: '0.78rem', color: 'var(--color-danger)' }}>{depositError}</div>
              )}
              <button
                onClick={handleDeposit}
                disabled={depositLoading || !depositAmount}
                style={{
                  padding: '0.5rem', borderRadius: '8px', border: 'none',
                  backgroundColor: 'var(--color-primary)', color: 'white',
                  fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer',
                  opacity: depositLoading || !depositAmount ? 0.55 : 1, minHeight: '40px',
                }}
              >
                {depositLoading ? 'Depositing…' : `Deposit ${depositAmount || '0'} gp →`}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Restock button + Item list */}
      {isOwner && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-0.75rem' }}>
          <button
            onClick={() => {
              setShowRestock(true);
              setRestockError('');
              setRestockSuccess(false);
              setRestockQtys({});
            }}
            style={{
              padding: '0.375rem 0.875rem', borderRadius: '8px',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)', color: 'var(--color-primary)',
              fontSize: '0.82rem', fontWeight: '700', cursor: 'pointer',
              minHeight: '44px', display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
            }}
          >
            🛒 Restock
          </button>
        </div>
      )}

      {/* Item list — grouped by location */}
      {(['equipped', 'stowed', 'tiny'] as const).map(loc => {
        const locItems = items.filter(i => i.location === loc);
        if (locItems.length === 0) return null;
        return (
          <section key={loc}>
            <h3 style={sectionHead}>{LOCATION_LABELS[loc]} ({locItems.length})</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {locItems.map(item => (
                <div key={item.id} style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '0.625rem 0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.item_name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                      {item.item_type}
                      {item.weapon_damage_dice ? ` · ${item.weapon_damage_dice}` : ''}
                      {item.armor_ac_bonus != null ? ` · AC ${item.armor_ac_bonus}` : ''}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.75rem', backgroundColor: 'var(--color-bg)', borderRadius: '4px', padding: '2px 6px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>×{item.quantity}</span>
                  {loc !== 'tiny' && (
                    <span style={{ fontSize: '0.75rem', backgroundColor: 'var(--color-bg)', borderRadius: '4px', padding: '2px 6px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                      {item.weight_coins * item.quantity}¢
                    </span>
                  )}
                  {isOwner && (
                    <button
                      onClick={() => toggleLocation(item)}
                      title="Cycle location: stowed → equipped → tiny"
                      style={{ background: 'none', border: '1px solid var(--color-border)', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '0.7rem', padding: '0.2rem 0.375rem', borderRadius: '4px', minHeight: '44px', whiteSpace: 'nowrap' }}
                    >
                      {item.location === 'equipped' ? '⚔️' : item.location === 'stowed' ? '🎒' : '🔮'}
                    </button>
                  )}
                  {isOwner && (
                    <button
                      onClick={() => deleteItem(item.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontSize: '1rem', padding: '0.25rem', minHeight: '44px', minWidth: '44px' }}
                      aria-label={`Delete ${item.item_name}`}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {items.length === 0 && !showAddForm && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '2rem 0' }}>
          No equipment yet. Tap ⊕ to add items.
        </p>
      )}

      {/* Add item form */}
      {showAddForm && (
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
                  {ITEM_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
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
              {newItem.item_type === 'armour' && (
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
      )}

      {/* FAB — only for owner */}
      {isOwner && (
        <button
          onClick={() => { setShowAddForm(o => !o); if (!showAddForm) setAddMode('custom'); }}
          style={{
            position: 'fixed', bottom: '96px', right: '1.25rem',
            width: '56px', height: '56px', borderRadius: '50%',
            backgroundColor: showAddForm ? 'var(--color-border)' : 'var(--color-primary)', color: 'white',
            border: 'none', cursor: 'pointer',
            fontSize: '1.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)', zIndex: 40,
          }}
          aria-label={showAddForm ? 'Close add item' : 'Add inventory item'}
        >
          {showAddForm ? '✕' : '⊕'}
        </button>
      )}

      {/* Restock bottom-sheet modal */}
      {showRestock && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            backgroundColor: 'rgba(0,0,0,0.55)',
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          }}
          onClick={e => { if (e.target === e.currentTarget) setShowRestock(false); }}
        >
          <div style={{
            backgroundColor: 'var(--color-surface)',
            borderTopLeftRadius: '20px', borderTopRightRadius: '20px',
            border: '1px solid var(--color-border)',
            maxHeight: '85vh', display: 'flex', flexDirection: 'column',
          }}>
            {/* Sheet header */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '1rem 1.25rem 0.75rem',
              borderBottom: '1px solid var(--color-border)',
            }}>
              <div>
                <div style={{ fontFamily: 'var(--font-display), Georgia, serif', fontSize: '1.1rem', fontWeight: '700', color: 'var(--color-text)' }}>
                  🛒 Restock Supplies
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.125rem' }}>
                  You have: {coins.gp} GP, {coins.sp} SP{coins.cp > 0 ? `, ${coins.cp} CP` : ''}
                  {' '}≈ {totalSpOnHand(coins).toFixed(1)} SP total
                </div>
              </div>
              <button
                onClick={() => setShowRestock(false)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--color-text-muted)', fontSize: '1.4rem',
                  padding: '0.25rem', minHeight: '44px', minWidth: '44px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                aria-label="Close restock"
              >✕</button>
            </div>

            {/* Item rows */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '0.75rem 1.25rem' }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr auto auto auto',
                gap: '0.5rem', alignItems: 'center',
                paddingBottom: '0.5rem', borderBottom: '1px solid var(--color-border)',
                marginBottom: '0.5rem',
                fontSize: '0.65rem', color: 'var(--color-text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                <span>Item</span>
                <span style={{ textAlign: 'right' }}>Price</span>
                <span style={{ textAlign: 'center', minWidth: '90px' }}>Qty</span>
                <span style={{ textAlign: 'right', minWidth: '48px' }}>Total</span>
              </div>

              {RESTOCK_ITEMS.map(entry => {
                const qty = restockQtys[entry.name] ?? 0;
                const subtotal = qty * entry.priceSp;
                const fmtSp = (sp: number) =>
                  sp >= 1
                    ? `${sp.toFixed(sp % 1 === 0 ? 0 : 1)} sp`
                    : `${Math.round(sp * 10)} cp`;
                return (
                  <div key={entry.name} style={{
                    display: 'grid', gridTemplateColumns: '1fr auto auto auto',
                    gap: '0.5rem', alignItems: 'center',
                    padding: '0.5rem 0',
                    borderBottom: '1px solid color-mix(in srgb, var(--color-border) 50%, transparent)',
                  }}>
                    <div>
                      <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text)' }}>{entry.name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>×{entry.unit} per purchase</div>
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', textAlign: 'right' }}>
                      {fmtSp(entry.priceSp)}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', minWidth: '90px', justifyContent: 'center' }}>
                      <button
                        onClick={() => setRestockQtys(q => ({ ...q, [entry.name]: Math.max(0, (q[entry.name] ?? 0) - 1) }))}
                        disabled={qty <= 0}
                        style={{
                          width: '32px', height: '44px', borderRadius: '6px',
                          border: '1px solid var(--color-border)',
                          backgroundColor: 'var(--color-bg)', color: 'var(--color-text)',
                          fontSize: '1rem', cursor: 'pointer',
                          opacity: qty <= 0 ? 0.35 : 1,
                        }}
                        aria-label={`Decrease ${entry.name}`}
                      >−</button>
                      <span style={{
                        minWidth: '2ch', textAlign: 'center',
                        fontSize: '1rem', fontWeight: '700',
                        color: qty > 0 ? 'var(--color-text)' : 'var(--color-text-muted)',
                        fontVariantNumeric: 'tabular-nums',
                      }}>{qty}</span>
                      <button
                        onClick={() => setRestockQtys(q => ({ ...q, [entry.name]: (q[entry.name] ?? 0) + 1 }))}
                        style={{
                          width: '32px', height: '44px', borderRadius: '6px',
                          border: '1px solid var(--color-border)',
                          backgroundColor: 'var(--color-bg)', color: 'var(--color-text)',
                          fontSize: '1rem', cursor: 'pointer',
                        }}
                        aria-label={`Increase ${entry.name}`}
                      >+</button>
                    </div>
                    <span style={{
                      fontSize: '0.82rem', fontWeight: qty > 0 ? '700' : '400',
                      color: qty > 0 ? 'var(--color-gold)' : 'var(--color-text-muted)',
                      textAlign: 'right', minWidth: '48px', whiteSpace: 'nowrap',
                    }}>
                      {subtotal > 0 ? fmtSp(subtotal) : '—'}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div style={{
              padding: '0.875rem 1.25rem 1.25rem',
              borderTop: '1px solid var(--color-border)',
              display: 'flex', flexDirection: 'column', gap: '0.625rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Total</span>
                <span style={{
                  fontSize: '1.1rem', fontWeight: '700',
                  fontFamily: 'var(--font-display), Georgia, serif',
                  color: restockTotalSp() > totalSpOnHand(coins) ? 'var(--color-danger)' : 'var(--color-gold)',
                }}>
                  {restockTotalSp() >= 1
                    ? `${restockTotalSp().toFixed(restockTotalSp() % 1 === 0 ? 0 : 2)} sp`
                    : restockTotalSp() > 0
                      ? `${Math.round(restockTotalSp() * 10)} cp`
                      : '0 sp'}
                </span>
              </div>

              {restockError === 'insufficient' && (
                <div style={{
                  padding: '0.625rem', borderRadius: '8px',
                  backgroundColor: 'color-mix(in srgb, var(--color-danger) 12%, var(--color-bg))',
                  border: '1px solid var(--color-danger)',
                  fontSize: '0.82rem', color: 'var(--color-danger)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem',
                }}>
                  <span>⚠️ Not enough coin ({totalSpOnHand(coins).toFixed(1)} sp available)</span>
                  <button
                    onClick={() => handleRestock(true)}
                    style={{
                      padding: '0.25rem 0.625rem', borderRadius: '6px',
                      border: '1px solid var(--color-danger)',
                      backgroundColor: 'transparent', color: 'var(--color-danger)',
                      fontSize: '0.78rem', cursor: 'pointer', whiteSpace: 'nowrap', minHeight: '44px',
                    }}
                  >
                    Proceed anyway
                  </button>
                </div>
              )}

              {restockError === 'error' && (
                <div style={{ fontSize: '0.82rem', color: 'var(--color-danger)' }}>
                  Something went wrong. Please try again.
                </div>
              )}

              {restockSuccess ? (
                <div style={{
                  padding: '0.875rem', borderRadius: '10px', textAlign: 'center',
                  backgroundColor: 'color-mix(in srgb, var(--color-primary) 15%, var(--color-bg))',
                  color: 'var(--color-primary)', fontWeight: '700', fontSize: '1rem',
                }}>
                  ✓ Restocked!
                </div>
              ) : (
                <button
                  onClick={() => handleRestock(false)}
                  disabled={restockLoading || restockTotalSp() === 0}
                  style={{
                    padding: '0.875rem', borderRadius: '10px', border: 'none',
                    backgroundColor: 'var(--color-primary)', color: 'white',
                    fontWeight: '700', fontSize: '1rem', cursor: 'pointer',
                    minHeight: '44px',
                    opacity: restockLoading || restockTotalSp() === 0 ? 0.5 : 1,
                  }}
                >
                  {restockLoading
                    ? 'Restocking…'
                    : `Restock (${
                        restockTotalSp() >= 1
                          ? `${restockTotalSp().toFixed(restockTotalSp() % 1 === 0 ? 0 : 2)} sp`
                          : `${Math.round(restockTotalSp() * 10)} cp`
                      })`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
