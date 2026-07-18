# Research Questions

## Context
Focus on the character-creation wizard (`apps/web/src/components/wizard/` and the `characters/new` route tree), the rules-engine kindred and spell data/logic (`packages/rules-engine/src`), and the character-sheet Magic tab (`apps/web/src/components/character-sheet/MagicTab.tsx` and its `magic/` sub-components). Also cover how starting/derived character data is persisted on finalize.

## Questions
1. Trace the auto and manual character-creation wizard end to end: what are the steps, how is per-step state stored, and at finalize what data does the app persist (createCharacter, seedInventory, and any other seeding) — where, if anywhere, are spells, glamours, or kindred-derived abilities written?

2. How does the rules-engine model kindred traits and the `Glamours` trait specifically? Trace `getKindredTraits`, `hasInnateGlamours`, and how the kindred JSON trait entries (including Shape-Shifting, Mad Revelry, Knacks) are structured and consumed.

3. How are glamours defined and known in the rules engine — the spell/glamour data files, `getSpellsForClass`, `getSpellSlots`/`glamoursKnownByLevel`, and the distinction between the Enchanter class glamours and a kindred's single innate glamour?

4. How does a glamour or spell get added to a persisted character today? Trace the `addSpell` data operation, the `AddSpellForm` / `SpellBookSection` UI, and the `use-spells` hook — what fields are stored and what selection or randomization (if any) happens.

5. What does the Magic tab render and gate on? Trace `MagicTab.tsx`: the `spellcaster`, `isGlamour`, and `innateGlamours` conditions, the empty-state logic, and each section (spell slots, prepared, spell book, glamours, runes) — which kindreds/classes see which sections.

6. What existing patterns exist in the codebase for random/dice-driven generation during character creation (e.g. ability rolls, starting gold, random background/gear picks), and how is randomness implemented and invoked?

7. How are tab labels and the tab set for the character sheet defined and rendered, and are there other places (navigation, tests, constants) that reference the `magic` tab id or its `Magic` label string?
