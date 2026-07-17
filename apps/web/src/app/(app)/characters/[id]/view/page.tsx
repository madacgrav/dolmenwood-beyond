'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchCharacterWithNotes } from '@/lib/api/characters';
import { correctXP } from '@/lib/api/campaigns';
import { listInventory, type InventoryItem } from '@/lib/api/inventory';
import { deriveCharacterAC, type ACItem } from '@dolmenwood/rules-engine';
import type { CharacterWithNotes } from '@dolmenwood/types';
import { CharacterSheetHeader } from '@/components/character-sheet/CharacterSheetHeader';
import { StatsTab } from '@/components/character-sheet/StatsTab';
import { CombatTab } from '@/components/character-sheet/CombatTab';
import { InventoryTab } from '@/components/character-sheet/InventoryTab';
import { MagicTab } from '@/components/character-sheet/MagicTab';
import { NotesTab } from '@/components/character-sheet/NotesTab';

type TabName = 'stats' | 'combat' | 'inventory' | 'magic' | 'notes';

/**
 * /characters/[id]/view — Read-only character sheet for referees.
 *
 * Access rules (enforced client-side; DB RLS enforces server-side):
 *  - If the visitor owns the character → redirect to the normal editable sheet.
 *  - If the visitor is the referee of a campaign the character belongs to → show read-only sheet.
 *  - Otherwise → redirect to /characters.
 */
export default function CharacterViewPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();

  const [character, setCharacter] = useState<CharacterWithNotes | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabName>('stats');

  const fetchCharacter = useCallback(async () => {
    // The server grants reads to the owner or a referee of the owner's
    // campaign; anyone else gets null → back to the roster.
    const [accountRes, mapped] = await Promise.all([
      fetch('/api/account'),
      fetchCharacterWithNotes(id),
    ]);
    if (!mapped) { router.push('/characters'); return; }

    const account: { id: string } | null = accountRes.ok ? await accountRes.json() : null;
    if (account && mapped.ownerId === account.id) {
      // Owners use the editable sheet.
      router.replace(`/characters/${id}`);
      return;
    }
    setCharacter(mapped);
    setLoading(false);
  }, [id, router]);

  useEffect(() => { fetchCharacter(); }, [fetchCharacter]);
  // Re-fetch on tab switch so AC stays fresh (same as the owner sheet).
  useEffect(() => { listInventory(id).then(setItems); }, [id, activeTab]);

  if (loading) {
    return (
      <div style={{ padding: '1rem', maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', backgroundColor: 'var(--color-surface)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ height: '1.25rem', borderRadius: '4px', backgroundColor: 'var(--color-surface)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            <div style={{ height: '0.875rem', width: '60%', borderRadius: '4px', backgroundColor: 'var(--color-surface)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          </div>
        </div>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ height: '60px', borderRadius: '8px', marginBottom: '0.75rem', backgroundColor: 'var(--color-surface)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        ))}
      </div>
    );
  }

  if (!character) return null;

  const acItems: ACItem[] = items.map((i) => ({
    location: i.location,
    armorAcBonus: i.armor_ac_bonus,
    isShield: i.is_shield,
    armorBulk: i.armor_bulk,
  }));
  const acBreakdown = deriveCharacterAC(character, acItems);
  const carriedWeight = items.reduce((sum, i) => i.location === 'tiny' ? sum : sum + i.weight_coins * i.quantity, 0);

  const tabs: { id: TabName; label: string }[] = [
    { id: 'stats', label: 'Stats' },
    { id: 'combat', label: 'Combat' },
    { id: 'inventory', label: 'Inventory' },
    { id: 'magic', label: 'Magic' },
    { id: 'notes', label: 'Notes' },
  ];

  // No-op update function — read-only view never persists changes
  const noopUpdate = async () => { /* read-only */ };

  // DM XP correction: no optimistic write — refetch after the server confirms.
  async function handleCorrectXP(delta: number) {
    const { error } = await correctXP(id, delta);
    if (error) { alert(error.message); return; }
    await fetchCharacter();
  }

  return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: '100dvh', paddingBottom: '5rem' }}>
      <CharacterSheetHeader
        character={character}
        editMode={false}
        onToggleEdit={() => { /* no-op */ }}
        onUpdate={noopUpdate}
        xpVariant="dm-correction"
        onCorrectXP={handleCorrectXP}
        onBack={() => router.back()}
        readOnly
      />
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        backgroundColor: 'var(--color-bg)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex', overflowX: 'auto',
        scrollbarWidth: 'none',
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: '1 0 auto',
              padding: '0.625rem 0.75rem',
              border: 'none',
              backgroundColor: 'transparent',
              color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--color-text-muted)',
              fontWeight: activeTab === tab.id ? '700' : '400',
              fontSize: '0.85rem',
              cursor: 'pointer',
              borderBottom: activeTab === tab.id ? '2px solid var(--color-primary)' : '2px solid transparent',
              minHeight: '44px',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '1rem', maxWidth: '600px', margin: '0 auto' }}>
        {activeTab === 'stats' && <StatsTab character={character} acBreakdown={acBreakdown} carriedWeight={carriedWeight} editMode={false} onUpdate={noopUpdate} readOnly />}
        {activeTab === 'combat' && <CombatTab character={character} characterId={id} acBreakdown={acBreakdown} readOnly />}
        {activeTab === 'inventory' && <InventoryTab characterId={id} ownerId={character.ownerId} readOnly />}
        {activeTab === 'magic' && <MagicTab character={character} characterId={id} readOnly />}
        {activeTab === 'notes' && <NotesTab character={character} onUpdate={noopUpdate} readOnly />}
      </div>
    </div>
  );
}
