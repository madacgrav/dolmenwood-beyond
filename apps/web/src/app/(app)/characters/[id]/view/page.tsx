'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Character, AbilityScores } from '@dolmenwood/types';
import { CharacterSheetHeader } from '@/components/character-sheet/CharacterSheetHeader';
import { StatsTab } from '@/components/character-sheet/StatsTab';
import { CombatTab } from '@/components/character-sheet/CombatTab';
import { InventoryTab } from '@/components/character-sheet/InventoryTab';
import { MagicTab } from '@/components/character-sheet/MagicTab';
import { NotesTab } from '@/components/character-sheet/NotesTab';

type TabName = 'stats' | 'combat' | 'inventory' | 'magic' | 'notes';
type CharacterWithNotes = Character & { notes?: string };

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
  const supabase = createClient();

  const [character, setCharacter] = useState<CharacterWithNotes | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabName>('stats');

  const fetchCharacter = useCallback(async () => {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }

    // Fetch character (RLS ensures only authorised users see it)
    const { data, error } = await supabase
      .from('characters')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) { router.push('/characters'); return; }

    const row = data as Record<string, unknown>;

    // Owner should use the editable sheet
    if (row.owner_id === user.id) {
      router.replace(`/characters/${id}`);
      return;
    }

    // Verify referee access: caller must be referee_id of a campaign
    // that contains the character's owner
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('id')
      .eq('referee_id', user.id)
      .limit(1);

    if (!campaigns || campaigns.length === 0) {
      router.push('/characters');
      return;
    }

    // Map DB row to typed Character
    const mapped: CharacterWithNotes = {
      id: row.id as string,
      ownerId: row.owner_id as string,
      name: row.name as string,
      sex: row.sex as string | undefined,
      age: row.age as string | undefined,
      height: row.height as string | undefined,
      weight: row.weight as string | undefined,
      kindred: row.kindred as Character['kindred'],
      characterClass: row.character_class as Character['characterClass'],
      alignment: row.alignment as Character['alignment'],
      moonSign: row.moon_sign as string | undefined,
      background: row.background as string | undefined,
      level: row.level as number,
      xp: row.xp as number,
      abilityScores: row.ability_scores as AbilityScores,
      hpCurrent: row.hp_current as number,
      hpMax: row.hp_max as number,
      portraitUrl: row.portrait_url as string | undefined,
      isActive: row.is_active as boolean,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
      notes: row.notes as string | undefined,
    };

    setCharacter(mapped);
    setLoading(false);
  }, [id, supabase, router]);

  useEffect(() => { fetchCharacter(); }, [fetchCharacter]);

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

  const tabs: { id: TabName; label: string }[] = [
    { id: 'stats', label: 'Stats' },
    { id: 'combat', label: 'Combat' },
    { id: 'inventory', label: 'Inventory' },
    { id: 'magic', label: 'Magic' },
    { id: 'notes', label: 'Notes' },
  ];

  // No-op update function — read-only view never persists changes
  const noopUpdate = async () => { /* read-only */ };

  return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: '100dvh', paddingBottom: '5rem' }}>
      <CharacterSheetHeader
        character={character}
        editMode={false}
        onToggleEdit={() => { /* no-op */ }}
        onUpdate={noopUpdate}
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
        {activeTab === 'stats' && <StatsTab character={character} editMode={false} onUpdate={noopUpdate} readOnly />}
        {activeTab === 'combat' && <CombatTab character={character} characterId={id} readOnly />}
        {activeTab === 'inventory' && <InventoryTab characterId={id} ownerId={character.ownerId} readOnly />}
        {activeTab === 'magic' && <MagicTab character={character} characterId={id} readOnly />}
        {activeTab === 'notes' && <NotesTab character={character} onUpdate={noopUpdate} readOnly />}
      </div>
    </div>
  );
}
