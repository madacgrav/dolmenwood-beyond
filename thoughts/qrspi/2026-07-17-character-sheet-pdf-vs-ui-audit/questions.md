# Research Questions

## Context
Focus on the character sheet UI under `apps/web/src/components/character-sheet/`
and its two host pages (`apps/web/src/app/(app)/characters/[id]/page.tsx` and
`.../view/page.tsx`), plus the `Character` / `CharacterDoc` data models in
`packages/types/src/index.ts` and `apps/web/src/lib/cosmos/types.ts`. The sheet
is split into Stats, Combat, Inventory, Magic, and Notes tabs with a shared
header. Report facts only: what each area displays and stores.

## Questions
1. What identity/header fields does the character sheet display and store (name, kindred, class, background, alignment, affiliation, moon sign, portrait, level, XP), and where is each rendered and defined in the data model?
2. In the Stats tab, what does each section render — ability scores and their modifiers, saving throws, skills, languages, and movement/speed — and what are the exact labels and underlying data fields for each?
3. In the Combat tab, what values are shown for armour class, attack, HP / max HP, hit dice, and saving throws, and how are they sourced or derived?
4. In the Inventory tab, how are items categorized and weighed (any tiny/stowed/equipped distinction, encumbrance method, total weight, weight-vs-speed), and what coin denominations does the coin purse support?
5. In the Magic tab, what spell-related data is rendered (spellbook, prepared spells, spell slots), and what character fields back it?
6. What does the Notes tab display and store, and are there any freeform text areas for character traits or general notes?
7. Which `Character` / `CharacterDoc` fields exist in the data model but are not surfaced anywhere in the sheet UI, and which UI-rendered values are computed/derived rather than stored?
