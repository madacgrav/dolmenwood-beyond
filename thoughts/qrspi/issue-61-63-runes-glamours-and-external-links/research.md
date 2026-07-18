# Research Findings

## Q1: Data-to-UI flow for the Magic tab; where slot-based vs glamour paths branch

### Findings
- `getSpellSlots(className, level)` (`packages/rules-engine/src/spells.ts:50-67`) returns one of three shapes: `null` (not a caster or no row for level), `{ glamours: n }` (line 54-55, only when the class entry in `spell-slots.json` has `glamoursKnownByLevel`), or a sparse numeric map `{ [rank]: count }` for ranks 1-6 with values > 0 (lines 58-66).
- `SlotsData = Record<string | number, number>` aliases this shape (`apps/web/src/components/character-sheet/magic/types.ts:4`).
- `MagicTab.tsx:13` gates the tab on `isSpellcaster(character.characterClass)` (`spells.ts:69-71`, just `className in spellSlotData`). Non-casters get an empty state (`MagicTab.tsx:30-37`).
- **The sole branch point**: `MagicTab.tsx:18` — `isGlamour = slotsData !== null && 'glamours' in slotsData`. Shape-sniffing on the `glamours` key, not a class-name check.
- `validRanks` (`MagicTab.tsx:23-28`): `[]` when `!slotsData || isGlamour`; else numeric keys of the map.
- `useSpells` hook (`magic/use-spells.ts`), called at `MagicTab.tsx:20` with `{ characterId, spellcaster, isGlamour, slotsData, readOnly }`:
  - `loadData` (`use-spells.ts:42-95`) fetches `{ slots, preparations, spells }` in one GET via `fetchMagicData` (`lib/api/spells.ts:52-56`).
  - Auto-init (`use-spells.ts:49-66`): only when `slots.length === 0 && spellcaster && !isGlamour && slotsData && !readOnly`. Glamour casters never get `spell_slots` rows. Builds rows from numeric entries of `slotsData`, POSTs op `initSlots`; on race (`alreadyInitialized`) re-fetches.
  - Re-sync (`use-spells.ts:67-89`): when slots exist and `!isGlamour`, diffs each row's total vs `slotsData[String(rank)]` (level-up drift) and clamps `slots_used`.
  - `addSpell` (`use-spells.ts:179-192`): payload uses `spell_level: isGlamour ? 0 : rank` (line 183) — glamours persist with sentinel `spell_level = 0`.
- Section consumption:
  - `SpellSlotsSection` (rendered `MagicTab.tsx:53-61`) branches internally at `SpellSlotsSection.tsx:38-98`: glamour → static "Glamours known at Level N" box reading `slotsData.glamours` (line 51); ranked → toggleable circles per `dbSlots` row.
  - `PreparedSpellsSection` mounted only `!isGlamour` (`MagicTab.tsx:64-75`).
  - `SpellBookSection` always mounted (`MagicTab.tsx:78-87`), reshaped via `isGlamour`/`validRanks` props.

## Q2: How the Enchanter/glamour caster is modeled end to end; what makes glamours unranked

