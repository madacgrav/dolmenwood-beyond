# Design Discussion

## Current State

- **"Randomly determined glamour" is unimplemented flavor text.** `kindreds.json:126-128,205-207` (Elf, Grimalkin) says "Knows one randomly determined glamour" but no code rolls or assigns one. Only path: manual `AddSpellForm.tsx` — select from Enchanter's 22-glamour list (`spells.json:29`) or free text, persisted as `SpellbookEntryDoc` with `kind:'glamour'` via `applyMagicOp` (`lib/data/spells.ts:137-153`).
- **Character creation persists nothing magical.** `newCharacterToDoc` (`lib/data/mappers/character.ts:100-141`) writes `spellbook: []`, `traits: null`. No wizard step imports spell code. Auto finalize seeds only inventory/gold (`auto/complete/page.tsx:17-53,88`); manual finalize seeds nothing.
- **Kindred quasi-magical abilities are display-only.** Shape-Shifting (Grimalkin), Mad Revelry (Woodgrue), Knacks (Mossling) exist as `{name, description}` entries in `kindreds.json`, rendered only in wizard Step2/Step6. The rules engine has exactly one trait-name hook: `hasInnateGlamours` (`kindreds.ts:65-67`) string-matching `'Glamours'`.
- **Magic tab empty state is wrong for Woodgrue/Mossling.** `MagicTab.tsx:40-47`: non-caster without `innateGlamours` → "This class has no magical abilities." A non-caster Woodgrue (Mad Revelry) or Mossling (Knacks) hits this despite having quasi-magical kindred abilities.
- **Innate vs class glamours are indistinguishable in storage.** `kind: 'spell'|'glamour'|'rune'` — an Elf Enchanter's rolled kindred glamour and learned class glamours would merge into one list.
- **Tab label** `'Magic'` defined in 2 duplicated arrays: `characters/[id]/page.tsx:109` and `characters/[id]/view/page.tsx:91`. No URL/test coupling.
- **Source data available:** Mossling Knacks table extracted from `Dolmenwood_Player_s_Book.pdf` p112-113 — d6: Bird Friend, Lock Singer, Root Friend, Thread Whistling, Wood Kenning, Yeast Master; each grants abilities at Levels 1, 3, 5, 7 (full ability text captured during design).

## Desired End State

1. **Random kindred glamour at creation (auto mode):** Elf/Grimalkin characters finish the auto wizard with one randomly rolled glamour (from the same 22-glamour list as Enchanter) persisted as a kindred glamour, listed separately from Enchanter learned glamours.
2. **Random knack at creation (auto mode):** Mossling characters finish with one randomly rolled knack (d6) persisted.
3. **Roll/pick on Magic tab (existing + manual characters):** Elf/Grimalkin with no kindred glamour see a "Kindred Glamour" section with a 🎲 Roll button *and* a pick dropdown (the manual override). Mossling with no knack: same pattern with the 6 knacks. Delete-and-re-add allows changing.
4. **Kindred Abilities section:** Magic tab shows a section listing the character's quasi-magical kindred traits (Glamours, Shape-Shifting, Mad Revelry, Knacks) with name + description from `kindreds.json`. Knack entries additionally show the knack's per-level abilities (Level 1/3/5/7), with abilities at or below character level highlighted.
5. **Empty state fixed:** non-caster Woodgrue/Mossling/Elf/Grimalkin no longer see "no magical abilities."
6. **Tab renamed** to "Magic and Abilities" (label only; id stays `'magic'`).

Verify: create auto Elf → sheet shows 1 kindred glamour; create auto Mossling → 1 knack with level abilities; open pre-existing Elf with no glamour → roll/pick UI appears; non-caster Woodgrue → Mad Revelry listed, no empty state; Enchanter Grimalkin → kindred glamour section separate from Glamours Known.

## Patterns to Follow

- **Trait-name hooks in rules-engine:** follow `hasInnateGlamours` (`kindreds.ts:65-67`) — add helpers beside it (e.g. `hasKnacks`, `getMagicalKindredTraits`) keyed on trait-name constants.
- **Static JSON data + accessor:** follow `spells.json`/`getSpellsForClass` (`spells.ts:17-36`) and `runes.json`/`getRunesForClass` for the new `knacks.json` + accessor.
- **Dice:** use `rollDie(6)` / list-pick via rules-engine `dice.ts:1-44`. Do NOT copy the inline raw `Math.random()` pattern from `Step8Equipment.tsx:51,67` (flagged duplication).
- **Persistence:** reuse the existing magic op stack unchanged in shape — `insertCharacterSpell` (`lib/api/spells.ts:117-122`) → `applyMagicOp` `addSpell` case (`lib/data/spells.ts:137-153`) → `SpellbookEntryDoc` embedded array. Runes precedent (`kind:'rune'`, rank 0, `MagicTab.tsx:118-126`) shows non-spell entries already ride this rail.
- **Creation seeding:** follow `seedInventory` (`auto/complete/page.tsx:17-53`) — best-effort post-create seeding from the complete page, errors logged and skipped, character exists either way.
- **Section components:** follow `RunesSection.tsx` / `SpellBookSection.tsx` structure for new sections; gate logic lives in `MagicTab.tsx`.
- **Do NOT** introduce a new Cosmos container or character-doc field for knacks/kindred glamours — the `spellbook` array + `kind` discriminator covers it.

