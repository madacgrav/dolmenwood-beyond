'use client';
import { useMemo } from 'react';
import type { Character } from '@dolmenwood/types';
import { getSpellSlots, isSpellcaster, classHasRunes, getMagicalKindredTraits, getSpellsForClass, pickRandom } from '@dolmenwood/rules-engine';
import type { DBSpell } from '@/lib/api/spells';
import { SpellSlotsSection } from './magic/SpellSlotsSection';
import { PreparedSpellsSection } from './magic/PreparedSpellsSection';
import { SpellBookSection } from './magic/SpellBookSection';
import { RunesSection } from './magic/RunesSection';
import { KindredAbilitiesSection } from './magic/KindredAbilitiesSection';
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
  const magicalTraits = getMagicalKindredTraits(character.kindred);

  const magic = useSpells({ characterId, spellcaster, isGlamour, slotsData, readOnly, hasKindredMagic: magicalTraits.length > 0 });

  // Legacy entries (no kind) infer glamour from the spell_level 0 sentinel.
  const entryKind = (s: DBSpell) => s.kind ?? (s.spell_level === 0 ? 'glamour' : 'spell');
  const runeEntries = magic.spells.filter(s => s.kind === 'rune');
  const glamourEntries = magic.spells.filter(s => entryKind(s) === 'glamour');
  const spellEntries = magic.spells.filter(s => entryKind(s) === 'spell');
  // Fallback: pre-existing Elf/Grimalkin glamours were stored as kind 'glamour' via the old
  // innate-glamour section — for non-Enchanters, surface the first one as the kindred glamour.
  const kindredGlamourEntry =
    magic.spells.find(s => s.kind === 'kindred-glamour') ??
    (!isGlamour ? glamourEntries[0] ?? null : null);

  // Valid spell ranks the class can learn at current level
  const validRanks: number[] = useMemo(() => {
    if (!slotsData || isGlamour) return [];
    return Object.keys(slotsData)
      .map(Number)
      .filter(r => !isNaN(r));
  }, [slotsData, isGlamour]);

  if (!spellcaster && magicalTraits.length === 0) {
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

      {/* ── Section 0: Kindred Abilities (quasi-magical kindred traits) ── */}
      {magicalTraits.length > 0 && (
        <KindredAbilitiesSection
          kindred={character.kindred}
          traits={magicalTraits}
          readOnly={readOnly}
          kindredGlamour={kindredGlamourEntry}
          onRollGlamour={() => {
            const name = pickRandom(getSpellsForClass('Enchanter').map(s => s.name));
            return name ? magic.addSpell(0, name, 'kindred-glamour') : Promise.resolve(false);
          }}
          onPickGlamour={name => magic.addSpell(0, name, 'kindred-glamour')}
          onDelete={magic.deleteSpell}
        />
      )}

      {/* ── Section 1: Spell Slots / Glamour Circles (casters only) ── */}
      {spellcaster && (
        <SpellSlotsSection
          isGlamour={isGlamour}
          slotsData={slotsData}
          level={character.level}
          dbSlots={magic.dbSlots}
          readOnly={readOnly}
          onToggleSlot={magic.toggleSlot}
          onRest={magic.handleRest}
        />
      )}

      {/* ── Section 2: Today's Prepared Spells (slot casters only) ── */}
      {spellcaster && !isGlamour && (
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

      {/* ── Section 3: Spell Book (slot casters only) ── */}
      {spellcaster && !isGlamour && (
        <SpellBookSection
          characterClass={character.characterClass}
          isGlamour={false}
          validRanks={validRanks}
          spells={spellEntries}
          readOnly={readOnly}
          onAdd={(rank, name) => magic.addSpell(rank, name, 'spell')}
          onToggleMemorized={magic.toggleMemorized}
          onDelete={magic.deleteSpell}
        />
      )}

      {/* ── Section 3b: Glamours Known (Enchanter class glamours) ── */}
      {isGlamour && (
        <SpellBookSection
          characterClass={character.characterClass}
          isGlamour={true}
          validRanks={[]}
          spells={glamourEntries}
          readOnly={readOnly}
          onAdd={(rank, name) => magic.addSpell(rank, name, 'glamour')}
          onToggleMemorized={magic.toggleMemorized}
          onDelete={magic.deleteSpell}
        />
      )}

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