### Findings
- `spells.json:28-30`: Enchanter spell list under a `"glamours"` array key instead of `"rank1"…"rank6"` (contrast Magician at `spells.json:2-9`).
- `spell-slots.json:421-443`: Enchanter has `glamoursKnownByLevel: [1,2,3,3,4,5,6,6,7,7,8,8,9,9,10]`, `spellType: "Glamours (Fairy Magic)"`, `maxRank: null` — no `slotsPerLevel`. `maxRank: null` is never read programmatically.
- `class-advancement.json:421-501`: Enchanter levels also carry `"glamours": N` per level — duplicated data, **not read by any code** (falls through the `[key: string]: unknown` index signature on `ClassLevel`, `advancement.ts:18`). `getSpellSlots` reads only `spell-slots.json`.
- `SpellEntry` (`spells.ts:6-9`): `rank: number | 'glamour'` — type-level unranked encoding.
- `getSpellsForClass` (`spells.ts:16-35`): if `classSpells['glamours']` exists (line 22), any numeric `rank` filter returns `[]` (line 23); no filter returns all glamours tagged `rank: 'glamour'` (line 24). Ranked path parses `rankN` keys (lines 27-34).
- Level-up diff (`advancement.ts:112-140`): gated on `isSpellcaster`; branches on `'glamours' in newSlots` (line 116). Glamour path: scalar compare, pushes one feature `{ name: 'Glamours Known', description: 'You now know N glamours (was M).' }` (117-123). Ranked path: per-rank loop 1-6, aggregates into one "Spell Slots Expand" feature (125-138).
- Level-up UI: `level-up/page.tsx:86` passes `LevelUpFeature[]` to `FeaturesStep`/`ConfirmStep` — no glamour-specific rendering (already normalized). `CheckStep.tsx:127` independently calls `getSpellSlots` and only shows per-rank comparison rows when `!('glamours' in newSlots)` — no glamour row in the stat table; the change surfaces only via the Features card.
- DB round-trip: unranked degrades to `spell_level = 0` on write (`use-spells.ts:183`); display reconstructs via `isGlamour || spell.spell_level === 0 ? 'Glamour' : 'Rank N'` (`SpellBookSection.tsx:86`).
- Tests: `__tests__/spells.test.ts:49-54` (`{ glamours: 1 }` at level 1), `:113-117` (all entries `rank === 'glamour'`), `:119-122` (rank filter → `[]`); `__tests__/advancement.test.ts:98-109` ("detects glamour increase for Enchanter").
- **No shared helper/type guard exists** for glamour detection — the `'glamours' in x` idiom repeats independently at `spells.ts:22`, `spells.ts:54`, `advancement.ts:116`, `MagicTab.tsx:18`, `CheckStep.tsx:127`.

## Q3: Magic-tab component props; which are glamour-conditional

### Findings
All under `apps/web/src/components/character-sheet/magic/`.

- Shared `types.ts`: `SlotsData` (line 4); style constants `SECTION_HEADER` (6-13), `INPUT_STYLE`/`SELECT_STYLE` (15-30) reused by all sections/forms.
- `SpellSlotsSection.tsx:5-13` props: `{ isGlamour, slotsData: SlotsData | null, level, dbSlots: DBSpellSlot[], readOnly?, onToggleSlot, onRest }`. Glamour-aware: header text (21), Rest button hidden when `isGlamour` (23), whole body branches (38-98).
- `PreparedSpellsSection.tsx:7-16` props: `{ characterClass, preparations: DBPreparation[], ranksWithFreeSlots: number[], freeSlots: (rank) => number, readOnly?, onAdd, onCast, onRestore }`. **No `isGlamour` prop** — omitted entirely by caller (`MagicTab.tsx:64`).
- `SpellBookSection.tsx:7-16` props: `{ characterClass, isGlamour, validRanks: number[], spells: DBSpell[], readOnly?, onAdd, onToggleMemorized, onDelete }`. Glamour-aware: header "Glamours Known" vs "Spell Book" (28), empty-state copy (57), row label "Glamour" vs `Rank N` via `isGlamour || spell.spell_level === 0` (86). Always rendered.
- `AddSpellForm.tsx:7-13` props: `{ characterClass, isGlamour, validRanks, onAdd: (rank, name) => Promise<boolean>, onClose }`. Glamour-aware: options via `getSpellsForClass(characterClass)` no-rank when glamour vs rank-filtered (24-29); rank `<select>` hidden when `isGlamour` (48); heading "Add Glamour" vs "Add Spell to Book" (45). Manual "Other" free-text fallback (sentinel `'__other__'`).
- `PrepareSpellForm.tsx:7-13` props: `{ characterClass, ranksWithFreeSlots, freeSlots, onAdd, onClose }`. Not glamour-aware (never mounts for glamour casters).

