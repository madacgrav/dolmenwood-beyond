# Design Discussion

## Current State

**Magic tab (issue #61):**
- Magic type is decided purely by class via shape-sniffing: `getSpellSlots` returns `{ glamours: n }` for Enchanter (`packages/rules-engine/src/spells.ts:54-55`) or a rank map; `MagicTab.tsx:18` derives `isGlamour` via `'glamours' in slotsData`. The `'glamours'` key check repeats at 5 sites with no shared helper (`spells.ts:22`, `spells.ts:54`, `advancement.ts:116`, `MagicTab.tsx:18`, `CheckStep.tsx:127`).
- Enchanter glamours are wired end to end (data → slots → book → level-up feature). **Runes have zero representation** — the only "rune" hits in source are the "Drune" faction substring; `docs/prd.md:499-501` specs "Fairy Runes (Enchanter)" with a known-runes list.
- Spellbook entries persist as `SpellbookEntryDoc { id, spellName, spellLevel, isMemorized, notes }` (`apps/web/src/lib/cosmos/types.ts:73-79`) embedded on `CharacterDoc`; glamours use sentinel `spellLevel: 0` (`use-spells.ts:183`), reconstructed at display (`SpellBookSection.tsx:86`). No kind discriminator exists.
- Mutations: 9-op `MagicOp` union (`apps/web/src/lib/data/spells.ts:63-72`) dispatched by `applyMagicOp` inside `mutateOwnedCharacterDoc`; one POST route casting body to `MagicOp` with no route-level validation (`app/api/characters/[id]/magic/route.ts:19`).
- Kindred innate glamours (Elf/Grimalkin "Knows one randomly determined glamour", `kindreds.json:125-128`, `204-207`) are inert flavor text — the Magic tab reads only `characterClass`, so an Elf Fighter sees "This class has no magical abilities" (`MagicTab.tsx:30-37`).
- Label gaps for glamour casters: header and empty-state copy swap ("Glamours Known", "No glamours recorded") but the add button says "+ Add Spell" (`SpellBookSection.tsx:39`) and empty-state says "Tap + Add Spell" (`:57`).

**External links (issue #63):**
- Sole external-link pattern: News page cards — `<a target="_blank" rel="noopener noreferrer">` wrapping an `<article>` card with `↗` glyph (`app/(app)/news/page.tsx:22-50`). Two Necrotic Gnome links exist. A "News Coming Soon" placeholder block sits below (`news/page.tsx:56`).

## Desired End State

1. **Enchanter characters** see three magic sections: Glamour Circles (existing), **Glamours Known** (existing book, `kind: 'glamour'`), and a new **Runes Known** section (list + add form, unranked, from a rune-name list; PRD: one random rune per level, so also show "Runes known at Level N" count from rules data).
2. **Elf/Grimalkin characters of any class** see a Glamours Known section (innate kindred glamour) even when their class is a non-caster; slot/prep sections appear only when the class grants them.
3. All user-facing labels say Glamour/Rune where applicable (button, empty state, form headings).
4. **News page** gains a third external card linking the Dolmenwood wiki (`https://www.dolmenwood.necroticgnome.com/rules/doku.php?id=wiki:welcome`); "Coming Soon" block removed; link cards get icon flair (emoji, consistent with nav's emoji icon convention).

Verify: create/view an Enchanter (glamours + runes sections, correct counts by level), an Elf Fighter (glamours section only, no slots/prep/rest), a Magician (unchanged), a Fighter (unchanged "no magical abilities" for Human kindred); News page shows 3 cards with icons and no placeholder.

## Patterns to Follow

- **Rules data + accessor pattern**: rune list and runes-known-by-level belong in rules-engine data (`spells.json`, `spell-slots.json`) with accessors in `spells.ts`, mirroring `getSpellsForClass`/`getSpellSlots` (`spells.ts:16-67`).
- **Section component pattern**: new Runes section mirrors `SpellBookSection` props/shape (`SpellBookSection.tsx:7-16`) — header via `SECTION_HEADER`, toggle-button add form, empty state, row list (`types.ts:6-13`).
- **Persistence flow**: new `kind` field passes through the 6 documented layers — client wrapper (`api/spells.ts`), route (untouched cast), `MagicOp` literal, `applyMagicOp` case, `SpellbookEntryDoc`, `spellToUi` mapper (research Q4).
- **External card pattern**: copy the existing news link-card JSX exactly (`news/page.tsx:33-50`), inline styles + CSS vars.
- **Anti-pattern to fix, not copy**: do NOT add a 6th `'glamours' in x` shape-sniff site. Introduce a small shared helper in rules-engine (e.g. `getMagicCapabilities(class, kindred)` or similar decided in planning) and use it in the new code; existing sites may migrate opportunistically but wholesale refactor is out of scope.
- **Anti-pattern to not copy**: `class-advancement.json` per-level `"glamours": N` is dead data — don't add a parallel dead `"runes"` column there; put runes-known-by-level next to `glamoursKnownByLevel` in `spell-slots.json` where it will actually be read.

## Design Decisions

1. **Runes belong to Enchanter** (fairy runes, per PRD and Dolmenwood rules) — issue #61's "Breggle/knight" attribution was wrong. User confirmed.
2. **Discriminator field**: add optional `kind?: 'spell' | 'glamour' | 'rune'` to `SpellbookEntryDoc`/`DBSpell` and the `addSpell` op. Absent = legacy; legacy glamour inference (`spellLevel === 0`) retained for old docs. No migration.
3. **Kindred innate glamours in scope, minimal**: Elf/Grimalkin of any class get a Glamours Known book section (entries `kind: 'glamour'`), no slots/prep/rest. Capability derived from kindred data, not hardcoded class names in UI.
4. **Rune names ship in `spells.json`** under Enchanter (names only, same licensing posture as existing spell/glamour lists). Drafted from the Dolmenwood Player's Book; user verifies. Free-text "Other" fallback stays.
5. **Wiki link = third News card**; remove "News Coming Soon"; add emoji icon flair to all three cards (matches `BottomNav.tsx:12-18` emoji convention).
6. **Runes are tiered (lesser/greater/mighty), slotless, non-deterministic** *(amended after wiki verification)*: 18 runes in three magnitude tiers per the official rules wiki (`fairy_magic` page). There is **no fixed runes-per-level table** — acquisition is a 2d6 "Rune Granted" roll each level-up. So: no count box, no `runesKnownByLevel`. Runes Known section = known list + add form only; tier label derived by name lookup (free-text runes show generic "Rune"). Rune data lives in a new `runes.json` keyed by class (Enchanter only today).
7. **Level-up emits a "Rune Granted" reminder** *(amended)*: for rune classes, `advancement.ts` pushes a static feature telling the player to roll 2d6 on the Rune Granted table — no count diff is possible.

## What We're NOT Doing

- No rune/glamour full rule text, descriptions, or effects — names only (licensing + scope).
- No "roll random rune/glamour" button (PRD mentions it; separate enhancement).
- No migration of existing spellbook docs to the `kind` field.
- No wholesale refactor of the five existing `'glamours' in x` sites (new helper used by new code only).
- No referee/DM read path changes to magic data (stays owner-only).
- No nav changes, no Resources page, no chatbot link (#63 scope cut).
- No changes to Bard's contradictory data (`class-advancement.json:13-14` vs `spell-slots.json:399-420`) — out of scope.
- No wizard (character creation) changes — kindred glamour granting at creation time (picking the random glamour) stays manual via the add form.

## Open Risks

- **Rune list accuracy**: verified against the official Necrotic Gnome rules wiki (`doku.php?id=fairy_magic`, `?id=enchanter`) — 18 runes, 6 per tier. User spot-check still welcome.
- **Innate glamour kindreds**: wiki suggests Woodgrue may also get ancestry glamours; our `kindreds.json` has the "Glamours" trait only on Elf/Grimalkin. Helper is data-driven (trait lookup) — adding Woodgrue later is a data edit, not code.
- **Shape-sniff interplay**: `getSpellSlots` returning `{ glamours: n }` is load-bearing at 5 sites; adding runes must not change that return shape (plan: separate accessor for rune counts, leave `getSpellSlots` untouched).
- **Elf/Grimalkin non-caster path**: `MagicTab` currently early-returns the empty state for non-casters (`MagicTab.tsx:30-37`); `useSpells` skips loading when `!spellcaster` (`use-spells.ts:97-100`). Both gates need to admit kindred-glamour characters without triggering slot auto-init — the `!isGlamour` guard at `use-spells.ts:49` must stay correct.
- **PDF/character-sheet export**: if a PDF or print view renders magic sections elsewhere, it may need the same sections (not covered by research; check during planning).
