'use client';
import { WeightBar } from './inventory/WeightBar';
import { CoinPurse } from './inventory/CoinPurse';
import { BankPanel } from './inventory/BankPanel';
import { ItemList } from './inventory/ItemList';
import { AddItemForm } from './inventory/AddItemForm';
import { RestockSheet } from './inventory/RestockSheet';
import { useInventory } from './inventory/use-inventory';
import { useAddItem } from './inventory/use-add-item';
import { useRestock } from './inventory/use-restock';

interface Props {
  characterId: string;
  ownerId: string;
  readOnly?: boolean;
}

export function InventoryTab({ characterId, ownerId, readOnly = false }: Props) {
  const inv = useInventory(characterId);

  const addItemCtl = useAddItem({
    supabase: inv.supabase,
    characterId,
    onItemAdded: item => inv.setItems(prev => [...prev, item]),
  });

  const restock = useRestock({
    supabase: inv.supabase,
    characterId,
    items: inv.items,
    setItems: inv.setItems,
    coins: inv.coins,
    setCoins: inv.setCoins,
    saveCoins: inv.saveCoins,
  });

  const isOwner = !readOnly && inv.currentUserId === ownerId;

  if (inv.loading) {
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
      {/* Encumbrance + Speed */}
      <WeightBar items={inv.items} />

      {/* Coins */}
      <CoinPurse coins={inv.coins} isOwner={isOwner} onCoinChange={inv.handleCoinChange} />

      {/* Bank Balance */}
      <BankPanel
        supabase={inv.supabase}
        characterId={characterId}
        bankBalance={inv.bankBalance}
        coinsGp={inv.coins.gp}
        isOwner={isOwner}
        onDeposited={async newGp => {
          inv.setCoins(c => ({ ...c, gp: newGp }));
          await inv.fetchBankBalance();
        }}
      />

      {/* Restock button + Item list */}
      {isOwner && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-0.75rem' }}>
          <button
            onClick={restock.openRestock}
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
      <ItemList
        items={inv.items}
        isOwner={isOwner}
        onToggleLocation={inv.toggleLocation}
        onDelete={inv.deleteItem}
      />

      {inv.items.length === 0 && !addItemCtl.showAddForm && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '2rem 0' }}>
          No equipment yet. Tap ⊕ to add items.
        </p>
      )}

      {/* Add item form */}
      {addItemCtl.showAddForm && <AddItemForm controller={addItemCtl} />}

      {/* FAB — only for owner */}
      {isOwner && (
        <button
          onClick={() => { addItemCtl.setShowAddForm(o => !o); if (!addItemCtl.showAddForm) addItemCtl.setAddMode('custom'); }}
          style={{
            position: 'fixed', bottom: '96px', right: '1.25rem',
            width: '56px', height: '56px', borderRadius: '50%',
            backgroundColor: addItemCtl.showAddForm ? 'var(--color-border)' : 'var(--color-primary)', color: 'white',
            border: 'none', cursor: 'pointer',
            fontSize: '1.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)', zIndex: 40,
          }}
          aria-label={addItemCtl.showAddForm ? 'Close add item' : 'Add inventory item'}
        >
          {addItemCtl.showAddForm ? '✕' : '⊕'}
        </button>
      )}

      {/* Restock bottom-sheet modal */}
      {restock.showRestock && <RestockSheet coins={inv.coins} controller={restock} />}
    </div>
  );
}