| Component | `isGlamour` prop | Reshaping |
|---|---|---|
| SpellSlotsSection | yes | swaps body (badge vs circles), hides Rest |
| PreparedSpellsSection | no | omitted by MagicTab when glamour |
| SpellBookSection | yes | labels/copy only |
| AddSpellForm | yes | drops rank select, unfiltered options |
| PrepareSpellForm | no | omitted (inside PreparedSpellsSection) |

## Q4: Magic persistence and mutation layers

### Findings
- Client types (`apps/web/src/lib/api/spells.ts`): `DBSpellSlot` (10-16), `DBPreparation` (18-25), `DBSpell` (27-34), `MagicData` (36-40) — deliberately snake_case UI shapes (header comment 1-6). All mutations funnel through `magicOp<T>` (42-50): POST `{ op, ...payload }` to `/api/characters/[id]/magic`, `null` on non-2xx. Nine thin wrappers, one per op (66-133). `fetchMagicData` (52-56) GETs the whole bundle; no per-entry GET.
- Cosmos doc shapes (`apps/web/src/lib/cosmos/types.ts`): `SpellSlotDoc` `{ id, rank, slotsTotal, slotsUsed }` (58-63); `SpellPrepDoc` `{ id, slotRank, spellName, isCast, createdAt }` (65-71); `SpellbookEntryDoc` `{ id, spellName, spellLevel, isMemorized, notes }` (73-79). Embedded on `CharacterDoc`: `spellSlots?`/`spellPreparations?`/`spellbook?` (166-168), optional with default-`[]` semantics (164). `lastRestDate?` (177) mutated by `rest` op. **No category/kind discriminator exists on any of these.**
- Server data module (`apps/web/src/lib/data/spells.ts`): doc→UI mappers `slotToUi`/`prepToUi`/`spellToUi` (18-42; `notes: s.notes ?? undefined` at 41). `magicDataOf` (44-56) sorts slots by rank, preps by createdAt, spellbook by spellLevel. `fetchMagicData` (58-61): `requireAccountId()` + `assertCharacterOwner` — owner-only, no referee read path (contrast `fetchCharacterWithNotes`).
- `MagicOp` union (63-72): exactly 9 ops — `initSlots`, `updateSlotTotals`, `updateSlotUsage`, `rest`, `addPreparation`, `setPreparationCast`, `addSpell`, `setSpellMemorized`, `deleteSpell`.
- `applyMagicOp` (74-166): `switch (op.op)` inside the callback passed to `mutateOwnedCharacterDoc` (77-163). Notable cases: `initSlots` no-ops with `{ alreadyInitialized: true }` if slots already exist (80-87, race guard); `addPreparation` (116-129) and `addSpell` (136-149) validate non-empty trimmed `spell_name` (`badRequest`) and append with `crypto.randomUUID()`; `addSpell` coerces `spellLevel: Number(...) || 0`; `rest` (110-115) clears preps, zeroes usage, stamps `lastRestDate`; default throws `badRequest('unknown magic op')` (160-161).
- Route (`apps/web/src/app/api/characters/[id]/magic/route.ts`): GET (7-14) → `fetchMagicData`; POST (16-24) casts `request.json()` directly to `MagicOp` (line 19) — **no runtime body validation at the route layer**; validation lives in `applyMagicOp` per-case.
- Authz: `mutateOwnedCharacterDoc` (`lib/data/characters.ts:66-72`) → `requireAccountId()` then `mutateCharacterDoc(() => assertCharacterOwner(...), mutate)` — ownership re-checked per mutation; ETag-guarded doc replace (per `data/spells.ts:12` header). `assertCharacterOwner` (`lib/authz.ts:114-133`): 1-RU point read with partitionKey = ownerId fast path (122-124), fallback to fetch-by-id + `assertOwner` to distinguish 404 from 403 (129-131).
- Layers any new field on a magic entry passes through today: client wrapper payload + `DBPreparation`/`DBSpell` interface → route (untouched, wholesale cast) → `MagicOp` op literal type → `applyMagicOp` case (read off `op`, assigned onto doc literal) → `SpellPrepDoc`/`SpellbookEntryDoc` interface → `prepToUi`/`spellToUi` mapper.

