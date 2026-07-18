# Structure Outline

## Approach
Five vertical slices. Wiki link first (independent, ships alone). Then runes bottom-up in testable slices: rules-engine data+accessors, `kind` discriminator through the persistence stack, Enchanter runes UI, kindred innate glamours. Each phase leaves the app working.

## Phase 1: Wiki link card + News page cleanup (#63)
Third external card (Dolmenwood wiki) on News page; remove "News Coming Soon" block; emoji icon flair on all three cards.

**Files**: `apps/web/src/app/(app)/news/page.tsx`

**Key changes**:
- Extend the link array (`page.tsx:22-31`) with `{ href: 'https://www.dolmenwood.necroticgnome.com/rules/doku.php?id=wiki:welcome', title: 'Dolmenwood Wiki', desc: ... }`
- Add `icon: string` (emoji) to each link object; render in card `<h2>` (matches `BottomNav.tsx:12-18` emoji convention)
- Delete "News Coming Soon" block (`page.tsx:56` region)

**Verify**: `npm run lint` + typecheck pass; manually — News page shows 3 icon cards, wiki opens in new tab, no placeholder block.

---

## Phase 2: Rules-engine rune foundation
Rune names, runes-known-by-level, accessors, level-up diff — fully unit-tested in the package before any UI.

**Files**: `packages/rules-engine/src/data/spells.json`, `data/spell-slots.json`, `src/spells.ts`, `src/kindreds.ts`, `src/advancement.ts`, `src/__tests__/spells.test.ts`, `src/__tests__/advancement.test.ts`, `src/index.ts` (exports)

**Key changes** *(amended after wiki verification — no deterministic rune count exists; runes are tiered)*:
- New `data/runes.json`: `{ "Enchanter": { "lesser": [6 names], "greater": [6 names], "mighty": [6 names] } }` — 18 runes from the official wiki
- `getRunesForClass(className: string): RuneEntry[]` — new; `RuneEntry { name: string; tier: 'lesser' | 'greater' | 'mighty' }`. `SpellEntry` untouched (separate type, less risk than widening the union)
- `classHasRunes(className: string): boolean`; `getRuneTier(className, runeName): RuneTier | null`. **`getSpellSlots` return shape untouched** (5 load-bearing shape-sniff sites)
- `hasInnateGlamours(kindred: string): boolean` — new in `kindreds.ts` (trait-name lookup, not hardcoded kindred list)
- `advancement.ts`: for rune classes emit static `{ name: 'Rune Granted', description: 'Roll 2d6 on the Rune Granted table…' }` reminder feature (no count diff possible)

**Verify**: `npm test -w packages/rules-engine` — new tests: rune list non-empty and all `rank: 'rune'`; `getRunesKnown('Enchanter', 1..15)` matches table; `getRunesKnown('Magician', n) === null`; `hasInnateGlamours` true only for Elf/Grimalkin; level-up emits Runes Known feature. Existing tests unchanged.

---

## Phase 3: `kind` discriminator through persistence
Optional `kind` field flows client → op → doc → mapper. Behavior for existing data unchanged (legacy inference stays).

**Files**: `apps/web/src/lib/cosmos/types.ts`, `apps/web/src/lib/data/spells.ts`, `apps/web/src/lib/api/spells.ts`, `apps/web/src/components/character-sheet/magic/use-spells.ts`, `apps/web/src/test/__tests__/inventory-spells.test.ts` (or nearest magic-op test home)

**Key changes**:
- `SpellbookEntryDoc { ...; kind?: 'spell' | 'glamour' | 'rune' }` (`cosmos/types.ts:73-79`)
- `DBSpell { ...; kind?: 'spell' | 'glamour' | 'rune' }` (`api/spells.ts:27-34`); `MagicData` unchanged shape
- `MagicOp` `addSpell` op literal gains `kind?` (`data/spells.ts:63-72`); `applyMagicOp` `addSpell` case persists it (`:136-149`); `spellToUi` maps it (`:35-42`)
- `insertCharacterSpell` payload gains `kind?` (`api/spells.ts:116-121`)
- `use-spells.ts` `addSpell(rank, name, kind?)` threads it; existing glamour call site passes `kind: 'glamour'` (keeps `spell_level: 0` sentinel too — belt and braces for old readers)