## Design Decisions

1. **Glamour pool = Enchanter list** — roll uniformly over the 22 names in `spells.json` Enchanter.glamours. No new glamour data file. (User-confirmed.)
2. **Storage discriminator: extend `kind` union** with `'kindred-glamour'` and `'knack'` → `kind: 'spell'|'glamour'|'rune'|'kindred-glamour'|'knack'`. Touch points: server allowlist (`lib/data/spells.ts:141`), `SpellbookEntryDoc` (`cosmos/types.ts:73-81`), `DBSpell` (`lib/api/spells.ts:34`), `MagicTab` filters. Keeps kindred glamour listed separately from Enchanter learned glamours (user-confirmed requirement) without a new field; legacy inference (`MagicTab.tsx:27`) untouched.
3. **Seeding: auto mode only, at complete page** — after `createCharacter`, roll + `insertCharacterSpell` for Elf/Grimalkin glamour and Mossling knack, `seedInventory`-style best-effort. Manual mode seeds nothing; manual-created characters use the tab's pick/roll UI (the "override", user-confirmed). This also covers all pre-existing characters.
4. **New rules-engine module `knacks.ts` + `data/knacks.json`** — 6 knacks with `{name, description, abilities: [{level, name, description}]}` from Player's Book p112-113. Accessors: `getKnacks()`, `getKnack(name)`. New kindred helpers in `kindreds.ts`: `hasKnacks(kindred)` (trait name `'Knacks'`) and `getMagicalKindredTraits(kindred)` filtering to the set {Glamours, Shape-Shifting, Mad Revelry, Knacks}.
5. **Magic tab changes:**
   - Empty-state gate: `!spellcaster && getMagicalKindredTraits(kindred).length === 0`.
   - New "Kindred Abilities" section: renders `getMagicalKindredTraits` name+description cards; for Knacks, embeds the selected knack (from spellbook `kind:'knack'` entry) with per-level abilities; for Glamours, shows the rolled kindred glamour (from `kind:'kindred-glamour'` entry) with roll/pick UI when absent.
   - Existing glamour `SpellBookSection` gate changes from `isGlamour || innateGlamours` to `isGlamour` only (Enchanter learned glamours); kindred glamour moves to the new section.
   - `use-spells.ts:100` load gate widens to include magical-kindred characters.
6. **Roll UI = one-shot roll button + dropdown fallback** — no animation requirement; reuse `AddSpellForm`-style select for the pick path.
7. **Tab label** → `'Magic and Abilities'` in both `characters/[id]/page.tsx:109` and `view/page.tsx:91` (id `'magic'` unchanged — API route path and sw.js untouched). Update `README.md:8` and `.github/copilot-instructions.md:38,76` labels in passing.

## What We're NOT Doing

- Not fixing manual-mode `seedInventory` omission (user: out of scope).
- Not adding a rulebook-specific random-glamour table distinct from the Enchanter list.
- Not implementing mechanics/automation for Shape-Shifting or Mad Revelry (display-only cards; no transform tracking, no 1/day counters).
- Not enumerating Mad Revelry's seven effects or Shape-Shifting forms beyond the existing `kindreds.json` descriptions.
- Not handling Symbiotic Flesh (Mossling per-level random trait table) — separate feature.
- Not migrating legacy glamour entries (no-`kind`, `spellLevel 0`) to `kindred-glamour`; they stay in the Enchanter-style glamour list.
- Not sharing/extracting the duplicated tabs arrays across edit/view pages; label edited in both places.
- Not renaming the `'magic'` tab id, API route, or component/file names.
- Not adding tab UI tests or URL tab sync.

## Open Risks

- Rulebook may intend a specific d20/d30 glamour sub-table for kindred glamours rather than uniform-over-22; user confirmed Enchanter list is acceptable.
- Elf/Grimalkin Enchanter edge case: kindred glamour could duplicate a learned glamour name. Accepted — sections are separate; no dedup logic.
- PDF-export (`lib/pdf/character-sheet.ts`) renders spellbook entries; new `kind` values may need a pass so knacks/kindred glamours print sensibly — check during implementation.
- `entryKind` legacy inference and new kinds must not collide: new entries always carry explicit `kind`, so inference path only fires for legacy docs.
- Knack per-level ability display depends on `character.level` already being available in `MagicTab` props (it is — used for `getSpellSlots`).