## Q5: Class/kindred capability data; how magical capability is decided

### Findings
- `kindreds.json` has six kindreds: Breggle (1-111), Elf (112-182), Grimalkin (183-261), Human (262-304), Mossling (305-368), Woodgrue (369-430).
- Class access is a `classRestrictions` object with `common`/`rare`/`veryRare`/`occasional`/`forbidden` arrays, not a single allow list. Examples: Breggle `common: [Fighter, Knight, Magician]`, `veryRare: [Enchanter]` (34-51); Elf `common: [Enchanter, Fighter, Hunter, Magician]`, `forbidden: [Cleric, Friar, Knight]` (156-173); Human `rare: [Enchanter]` (288-303).
- Innate glamour traits (trait text only, not wired to any mechanic): Elf "Glamours — Knows one randomly determined glamour." (`kindreds.json:125-128`); Grimalkin same (`kindreds.json:204-207`). No other kindred has one. Mossling has "Knacks" (321-324), Woodgrue "Mad Revelry" (393-396) — neither grants spells/glamours. **The Magic tab never reads kindred traits** — it keys purely off `character.characterClass`.
- `isClassAllowedForKindred` (`packages/rules-engine/src/kindreds.ts:64-69`): only the `forbidden` list is enforced (`!forbidden.includes(className)`); `rare`/`veryRare`/`occasional` are advisory data with no code enforcement.
- Wizard: `Step2Kindred.tsx:55,91-106` renders first two `getKindredTraits(k)` as pills (+"N more" label) — glamour trait shows as generic text, no special-casing. `Step3Class.tsx:28-30` filters `ALL_CLASSES` by `isClassAllowedForKindred`; no spellcasting-specific UI.
- Spellcaster set = keys of `spell-slots.json`: Cleric (Holy, maxRank 5, lines 3-129), Friar (Holy, 5, 130-256), Magician (Arcane, 6, 257-398), Bard (Arcane limited, 3, starts level 2, 399-420), Enchanter (Glamours, unranked, 421-443). `isSpellcaster` (`spells.ts:69-71`), `SPELLCASTING_CLASSES` (`spells.ts:73`). Non-casters: Fighter, Hunter, Knight, Thief.
- Data inconsistency: `class-advancement.json:13-14` says Bard `"spellSlots": null` with note "Bards use Enchantment and Counter Charm abilities, not spell slots", yet `spell-slots.json:399-420` gives Bard a `slotsPerLevel` table and `isSpellcaster('Bard')` is true. No reconciliation code exists.
- "Rune" grep, repo-wide: no rune mechanic exists anywhere in source. Source-code hits are all the substring in "Drune" (faction name): `scripts/data/noble-houses.json:8`, `apps/web/src/test/__tests__/quests.test.ts:50,55`. `docs/prd.md:499-501,723` (and its duplicate `dolmenwood_beyond_prd.md`) describes a future "Fairy Runes (Enchanter)" UI ("List of known runes", "Roll button for acquiring new rune on level-up") and a table row `| magic | Spells, glamours, runes |` — spec text only.

## Q6: Navigation structure and external-link convention

