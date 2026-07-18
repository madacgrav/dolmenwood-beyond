# Implementation Plan

## Overview
Enchanters get a Runes Known section (18 tiered fairy runes) alongside glamours; Elf/Grimalkin of any class get an innate Glamours Known section; glamour/rune-aware labels; News page gets a Dolmenwood wiki card with icon flair and loses the "Coming Soon" placeholder.

Monorepo commands (root): `npm run typecheck`, `npm run lint`, `npm run test` (turbo). Per-package: `npm test -w @dolmenwood/rules-engine`, `npm test -w @dolmenwood/web`.

---

## Phase 1: Wiki link card + News page cleanup (#63)

### Changes

#### 1. News page
**File**: `apps/web/src/app/(app)/news/page.tsx`
**Action**: modify

a) Extend the link array (currently lines 22-32) — add `icon` to each and append the wiki entry:
```tsx
{
  icon: '📰',
  href: 'https://necroticgnome.com/blogs/news/tagged/dolmenwood',
  title: 'Dolmenwood News',
  desc: 'Latest Dolmenwood posts from the official Necrotic Gnome blog.',
},
{
  icon: '✍️',
  href: 'https://necroticgnome.com/blogs/news',
  title: 'Necrotic Gnome Blog',
  desc: 'News from the makers of Dolmenwood and Old-School Essentials.',
},
{
  icon: '📖',
  href: 'https://www.dolmenwood.necroticgnome.com/rules/doku.php?id=wiki:welcome',
  title: 'Dolmenwood Wiki',
  desc: 'The official online rules reference — classes, kindreds, magic, and more.',
},
```

b) Render the icon in the card `<h2>` (line 42-44). Card layout becomes icon + text:
```tsx
<article style={{ /* unchanged styles */ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
  <span style={{ fontSize: '1.5rem', lineHeight: 1 }} aria-hidden="true">{link.icon}</span>
  <div>
    <h2 style={{ /* unchanged */ }}>
      {link.title} <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>↗</span>
    </h2>
    <p style={{ /* unchanged */ }}>{link.desc}</p>
  </div>
</article>
```

c) Remove the "News Coming Soon" placeholder: the `!hasWordPress` branch (lines 52-66) renders `null` instead of the placeholder div. Keep the `posts.length === 0` "No posts found." branch.

### Verification
#### Automated
- [x] `npm run typecheck` passes
- [x] `npm run lint` passes
#### Manual
- [ ] News page shows 3 icon cards (📰 ✍️ 📖); wiki card opens `dolmenwood.necroticgnome.com` in a new tab
- [ ] No "News Coming Soon" block anywhere (with `NEXT_PUBLIC_WORDPRESS_URL` unset, the page shows just the 3 cards)

---

## Phase 2: Rules-engine rune foundation

### Changes

#### 1. Rune data
**File**: `packages/rules-engine/src/data/runes.json`
**Action**: create
```json
{
  "Enchanter": {
    "lesser": ["Deathly Blossom", "Fog Cloud", "Gust of Wind", "Proof Against Deadly Harm", "Rune of Vanishing", "Sway the Mortal Mind"],
    "greater": ["Arcane Unbinding", "Fairy Gold", "Fairy Steed", "Ice Storm", "Rune of Invisibility", "Sway the Mind"],
    "mighty": ["Dream Ship", "Eternal Slumber", "Rune of Death", "Rune of Wishing", "Summon Wild Hunt", "Unravel Death"]
  }
}
```
(Names from the official rules wiki, `doku.php?id=fairy_magic`. Names only — no rule text. No `_notes` key: `classHasRunes` treats every top-level key as a class.)

