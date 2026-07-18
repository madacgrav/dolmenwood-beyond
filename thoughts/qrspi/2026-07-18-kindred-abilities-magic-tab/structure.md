# Structure Outline

## Approach
Ride the existing spellbook rail (`kind` discriminator) for kindred glamours and knacks; add trait-name helpers and a knack data module to rules-engine; new "Kindred Abilities" section on the renamed "Magic and Abilities" tab; auto-wizard seeds rolls at the complete page, tab roll/pick UI covers manual + existing characters.

## Phase 1: Kindred Abilities section, empty-state fix, tab rename
Display-only slice: quasi-magical kindred traits appear on the tab for all affected kindreds; Woodgrue/Mossling non-casters stop seeing the empty state; tab reads "Magic and Abilities".

**Files**: `packages/rules-engine/src/kindreds.ts`, `packages/rules-engine/src/__tests__/kindreds.test.ts`, `apps/web/src/components/character-sheet/MagicTab.tsx`, `apps/web/src/components/character-sheet/magic/KindredAbilitiesSection.tsx` (new), `apps/web/src/app/(app)/characters/[id]/page.tsx`, `apps/web/src/app/(app)/characters/[id]/view/page.tsx`

**Key changes**:
- `MAGICAL_KINDRED_TRAITS: readonly string[]` — `['Glamours', 'Shape-Shifting', 'Mad Revelry', 'Knacks']`
- `getMagicalKindredTraits(kindred: string): KindredTrait[]` — new, beside `hasInnateGlamours`
- `hasKnacks(kindred: string): boolean` — new, trait-name match `'Knacks'`
- `KindredAbilitiesSection({ traits }: { traits: KindredTrait[] })` — new component, name+description cards (RunesSection structure)
- `MagicTab.tsx` empty-state gate: `!spellcaster && magicalTraits.length === 0`
- Tab label `'Magic'` → `'Magic and Abilities'` in both page files (id `'magic'` unchanged)

**Verify**: rules-engine tests pass (`pnpm test`); manually: non-caster Woodgrue shows Mad Revelry card (no empty state), Human Fighter still gets empty state, tab label renamed on edit + view pages.

---

