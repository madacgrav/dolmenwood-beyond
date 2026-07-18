'use client';
import { useMemo } from 'react';
import type { Character } from '@dolmenwood/types';
import { getSpellSlots, isSpellcaster, classHasRunes } from '@dolmenwood/rules-engine';
import { SpellSlotsSection } from './magic/SpellSlotsSection';
import { PreparedSpellsSection } from './magic/PreparedSpellsSection';
import { SpellBookSection } from './magic/SpellBookSection';
import { RunesSection } from './magic/RunesSection';
import { useSpells } from './magic/use-spells';

interface Props { character: Character; characterId: string; readOnly?: boolean; }

export function MagicTab({ character, characterId, readOnly }: Props) {
  const spellcaster = isSpellcaster(character.characterClass);
  const slotsData = useMemo(
    () => (spellcaster ? getSpellSlots(character.characterClass, character.level) : null),
    [spellcaster, character.characterClass, character.level]
  );
  const isGlamour = slotsData !== null && 'glamours' in slotsData;
  const hasRunes = classHasRunes(character.characterClass);

  const magic = useSpells({ characterId, spellcaster, isGlamour, slotsData, readOnly });

  const runeEntries = magic.spells.filter(s => s.kind === 'rune');
  const bookEntries = magic.spells.filter(s => s.kind !== 'rune');

  // Valid spell ranks the class can learn at current level
  const validRanks: number[] = useMemo(() => {
    if (!slotsData || isGlamour) return [];
    return Object.keys(slotsData)
      .map(Number)
      .filter(r => !isNaN(r));
  }, [slotsData, isGlamour]);

  if (!spellcaster) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-text-muted)' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🚫</div>
        <p style={{ fontSize: '0.95rem' }}>This class has no magical abilities.</p>
      </div>
    );
  }

  if (magic.loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: '52px', borderRadius: '8px', backgroundColor: 'var(--color-surface)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '5rem' }}>

      {/* ── Section 1: Spell Slots / Glamour Circles ── */}
      <SpellSlotsSection
        isGlamour={isGlamour}
        slotsData={slotsData}
        level={character.level}
        dbSlots={magic.dbSlots}
        readOnly={readOnly}
        onToggleSlot={magic.toggleSlot}
        onRest={magic.handleRest}
      />

      {/* ── Section 2: Today's Prepared Spells (non-Enchanter only) ── */}
      {!isGlamour && (
        <PreparedSpellsSection
          characterClass={character.characterClass}
          preparations={magic.preparations}
          ranksWithFreeSlots={magic.ranksWithFreeSlots}
          freeSlots={magic.freeSlots}
          readOnly={readOnly}
          onAdd={magic.addPreparation}
          onCast={magic.castPreparation}
          onRestore={magic.restorePreparation}
        />
      )}

      {/* ── Section 3: Spell Book / Glamours Known ── */}
      <SpellBookSection
        characterClass={character.characterClass}
        isGlamour={isGlamour}
        validRanks={validRanks}
        spells={bookEntries}
        readOnly={readOnly}
        onAdd={magic.addSpell}
        onToggleMemorized={magic.toggleMemorized}
        onDelete={magic.deleteSpell}
      />

      {/* ── Section 4: Runes Known (rune classes only) ── */}
      {hasRunes && (
        <RunesSection
          characterClass={character.characterClass}
          runes={runeEntries}
          readOnly={readOnly}
          onAdd={name => magic.addSpell(0, name, 'rune')}
          onDelete={magic.deleteSpell}
        />
      )}
    </div>
  );
}