#### 2. Rune accessors
**File**: `packages/rules-engine/src/spells.ts`
**Action**: modify — append (do NOT touch `getSpellSlots`, `getSpellsForClass`, or `SpellEntry`):
```ts
import runeData from './data/runes.json';   // top of file, with the other data imports

// ─── Fairy runes ──────────────────────────────────────────────────────────────

export type RuneTier = 'lesser' | 'greater' | 'mighty';
export interface RuneEntry { name: string; tier: RuneTier; }

const RUNE_TIERS: RuneTier[] = ['lesser', 'greater', 'mighty'];

/** All fairy runes a class can learn, flattened in tier order. [] for non-rune classes. */
export function getRunesForClass(className: string): RuneEntry[] {
  const entry = (runeData as Record<string, Partial<Record<RuneTier, string[]>>>)[className];
  if (!entry) return [];
  return RUNE_TIERS.flatMap(tier => (entry[tier] ?? []).map(name => ({ name, tier })));
}

export function classHasRunes(className: string): boolean {
  return getRunesForClass(className).length > 0;
}

/** Tier of a known rune name, or null for free-text/unknown runes. */
export function getRuneTier(className: string, runeName: string): RuneTier | null {
  return getRunesForClass(className).find(r => r.name === runeName)?.tier ?? null;
}
```
`index.ts` uses `export * from './spells'` — no export wiring needed.

#### 3. Innate glamour helper
**File**: `packages/rules-engine/src/kindreds.ts`
**Action**: modify — append:
```ts
/** True when the kindred innately knows a glamour (trait-driven: Elf, Grimalkin). */
export function hasInnateGlamours(kindred: string): boolean {
  return getKindredTraits(kindred).some(t => t.name === 'Glamours');
}
```

#### 4. Level-up reminder
**File**: `packages/rules-engine/src/advancement.ts`
**Action**: modify — import `classHasRunes` from `./spells`; after the `if (isSpellcaster(className)) { ... }` block (ends line 140), add:
```ts
if (classHasRunes(className)) {
  changes.push({
    name: 'Rune Granted',
    description: 'Roll 2d6 (modified by level) on the Rune Granted table to see if a new fairy rune is learned.',
  });
}
```

#### 5. Tests
**File**: `packages/rules-engine/src/__tests__/spells.test.ts`
**Action**: modify — add:
```ts
describe('getRunesForClass', () => {
  it('returns 18 Enchanter runes, 6 per tier, in tier order', () => {
    const runes = getRunesForClass('Enchanter');
    expect(runes).toHaveLength(18);
    expect(runes.filter(r => r.tier === 'lesser')).toHaveLength(6);
    expect(runes.filter(r => r.tier === 'greater')).toHaveLength(6);
    expect(runes.filter(r => r.tier === 'mighty')).toHaveLength(6);
    expect(runes[0]).toEqual({ name: 'Deathly Blossom', tier: 'lesser' });
  });
  it('returns [] for non-rune classes', () => {
    expect(getRunesForClass('Magician')).toEqual([]);
    expect(getRunesForClass('Fighter')).toEqual([]);
  });
});

describe('classHasRunes / getRuneTier', () => {
  it('only Enchanter has runes', () => {
    expect(classHasRunes('Enchanter')).toBe(true);
    expect(classHasRunes('Magician')).toBe(false);
  });
  it('looks up tier by name, null for unknown', () => {
    expect(getRuneTier('Enchanter', 'Fairy Gold')).toBe('greater');
    expect(getRuneTier('Enchanter', 'Rune of Death')).toBe('mighty');
    expect(getRuneTier('Enchanter', 'Homebrew Rune')).toBeNull();
  });
});
```

**File**: `packages/rules-engine/src/__tests__/kindreds.test.ts` (create if absent; if a kindred test file exists, extend it)
**Action**: modify/create — add:
```ts
import { hasInnateGlamours } from '../kindreds';
describe('hasInnateGlamours', () => {
  it('true for Elf and Grimalkin, false otherwise', () => {
    expect(hasInnateGlamours('Elf')).toBe(true);
    expect(hasInnateGlamours('Grimalkin')).toBe(true);
    expect(hasInnateGlamours('Human')).toBe(false);
    expect(hasInnateGlamours('Breggle')).toBe(false);
  });
});
```

**File**: `packages/rules-engine/src/__tests__/advancement.test.ts`
**Action**: modify — add:
```ts
it('emits Rune Granted reminder for Enchanter level-ups only', () => {
  const enchanter = getLevelUpFeatures('Enchanter', 1, 2);
  expect(enchanter.some(f => f.name === 'Rune Granted')).toBe(true);
  const magician = getLevelUpFeatures('Magician', 1, 2);
  expect(magician.some(f => f.name === 'Rune Granted')).toBe(false);
});
```