### Findings
- `BottomNav.tsx` (`apps/web/src/components/layout/BottomNav.tsx`): `'use client'`; `NavItem { href, label, icon }` (6-10); `BASE_NAV_ITEMS` (12-18): Characters 🏠 `/characters`, News 📜 `/news`, Campaign ⚔️ `/campaign`, Dice 🎲 `/dice`, Settings ⚙️ `/settings`. `ADMIN_NAV_ITEM` 🛡️ `/admin` (20) appended when `isAdmin` (28). Active = `pathname.startsWith(item.href)` (48), styled via inline `color`/`fontWeight` (60, 63). Items render as `next/link` `<Link>` (50-68). Fixed bottom bar, 80px, zIndex 50, safe-area padding (31-46).
- `(app)/layout.tsx`: server component, `force-dynamic` (6); `isAdmin` from `fetchAccountDoc(session.user.id)?.isAdmin` (11-15); header rendered only when session — fixed 52px top bar containing only `<NotificationBell />` right-aligned (19-27); `<main>` pads top 52px / bottom 80px (28); `<BottomNav isAdmin>` unconditional (29). This is the **only** nav — no sidebar/top-nav links.
- External-link convention — sole instance in `apps/web/src`: `news/page.tsx:22-50`. Local literal array of `{ href, title, desc }` mapped to:
  - plain `<a>` (not `<Link>`) with `target="_blank" rel="noopener noreferrer"` and `style={{ textDecoration: 'none' }}` (line 34)
  - nested `<article>` card: `var(--color-surface)` bg, `1px solid var(--color-border)`, `borderRadius: 12px`, `padding: 1rem`, `cursor: pointer` (35-41)
  - `<h2>` in `var(--font-display), Georgia, serif` 1.1rem with a muted `↗` glyph span appended (42-44)
  - muted 0.85rem `<p>` description (45-47)
  - Current entries: `necroticgnome.com/blogs/news/tagged/dolmenwood` ("Dolmenwood News") and `necroticgnome.com/blogs/news` ("Necrotic Gnome Blog") (24-31).
- Internal cards on the same page use the same `<article>` card shell wrapped in `<Link>` (`news/page.tsx:80-87`) — consistent card pattern for both.
- `target="_blank"` appears exactly once in the whole `apps/web/src` tree (`news/page.tsx:34`); the only other `https?://` literals are test fixtures (`migration-transform.test.ts`).
- Settings-page composition pattern (nav-linked page): flat stack of one-component-per-file sections (`settings/page.tsx:36-56`) sharing `sectionStyle`/`sectionHeaderStyle`/`inputStyle` from `settings/components/styles.ts:1-29`; sections receive `account`/callbacks as props.

## Cross-Cutting Observations
- **Shape-sniffing over enums**: glamour-ness is detected by the literal `'glamours'` key at five independent sites (`spells.ts:22`, `spells.ts:54`, `advancement.ts:116`, `MagicTab.tsx:18`, `CheckStep.tsx:127`); no shared `isGlamourClass()` helper or exported type guard.
- **Unranked degrades to 0 at the DB boundary**: `rank: 'glamour'` exists only in rules-engine types; persistence uses `spell_level: 0` sentinel (`use-spells.ts:183`), reconstructed at display (`SpellBookSection.tsx:86`).
- **Class drives everything, kindred drives nothing (in magic)**: the Magic tab reads only `characterClass`; kindred glamour traits (Elf/Grimalkin) are inert flavor text in `kindreds.json`.
- **Single-doc persistence**: all magic state lives as embedded arrays on `CharacterDoc`, mutated via ETag-guarded owner-only ops through one POST route with an op-union dispatch; route layer does no body validation.
- **Inline-styles-only UI**: no CSS modules/Tailwind in the touched areas; CSS variables (`--color-surface`, `--color-border`, `--font-display`) + inline `style` objects everywhere; card shell = surface bg, 1px border, 12px radius.
- **Nav is one hardcoded array**: adding/removing a destination = editing `BASE_NAV_ITEMS` in `BottomNav.tsx`; nav items are internal `<Link>`s (external `<a>` has never appeared in nav).

## Open Areas
- The Bard contradiction (`class-advancement.json` "no spell slots" note vs `spell-slots.json` slot table) is unresolved in code; which is rules-correct can't be determined from the codebase.
- `class-advancement.json`'s per-level `"glamours": N` field and `spell-slots.json`'s `maxRank` are dead data — present but unread; whether they're intended for future use isn't documented.
- Kindred innate-glamour traits ("Knows one randomly determined glamour") have no mechanical representation anywhere — no code decides *which* glamour or stores it.
- No i18n/localization layer observed for nav labels or section copy; all strings are inline literals.
