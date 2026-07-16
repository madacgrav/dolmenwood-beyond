'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchCharacterWithNotes, updateCharacter, deleteCharacter, adjustXP } from '@/lib/api/characters';
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

export default function CharacterSheetPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const [character, setCharacter] = useState<CharacterWithNotes | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabName>('stats');
  const [editMode, setEditMode] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchCharacter = useCallback(async () => {
    const mapped = await fetchCharacterWithNotes(id);
    if (!mapped) {
      router.push('/characters');
      return;
    }
    setCharacter(mapped);
    setLoading(false);
  }, [id, router]);

  useEffect(() => { fetchCharacter(); }, [fetchCharacter]);
  // Re-fetch on tab switch so AC reflects items equipped/unequipped in the
  // Inventory tab (matches the old per-mount fetch CombatTab did itself).
  useEffect(() => { listInventory(id).then(setItems); }, [id, activeTab]);

  async function handleUpdate(updates: Partial<CharacterWithNotes>) {
    if (!character) return;
    setCharacter(prev => prev ? { ...prev, ...updates } : prev);
    await updateCharacter(character.id, updates);
  }

  async function handleAdjustXP(newTotal: number) {
    if (!character) return;
    setCharacter(prev => prev ? { ...prev, xp: newTotal } : prev);
    await adjustXP(character.id, newTotal);
  }

  async function handleDeleteConfirm() {
    if (!character) return;
    setDeleting(true);
    setDeleteError(null);
    const error = await deleteCharacter(character.id);
    setDeleting(false);
    if (error) {
      setDeleteError('Failed to delete character. Please try again.');
    } else {
      router.push('/characters');
    }
  }

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

  const tabs: { id: TabName; label: string }[] = [
    { id: 'stats', label: 'Stats' },
    { id: 'combat', label: 'Combat' },
    { id: 'inventory', label: 'Inventory' },
    { id: 'magic', label: 'Magic' },
    { id: 'notes', label: 'Notes' },
  ];

  return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: '100dvh', paddingBottom: '5rem' }}>
      <CharacterSheetHeader
        character={character}
        editMode={editMode}
        onToggleEdit={() => setEditMode(e => !e)}
        onUpdate={handleUpdate}
        onAdjustXP={handleAdjustXP}
        onBack={() => router.push('/characters')}
        onDelete={() => { setDeleteError(null); setShowDeleteConfirm(true); }}
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
        {activeTab === 'stats' && <StatsTab character={character} acBreakdown={acBreakdown} editMode={editMode} onUpdate={handleUpdate} />}
        {activeTab === 'combat' && <CombatTab character={character} characterId={id} acBreakdown={acBreakdown} />}
        {activeTab === 'inventory' && <InventoryTab characterId={id} ownerId={character.ownerId} />}
        {activeTab === 'magic' && <MagicTab character={character} characterId={id} />}
        {activeTab === 'notes' && <NotesTab character={character} onUpdate={handleUpdate} />}
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
                onClick={handleDeleteConfirm}
                disabled={deleting}
                style={{ flex: 1, padding: '0.75rem', backgroundColor: 'var(--color-danger)', border: 'none', borderRadius: '8px', cursor: deleting ? 'not-allowed' : 'pointer', color: 'white', fontWeight: '600', minHeight: '44px', opacity: deleting ? 0.7 : 1 }}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