### Verification
#### Automated
- [x] `npx vitest run` in packages/rules-engine — 183 pass (npm -w flag doesn't resolve; turbo/direct vitest works)
- [x] `npm run typecheck` passes
#### Manual
- [x] (none — package-level phase; app behavior unchanged)

---

## Phase 3: `kind` discriminator through persistence

### Changes

#### 1. Cosmos doc type
**File**: `apps/web/src/lib/cosmos/types.ts`
**Action**: modify — `SpellbookEntryDoc` (lines 73-79) gains:
```ts
/** Discriminates spells / glamours / runes. Absent on legacy entries (infer glamour from spellLevel 0). */
kind?: 'spell' | 'glamour' | 'rune';
```

#### 2. Op union + dispatch
**File**: `apps/web/src/lib/data/spells.ts`
**Action**: modify
- `MagicOp` `addSpell` literal (line 70) gains `kind?: 'spell' | 'glamour' | 'rune'`.
- `applyMagicOp` `addSpell` case (lines 136-149): validate and persist (route has no body validation — guard here):
```ts
const kind = op.kind === 'spell' || op.kind === 'glamour' || op.kind === 'rune' ? op.kind : undefined;
const spell: SpellbookEntryDoc = {
  id: crypto.randomUUID(),
  spellName: name,
  spellLevel: Number(op.spell_level) || 0,
  isMemorized: Boolean(op.is_memorized),
  notes: op.notes ?? null,
  ...(kind ? { kind } : {}),
};
```
- `spellToUi` (lines 35-42) gains `kind: s.kind,`.

#### 3. Client types
**File**: `apps/web/src/lib/api/spells.ts`
**Action**: modify — `DBSpell` (lines 27-34) gains `kind?: 'spell' | 'glamour' | 'rune';`. (`insertCharacterSpell` takes `Record<string, unknown>` payload — no change needed.)

#### 4. Hook threads kind
**File**: `apps/web/src/components/character-sheet/magic/use-spells.ts`
**Action**: modify — `addSpell` (lines 179-192):
```ts
async function addSpell(rank: number, name: string, kind?: 'spell' | 'glamour' | 'rune'): Promise<boolean> {
  const resolvedKind = kind ?? (isGlamour ? 'glamour' : 'spell');
  const payload = {
    character_id: characterId,
    spell_name: name,
    spell_level: resolvedKind === 'spell' ? rank : 0,
    is_memorized: false,
    kind: resolvedKind,
  };
  // ... rest unchanged
```
Existing callers pass `(rank, name)` — optional param keeps them compatible; Enchanter adds now also stamp `kind: 'glamour'` (belt and braces beside the `spell_level: 0` sentinel).

#### 5. Test
**File**: `apps/web/src/test/__tests__/inventory-spells.test.ts`
**Action**: modify — follow the existing `applyMagicOp` pattern (cosmos-fake, `createCharacter`, direct `applyMagicOp` calls):
```ts
it('persists and round-trips the kind discriminator', async () => {
  const { id } = await createCharacter({ ...INPUT, characterClass: 'Enchanter' });
  await applyMagicOp(id, { op: 'addSpell', spell_name: 'Fairy Gold', spell_level: 0, kind: 'rune' });
  await applyMagicOp(id, { op: 'addSpell', spell_name: 'Charm Animal', spell_level: 0, kind: 'glamour' });
  await applyMagicOp(id, { op: 'addSpell', spell_name: 'Legacy Entry', spell_level: 0 });
  const data = await fetchMagicData(id);
  expect(data.spells.find(s => s.spell_name === 'Fairy Gold')!.kind).toBe('rune');
  expect(data.spells.find(s => s.spell_name === 'Charm Animal')!.kind).toBe('glamour');
  expect(data.spells.find(s => s.spell_name === 'Legacy Entry')!.kind).toBeUndefined();
});
```

### Verification
#### Automated
- [ ] `npm test -w @dolmenwood/web` — new test passes, zero existing failures
- [ ] `npm run typecheck` passes
#### Manual
- [ ] Existing Magician and Enchanter sheets render unchanged (legacy entries without `kind` still labeled correctly)

---

## Phase 4: Enchanter Runes UI + label fixes

### Changes

#### 1. RunesSection (new component)
**File**: `apps/web/src/components/character-sheet/magic/RunesSection.tsx`
**Action**: create — mirror `SpellBookSection` structure/styling (`SpellBookSection.tsx`), minus memorized checkbox and rank logic:
```tsx
'use client';
import { useState } from 'react';
import type { DBSpell } from '@/lib/api/spells';
import { getRunesForClass, getRuneTier } from '@dolmenwood/rules-engine';
import { SECTION_HEADER, INPUT_STYLE, SELECT_STYLE } from './types';

interface Props {
  characterClass: string;
  runes: DBSpell[];
  readOnly?: boolean;
  onAdd: (name: string) => Promise<boolean>;
  onDelete: (id: string) => void;
}
```
Behavior:
- Header `Runes Known ({runes.length})` in `SECTION_HEADER`; `+ Add Rune` toggle button (same button styles as `SpellBookSection.tsx:31-40`), hidden when `readOnly`.
- Add form (inline in this component — small enough): a `<select>` (SELECT_STYLE) with three `<optgroup label="Lesser|Greater|Mighty Runes">` built from `getRunesForClass(characterClass)` grouped by tier, plus `<option value="__other__">Other…</option>`; when `__other__`, show a free-text `<input>` (INPUT_STYLE, placeholder "Rune name") — same sentinel pattern as `AddSpellForm.tsx:21-22`. Submit calls `onAdd(name)`, closes on success.
- Empty state: `No runes known. Tap + Add Rune.` (muted, same style as `SpellBookSection.tsx:55-59`).
- Row per rune: surface card (same row styles as `SpellBookSection.tsx:63-68` minus the checkbox), name, sub-label = tier via `getRuneTier(characterClass, rune.spell_name)` → `Lesser Rune` / `Greater Rune` / `Mighty Rune`, fallback `Rune` when null. Delete ✕ button (same as `SpellBookSection.tsx:91-101`), hidden when `readOnly`.

#### 2. MagicTab wiring
**File**: `apps/web/src/components/character-sheet/MagicTab.tsx`
**Action**: modify
- Import `classHasRunes` from `@dolmenwood/rules-engine`, `RunesSection` from `./magic/RunesSection`.
- Derive: `const hasRunes = classHasRunes(character.characterClass);`
- Split entries (before render):
```ts
const runeEntries = magic.spells.filter(s => s.kind === 'rune');
const bookEntries = magic.spells.filter(s => s.kind !== 'rune');
```
- Pass `bookEntries` (not `magic.spells`) to `SpellBookSection`.
- After the `SpellBookSection` block, render:
```tsx
{hasRunes && (
  <RunesSection
    characterClass={character.characterClass}
    runes={runeEntries}
    readOnly={readOnly}
    onAdd={name => magic.addSpell(0, name, 'rune')}
    onDelete={magic.deleteSpell}
  />
)}
```

#### 3. Label fixes
**File**: `apps/web/src/components/character-sheet/magic/SpellBookSection.tsx`
**Action**: modify
- Line 39: `+ Add Spell` → `{isGlamour ? '+ Add Glamour' : '+ Add Spell'}`
- Line 57: `'No glamours recorded. Tap + Add Spell.'` → `'No glamours recorded. Tap + Add Glamour.'` (non-glamour copy unchanged)

### Verification
#### Automated
- [ ] `npm run typecheck` && `npm run lint` && `npm test -w @dolmenwood/web` pass
#### Manual
- [ ] Enchanter sheet: Glamour Circles → Glamours Known → Runes Known; "+ Add Glamour" button label; "+ Add Rune" opens tiered dropdown (3 optgroups, 6 each) + Other free text
- [ ] Add "Fairy Gold" → row shows "Greater Rune"; free-text rune shows "Rune"; delete works; entries survive reload; glamour list does NOT show the rune (split works)
- [ ] Magician sheet unchanged (no Runes section, "+ Add Spell")
- [ ] Level-up an Enchanter: Features step shows "Rune Granted" card
- [ ] PDF export lists rune names in the Spellbook line (acceptable per design)

---

## Phase 5: Kindred innate glamours (Elf/Grimalkin, any class)

### Changes

#### 1. useSpells gate
**File**: `apps/web/src/components/character-sheet/magic/use-spells.ts`
**Action**: modify
- `UseSpellsArgs` gains `innateGlamours?: boolean`.
- Load effect (lines 97-100):
```ts
useEffect(() => {
  if (!spellcaster && !innateGlamours) { setLoading(false); return; }
  loadData();
}, [spellcaster, innateGlamours, loadData]);
```
- `loadData`'s slot auto-init/re-sync guards already require `spellcaster && !isGlamour && slotsData` — a non-caster innate character has `spellcaster === false` and `slotsData === null`, so no slot rows are created. No change there.

#### 2. MagicTab
**File**: `apps/web/src/components/character-sheet/MagicTab.tsx`
**Action**: modify
- Import `hasInnateGlamours` from `@dolmenwood/rules-engine`.
- `const innateGlamours = hasInnateGlamours(character.kindred);` — pass to `useSpells`.
- Empty-state gate (line 30): `if (!spellcaster)` → `if (!spellcaster && !innateGlamours)`.
- Entry classification (replaces Phase 4's two-way split — glamour entries get their own bucket):
```ts
const entryKind = (s: DBSpell) => s.kind ?? (s.spell_level === 0 ? 'glamour' : 'spell');
const runeEntries = magic.spells.filter(s => s.kind === 'rune');
const glamourEntries = magic.spells.filter(s => entryKind(s) === 'glamour');
const spellEntries = magic.spells.filter(s => entryKind(s) === 'spell');
```
(For Enchanter, legacy `spell_level 0` entries classify as glamour — matches today's display inference at `SpellBookSection.tsx:86`.)
- Render layout becomes:
  - `SpellSlotsSection` — only when `spellcaster` (unchanged position)
  - `PreparedSpellsSection` — only when `spellcaster && !isGlamour` (unchanged)
  - Spell book `SpellBookSection` — only when `spellcaster && !isGlamour`: `isGlamour={false}`, `spells={spellEntries}`, `onAdd={(rank, name) => magic.addSpell(rank, name, 'spell')}`
  - Glamours `SpellBookSection` — when `isGlamour || innateGlamours`: `isGlamour={true}`, `validRanks={[]}`, `spells={glamourEntries}`, `onAdd={(rank, name) => magic.addSpell(rank, name, 'glamour')}`. For glamour option lists, `AddSpellForm` calls `getSpellsForClass(characterClass)` which returns `[]` for non-Enchanter classes — the form then offers only the "Other" free-text path, which is correct (innate glamour is "one randomly determined glamour", player types it in). For this instance pass `characterClass="Enchanter"` **only when** `isGlamour` is false? — NO: keep it honest, pass `character.characterClass`; Elf Fighter gets free-text entry. Enchanter (`isGlamour` true) keeps its full dropdown.
  - `RunesSection` — when `hasRunes` (Phase 4, unchanged)

#### 3. Test
**File**: `apps/web/src/test/__tests__/inventory-spells.test.ts`
**Action**: modify — assert no slot rows for a non-caster: create an Elf Fighter character, `fetchMagicData` → `slots` empty, then `addSpell` with `kind: 'glamour'` round-trips. (The UI gate itself is manual-verified; this pins the persistence side.)

### Verification
#### Automated
- [ ] `npm test -w @dolmenwood/web` && `npm run typecheck` && `npm run lint` pass
#### Manual
- [ ] Elf Fighter: Magic tab shows only "Glamours Known" (no slots, no prep, no Rest, no 🚫 empty state); add glamour via free text; persists on reload; API magic GET shows `slots: []`
- [ ] Human Fighter: unchanged 🚫 "no magical abilities"
- [ ] Elf Magician: Spell Slots + Prepared + Spell Book + Glamours Known (both books, entries correctly bucketed)
- [ ] Enchanter: unchanged from Phase 4 (glamours land in the glamour bucket via kind or legacy spell_level 0)