**Verify**: `npm test -w apps/web` — test: `addSpell` op with `kind: 'rune'` persists and round-trips through `spellToUi`; op without `kind` unchanged. Manual: existing Magician/Enchanter spellbooks still render.

---

## Phase 4: Enchanter Runes UI + label fixes
Runes Known section (count box + known list + add form) on the Magic tab for Enchanter; glamour/rune-aware labels.

**Files**: new `apps/web/src/components/character-sheet/magic/RunesSection.tsx`, `MagicTab.tsx`, `SpellBookSection.tsx`, `AddSpellForm.tsx`

**Key changes**:
- `RunesSection({ characterClass, runes: DBSpell[], readOnly?, onAdd: (name) => Promise<boolean>, onDelete })` — new; mirrors `SpellBookSection` shape (`SpellBookSection.tsx:7-16`): header "Runes Known (n)", row list with tier label via `getRuneTier` (fallback "Rune"), add form (dropdown with lesser/greater/mighty optgroups from `getRunesForClass` + "Other" fallback, no rank, no memorized checkbox, no count box)
- `MagicTab.tsx`: derive `hasRunes = classHasRunes(character.characterClass)`; split `magic.spells` by `kind` (rune vs rest); render `RunesSection` when `hasRunes`; pass rune adds as `addSpell(0, name, 'rune')`
- Label fixes: "+ Add Spell" → "+ Add Glamour" when `isGlamour` (`SpellBookSection.tsx:39`), empty-state copy (`:57`); AddSpellForm heading already branches (`AddSpellForm.tsx:45`)
- `SpellBookSection` filters out `kind: 'rune'` entries (receives pre-split list from MagicTab — no internal filter needed)

**Verify**: `npm test -w apps/web` + lint; manual — Enchanter sheet shows Glamour Circles / Glamours Known / Runes Known; add+delete a rune persists across reload; Magician sheet unchanged; PDF export lists runes among spellbook names (acceptable per design).

---

## Phase 5: Kindred innate glamours (Elf/Grimalkin, any class)
Non-caster Elf/Grimalkin get a Glamours Known section; caster gates stay correct.

**Files**: `MagicTab.tsx`, `magic/use-spells.ts`, `apps/web/src/components/character-sheet/magic/SpellBookSection.tsx` (props only if needed)

**Key changes**:
- `MagicTab.tsx`: `innateGlamours = hasInnateGlamours(character.kindred)`; empty-state gate becomes `!spellcaster && !innateGlamours` (`MagicTab.tsx:30-37`); for non-caster innate path render only `SpellBookSection` in glamour mode (`isGlamour`-style labels, `validRanks: []`), adds pass `kind: 'glamour'`
- `use-spells.ts`: load gate `!spellcaster` (`:97-100`) admits innate-glamour characters (e.g. new param `loadOnly`/`hasBook`); slot auto-init guard (`:49`) must not fire (no `slotsData`, `!spellcaster` → already safe; assert in test)
- Caster + innate kindred (e.g. Elf Magician): spellbook shows both spells and glamour entries — split by `kind` like Phase 4

**Verify**: `npm test -w apps/web`; manual — Elf Fighter: Glamours Known section only (no slots/prep/Rest, no "no magical abilities"); Human Fighter: unchanged empty state; Elf Magician: spell slots + book + glamours section; no `spell_slots` rows created for Elf Fighter (check via API response).

## Testing Checkpoints
- **After P1**: News page final — #63 done, could ship alone.
- **After P2**: rules-engine knows runes end to end (data, accessors, level-up feature); all package tests green; app unchanged.
- **After P3**: persistence accepts `kind`; zero behavior change for existing data; web tests green.
- **After P4**: Enchanter full experience (glamours + runes) — #61 Enchanter half done.
- **After P5**: kindred innate glamours — #61 complete.
