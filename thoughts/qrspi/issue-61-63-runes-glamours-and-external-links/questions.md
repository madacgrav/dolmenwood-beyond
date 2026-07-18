# Research Questions

## Context
Two areas of the `apps/web` app plus the `packages/rules-engine` package. First: the character-sheet Magic tab (`apps/web/src/components/character-sheet/magic/`) and the rules-engine spell/slot data and accessors (`packages/rules-engine/src/spells.ts`, `data/spells.json`, `data/spell-slots.json`, `data/class-advancement.json`, `data/kindreds.json`). Second: the app's navigation and any external-link rendering (`apps/web/src/components/layout/`, the route-group layout, the news page).

## Questions
1. Trace the full data-to-UI flow for the Magic tab: how does `getSpellSlots` produce its return shape, how does `MagicTab` derive `isGlamour` / `validRanks` from it, and how do the slots, prepared-spells, and spell-book sections consume that shape? Where exactly does the code branch between the slot-based path and the glamour path?

2. How is the glamour caster (Enchanter) modeled end to end — in `spells.json`, `spell-slots.json` (`glamoursKnownByLevel`), `class-advancement.json`, and the level-up advancement diff — and what makes glamours "unranked" throughout that pipeline compared to ranked spells?

3. What do the Magic-tab section and form components (`SpellSlotsSection`, `PreparedSpellsSection`, `SpellBookSection`, `AddSpellForm`, `PrepareSpellForm`) take as props, and which of them are already conditionally hidden or reshaped for glamour casters versus slot casters?

4. How are a character's owned magic entries persisted and mutated — the `MagicData`/`DBSpell`/`DBPreparation`/`DBSpellSlot` client types, the embedded Cosmos arrays on the character doc, the `MagicOp` union, and the `/api/characters/[id]/magic` route — and what would a new category of magic entry need to touch in that persistence layer?

5. Where in the rules data and character-creation flow are class and kindred capabilities defined (`kindreds.json` allowed-classes and innate traits, `Step2Kindred`/`Step3Class`), and how is a character's magical capability currently decided (`isSpellcaster`, `SPELLCASTING_CLASSES`) — i.e. what determines which classes or kindreds gain which kind of magic?

6. How is the app's navigation structured (`BottomNav` config array, the `(app)` route-group layout header/footer), and what is the existing convention for rendering an external link in the UI (the news page's `<a target="_blank" rel="noopener noreferrer">` pattern)?