## Phase 2: Kindred glamour — kind extension + roll/pick UI
Elf/Grimalkin see a "Kindred Glamour" area inside Kindred Abilities: 🎲 Roll (uniform over Enchanter's 22) or dropdown pick when absent; persisted as `kind:'kindred-glamour'`; listed separately from Enchanter learned glamours.

**Files**: `apps/web/src/lib/cosmos/types.ts`, `apps/web/src/lib/data/spells.ts`, `apps/web/src/lib/api/spells.ts`, `apps/web/src/components/character-sheet/magic/use-spells.ts`, `apps/web/src/components/character-sheet/magic/KindredAbilitiesSection.tsx`, `apps/web/src/components/character-sheet/MagicTab.tsx`, `packages/rules-engine/src/spells.ts` (only if a `getGlamourNames()` convenience is needed — else reuse `getSpellsForClass('Enchanter')`)

**Key changes**:
- `SpellbookEntryDoc.kind` / `DBSpell.kind` / server allowlist → `'spell' | 'glamour' | 'rune' | 'kindred-glamour' | 'knack'` (both new values added here once)
- `use-spells.ts` load gate: `!spellcaster && !hasMagicalKindredTraits` → widen; `addSpell(rank, name, kind)` already generic — pass `'kindred-glamour'`
- `MagicTab.tsx`: `kindredGlamourEntry = spells.find(kind === 'kindred-glamour')`; glamour `SpellBookSection` gate `isGlamour || innateGlamours` → `isGlamour` only
- `KindredAbilitiesSection` props grow: `kindredGlamour: DBSpell | null`, `onRollGlamour()`, `onPickGlamour(name)`, `onDelete(id)`; roll uses `rollDie`/list-pick via rules-engine `dice.ts` (no inline `Math.random`)

**Verify**: manually: Elf Fighter → roll button → glamour persists and survives reload; delete → pick dropdown works; Grimalkin Enchanter shows kindred glamour separate from "Glamours Known"; existing `apps/web` tests (`inventory-spells.test.ts`) still pass.

---

## Phase 3: Knacks — data module + roll/pick UI + per-level abilities
Mossling sees Knacks in Kindred Abilities: roll (d6) or pick one of six; selected knack renders its Level 1/3/5/7 abilities with those ≤ character level highlighted; persisted as `kind:'knack'`.

**Files**: `packages/rules-engine/src/data/knacks.json` (new), `packages/rules-engine/src/knacks.ts` (new), `packages/rules-engine/src/index.ts`, `packages/rules-engine/src/__tests__/knacks.test.ts` (new), `apps/web/src/components/character-sheet/magic/KindredAbilitiesSection.tsx`, `apps/web/src/components/character-sheet/MagicTab.tsx`

**Key changes**:
- `knacks.json`: 6 entries `{ name, description, abilities: { level: 1|3|5|7, name, description }[] }` — Bird Friend, Lock Singer, Root Friend, Thread Whistling, Wood Kenning, Yeast Master (Player's Book p112-113 text, captured in design phase)
- `KnackAbility { level: number; name: string; description: string }`, `Knack { name: string; description: string; abilities: KnackAbility[] }`
- `getKnacks(): Knack[]`, `getKnack(name: string): Knack | null` — new module, exported via index
- `KindredAbilitiesSection` props grow: `knackEntry: DBSpell | null`, `characterLevel: number`, `onRollKnack()`, `onPickKnack(name)` — persisted via `addSpell(0, name, 'knack')`

**Verify**: `pnpm test` (new knacks tests: 6 knacks, 4 abilities each, lookup round-trip); manually: Mossling → roll/pick knack → persists, abilities at/below level highlighted, level-up would reveal more (check by editing level).

---

## Phase 4: Auto-wizard creation seeding
Auto-created Elf/Grimalkin arrive with a rolled kindred glamour; auto-created Mossling with a rolled knack. Best-effort after `createCharacter`, seedInventory style. Manual mode untouched.

**Files**: `apps/web/src/app/(app)/characters/new/auto/complete/page.tsx`

**Key changes**:
- `seedKindredAbilities(characterId: string, kindred: Kindred): Promise<void>` — new local fn: `hasInnateGlamours` → pick 1 of 22 → `insertCharacterSpell(..., kind:'kindred-glamour')`; `hasKnacks` → pick 1 of 6 → `kind:'knack'`; errors logged and skipped
- Called alongside `seedInventory` before `wizard.reset()`

**Verify**: manually: complete auto wizard as Elf → sheet shows kindred glamour without touching tab UI; as Mossling → knack present; as Human Fighter → nothing seeded, no errors in console.

---

## Phase 5: PDF export pass + docs
New kinds print sensibly in the PDF sheet; docs updated.

**Files**: `apps/web/src/lib/pdf/character-sheet.ts`, `apps/web/src/test/__tests__/pdf-export.test.ts` (if assertions touch kinds), `README.md`, `.github/copilot-instructions.md`

**Key changes**:
- PDF spell rendering: route `kind:'kindred-glamour'` entries into the glamour listing (or labeled line) and `kind:'knack'` into a knack line — exact shape decided at implementation after reading current PDF layout
- `README.md:8`, `.github/copilot-instructions.md:38,76`: label "Magic" → "Magic and Abilities"

**Verify**: `pnpm test` (pdf-export tests); manually export a Mossling + Elf sheet, entries visible and labeled.

## Testing Checkpoints
- **After P1**: helpers tested; Woodgrue/Mossling see trait cards; empty state only for truly non-magical combos; tab renamed. No persistence changes yet.
- **After P2**: `kind` union extended end-to-end (doc type, server allowlist, client type); Elf/Grimalkin can roll/pick a persisted kindred glamour, separate from Enchanter list.
- **After P3**: knack data module tested; Mossling can roll/pick a persisted knack with level-gated ability display.
- **After P4**: auto wizard seeds glamour/knack; manual + existing characters rely on P2/P3 UI.
- **After P5**: PDF export handles new kinds; docs consistent.
