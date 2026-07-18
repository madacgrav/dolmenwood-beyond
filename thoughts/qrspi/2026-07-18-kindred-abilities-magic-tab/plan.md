# Implementation Plan

## Overview
Kindred quasi-magical abilities (Glamours, Shape-Shifting, Mad Revelry, Knacks) surface on the renamed "Magic and Abilities" tab; Elf/Grimalkin get a rolled/picked kindred glamour and Mossling a rolled/picked knack — auto-seeded at creation, roll/pick UI for manual + existing characters. Storage rides the existing spellbook `kind` discriminator.

Commands: `pnpm test` (turbo → vitest in rules-engine + web), `pnpm typecheck`, `pnpm lint`.

---

## Phase 1: Kindred Abilities section, empty-state fix, tab rename

### Changes

#### 1. Rules-engine kindred helpers
**File**: `packages/rules-engine/src/kindreds.ts`
**Action**: modify — add below `hasInnateGlamours` (line 67):

```ts
/** Kindred trait names that are quasi-magical and shown on the Magic and Abilities tab. */
export const MAGICAL_KINDRED_TRAITS = ['Glamours', 'Shape-Shifting', 'Mad Revelry', 'Knacks'] as const;

/** Quasi-magical traits for this kindred (subset of getKindredTraits). */
export function getMagicalKindredTraits(kindred: string): KindredTrait[] {
  return getKindredTraits(kindred).filter(t =>
    (MAGICAL_KINDRED_TRAITS as readonly string[]).includes(t.name)
  );
}

/** True when the kindred knows a knack (trait-driven: Mossling). */
export function hasKnacks(kindred: string): boolean {
  return getKindredTraits(kindred).some(t => t.name === 'Knacks');
}
```

#### 2. Tests
**File**: `packages/rules-engine/src/__tests__/kindreds.test.ts`
**Action**: modify — add beside the `hasInnateGlamours` block (lines 89-96):

```ts
describe('getMagicalKindredTraits', () => {
  it('returns Glamours for Elf', () => {
    expect(getMagicalKindredTraits('Elf').map(t => t.name)).toEqual(['Glamours']);
  });
  it('returns Glamours and Shape-Shifting for Grimalkin', () => {
    expect(getMagicalKindredTraits('Grimalkin').map(t => t.name).sort()).toEqual(['Glamours', 'Shape-Shifting']);
  });
  it('returns Mad Revelry for Woodgrue', () => {
    expect(getMagicalKindredTraits('Woodgrue').map(t => t.name)).toEqual(['Mad Revelry']);
  });
  it('returns Knacks for Mossling', () => {
    expect(getMagicalKindredTraits('Mossling').map(t => t.name)).toEqual(['Knacks']);
  });
  it('returns empty for Human and Breggle', () => {
    expect(getMagicalKindredTraits('Human')).toEqual([]);
    expect(getMagicalKindredTraits('Breggle')).toEqual([]);
  });
});

describe('hasKnacks', () => {
  it('is true only for Mossling', () => {
    expect(hasKnacks('Mossling')).toBe(true);
    expect(hasKnacks('Elf')).toBe(false);
    expect(hasKnacks('Human')).toBe(false);
  });
});
```

#### 3. New section component (Phase 1 scope: trait cards only)
**File**: `apps/web/src/components/character-sheet/magic/KindredAbilitiesSection.tsx`
**Action**: create. Structure mirrors `RunesSection.tsx` (section + `SECTION_HEADER` from `./types`). Phase 1 props/render:

```tsx
'use client';
import type { KindredTrait } from '@dolmenwood/rules-engine';
import { SECTION_HEADER } from './types';

interface Props {
  kindred: string;
  traits: KindredTrait[];
}

/** Quasi-magical kindred abilities: trait cards; glamour/knack pickers arrive in later phases. */
export function KindredAbilitiesSection({ kindred, traits }: Props) {
  return (
    <section>
      <h3 style={{ ...SECTION_HEADER, marginBottom: '0.75rem' }}>Kindred Abilities — {kindred}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {traits.map(t => (
          <div key={t.name} style={{
            backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: '8px', padding: '0.625rem 0.875rem',
          }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text)' }}>{t.name}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>{t.description}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
```

#### 4. MagicTab gating + section mount
**File**: `apps/web/src/components/character-sheet/MagicTab.tsx`
**Action**: modify.
- Import `getMagicalKindredTraits` from `@dolmenwood/rules-engine`, `KindredAbilitiesSection` from `./magic/KindredAbilitiesSection`.
- After line 22: `const magicalTraits = getMagicalKindredTraits(character.kindred);`
- Empty-state condition (line 40): `if (!spellcaster && magicalTraits.length === 0)` (drop `innateGlamours` here — superset).
- Render `<KindredAbilitiesSection kindred={character.kindred} traits={magicalTraits} />` as the first section inside the main div (before spell slots) when `magicalTraits.length > 0`.
- Leave section 3b gate (`isGlamour || innateGlamours`) unchanged in this phase.
- Loading skeleton (line 49): non-caster Woodgrue/Mossling have `loading` stuck? No — `use-spells.ts:100` sets `loading=false` for non-caster non-innateGlamour. OK as-is this phase.

#### 5. Tab label rename
**Files**: `apps/web/src/app/(app)/characters/[id]/page.tsx` (line 109), `apps/web/src/app/(app)/characters/[id]/view/page.tsx` (line 91)
**Action**: modify — `{ id: 'magic', label: 'Magic' }` → `{ id: 'magic', label: 'Magic and Abilities' }`. Id unchanged.

### Verification
#### Automated
- [x] `pnpm test` passes (new kindreds tests green)
- [x] `pnpm typecheck` passes
#### Manual
- [ ] Non-caster Woodgrue: tab shows "Mad Revelry" card, no 🚫 empty state
- [ ] Non-caster Mossling: "Knacks" card shown
- [ ] Human Fighter: 🚫 empty state still shown
- [ ] Elf Fighter: Kindred Abilities (Glamours card) + existing "Glamours Known" section both render
- [ ] Tab labeled "Magic and Abilities" on edit and view pages

---

## Phase 2: Kindred glamour — kind extension + roll/pick UI

### Changes

#### 1. `pickRandom` in rules-engine dice
**File**: `packages/rules-engine/src/dice.ts`
**Action**: modify — append:

```ts
/** Uniform random pick from a non-empty list. Returns undefined for an empty list. */
export function pickRandom<T>(list: readonly T[]): T | undefined {
  if (list.length === 0) return undefined;
  return list[Math.floor(Math.random() * list.length)];
}
```

#### 2. Kind union — all layers, both new values at once
**Files/Action**: modify:
- `apps/web/src/lib/cosmos/types.ts` (line ~79): `kind?: 'spell' | 'glamour' | 'rune' | 'kindred-glamour' | 'knack';`
- `apps/web/src/lib/api/spells.ts` (line 34, `DBSpell.kind`): same union.
- `apps/web/src/lib/data/spells.ts` (line 141 allowlist):
```ts
const kind =
  op.kind === 'spell' || op.kind === 'glamour' || op.kind === 'rune' ||
  op.kind === 'kindred-glamour' || op.kind === 'knack'
    ? op.kind
    : undefined;
```

#### 3. use-spells hook
**File**: `apps/web/src/components/character-sheet/magic/use-spells.ts`
**Action**: modify.
- Rename arg `innateGlamours` → `hasKindredMagic` (doc comment: "Kindred grants quasi-magical abilities — load the book even for non-casters."). Update destructure (line 37), load gate (line 100), effect deps (line 102). Only caller is MagicTab.
- `addSpell` signature (line 181): `kind?: 'spell' | 'glamour' | 'rune' | 'kindred-glamour' | 'knack'`. `spell_level` stays `resolvedKind === 'spell' ? rank : 0`.

#### 4. MagicTab wiring
**File**: `apps/web/src/components/character-sheet/MagicTab.tsx`
**Action**: modify.
- `useSpells({ ..., hasKindredMagic: magicalTraits.length > 0 })` (replaces `innateGlamours` arg).
- Entry filters:
```ts
const kindredGlamourEntry = magic.spells.find(s => s.kind === 'kindred-glamour') ?? null;
```
- Section 3b gate: `isGlamour` only (kindred glamour leaves the Enchanter list). `glamourEntries` filter unchanged (legacy inference still lands there).
- Pass to `KindredAbilitiesSection`:
```tsx
<KindredAbilitiesSection
  kindred={character.kindred}
  traits={magicalTraits}
  readOnly={readOnly}
  kindredGlamour={kindredGlamourEntry}
  onRollGlamour={() => {
    const pool = getSpellsForClass('Enchanter').map(s => s.name);
    const name = pickRandom(pool);
    return name ? magic.addSpell(0, name, 'kindred-glamour') : Promise.resolve(false);
  }}
  onPickGlamour={name => magic.addSpell(0, name, 'kindred-glamour')}
  onDelete={magic.deleteSpell}
/>
```
(imports: `getSpellsForClass`, `pickRandom` from `@dolmenwood/rules-engine`.)

#### 5. KindredAbilitiesSection — glamour UI
**File**: `apps/web/src/components/character-sheet/magic/KindredAbilitiesSection.tsx`
**Action**: modify. New props:

```ts
interface Props {
  kindred: string;
  traits: KindredTrait[];
  readOnly?: boolean;
  kindredGlamour?: DBSpell | null;
  onRollGlamour?: () => Promise<boolean>;
  onPickGlamour?: (name: string) => Promise<boolean>;
  onDelete?: (id: string) => void;
}
```

Inside the `Glamours` trait card (match `t.name === 'Glamours'`):
- If `kindredGlamour`: show `kindredGlamour.spell_name` with a "Kindred Glamour" sub-label + ✕ delete button (RunesSection row style, calls `onDelete(kindredGlamour.id)`).
- Else (and not readOnly): "🎲 Roll Glamour" button (calls `onRollGlamour`) + `<select>` of `getSpellsForClass('Enchanter')` names with an Add button (calls `onPickGlamour`) — reuse `SELECT_STYLE` from `./types`, form layout as in `RunesSection.tsx:59-112`.

### Verification
#### Automated
- [x] `pnpm test` passes (incl. `apps/web` `inventory-spells.test.ts`)
- [x] `pnpm typecheck` passes
#### Manual
- [ ] Elf Fighter, no glamour: Glamours card shows Roll + pick; Roll → glamour appears, survives reload (check Cosmos entry has `kind: 'kindred-glamour'`)
- [ ] Delete → Roll/pick UI returns; pick from dropdown works (manual override path)
- [ ] Grimalkin Enchanter: kindred glamour in Kindred Abilities, learned glamours still in "Glamours Known" — separate lists
- [ ] Elf Cleric: spell sections unaffected; kindred glamour section works
- [ ] readOnly view page: no roll/pick/delete controls

---

## Phase 3: Knacks — data module + roll/pick UI + per-level abilities

### Changes

#### 1. Knack data
**File**: `packages/rules-engine/src/data/knacks.json`
**Action**: create. Source: Player's Book p112-113. d6 order 1-6. Shape:

```json
{
  "_source": "Dolmenwood Player's Book, Mossling Knacks (p112-113). d6 table order.",
  "knacks": [
    {
      "name": "Bird Friend",
      "description": "The mossling has learned the secret languages of forest birds and earned their trust.",
      "abilities": [
        { "level": 1, "name": "Bird speech", "description": "Converse with birds and understand their (typically simplistic) replies." },
        { "level": 3, "name": "Bird companion", "description": "Charm a bird companion of Level 1 or less (Save Versus Spell to resist). It remains until dismissed. Only one at a time." },
        { "level": 5, "name": "Twittering message", "description": "Once per day, forest birds relay a message of up to 10 words at 12 miles per hour to a specified person or location." },
        { "level": 7, "name": "Summon flock", "description": "Once per day, call a flock of woodland birds (Level 3, AC 13, HP 3d8, pecks +2 1d6, Fly 40) that serves for 1d4 Turns." }
      ]
    },
    {
      "name": "Lock Singer",
      "description": "The mossling studies closely-guarded songs with the power to charm locks.",
      "abilities": [
        { "level": 1, "name": "Open simple locks", "description": "Per Turn of singing to a simple, mundane lock: 2-in-6 chance it is coaxed open." },
        { "level": 3, "name": "Locate key", "description": "A whispered cant persuades a lock to reveal the location of its key (or the closest, if several exist)." },
        { "level": 5, "name": "Snap shut", "description": "Simple, mundane locks within 30' instantly snap shut after a single Round of song." },
        { "level": 7, "name": "Open any lock", "description": "Any lock opens with a 2-in-6 chance per Turn of singing. Magically sealed locks cooperate, but 1-in-6 chance the magic backfires, sealing the mossling's mouth shut for 1d4 days." }
      ]
    },
    {
      "name": "Root Friend",
      "description": "Dwelling in subterranean burrows, the mossling has a keen affinity with the roots of forest plants.",
      "abilities": [
        { "level": 1, "name": "Root question", "description": "Once per day, ask a root one question about its surroundings; it answers truthfully with 1d6 words." },
        { "level": 3, "name": "Summon roots", "description": "Once per day, summon edible roots to the surface: 1d4 fresh rations." },
        { "level": 5, "name": "Root respite", "description": "Once per day, shelter unnoticed in the roots of a tree or large plant for up to an hour." },
        { "level": 7, "name": "Summon root thing", "description": "Once per day, summon a monstrous root vegetable (Level 3, AC 13, HP 3d8, 2 claws +2 1d4 + entangle). It arrives in 1d6 Rounds and obeys for 1d6 Turns." }
      ]
    },
    {
      "name": "Thread Whistling",
      "description": "A mysterious whistling technique grants sympathetic control over threads and strings within 30'.",
      "abilities": [
        { "level": 1, "name": "Thread mastery", "description": "Whistling ties, unties, or unravels any textile thinner than rope: string, laces, garment fabric." },
        { "level": 3, "name": "Animate threads", "description": "Command loose threads to move up to 5' per Round while whistling. They can drag small objects (up to 20 coins weight) but cannot attack." },
        { "level": 5, "name": "Rope mastery", "description": "Ropes loosen or tighten at the mossling's command." },
        { "level": 7, "name": "Animate rope", "description": "A rope animates to attack and entangle foes (Level 1, AC 13, HP 1d8, grab entangles; constrict 1d3/Round; Save Versus Hold to escape) while the mossling concentrates and whistles." }
      ]
    },
    {
      "name": "Wood Kenning",
      "description": "The mossling's fingers sense the subtle vibrations of tree and wood; 1 Turn of touch gleans knowledge.",
      "abilities": [
        { "level": 1, "name": "Sense history", "description": "Learn the name of a wooden item's creator or of the last person to touch it." },
        { "level": 3, "name": "Sense emotions", "description": "Discern the most recent strong emotion the wood absorbed from a sentient being." },
        { "level": 5, "name": "See beyond", "description": "Gain a momentary image of what lies on the other side of a wooden barrier (a door or wall)." },
        { "level": 7, "name": "True name", "description": "Learn a tree's true name. Once per day, invoke a known tree to glimpse its surroundings; invoking a deceased tree's name provokes a vision of the vegetable afterlife." }
      ]
    },
    {
      "name": "Yeast Master",
      "description": "The mossling hears the chorus of the deep wood's yeasts and fungal spores, and counts them as companions.",
      "abilities": [
        { "level": 1, "name": "Ferment", "description": "Touch ferments sweet liquids (one pint per Turn) into a frothy brew delicious to mosslings; 2-in-6 chance it is palatable to other folk." },
        { "level": 3, "name": "Commune with yeast", "description": "Sip from a drink partly consumed by someone else to learn that person's name." },
        { "level": 5, "name": "Yeasty belch", "description": "Once per day, emit a heady belch at an individual within 10'; target must Save Versus Blast or faint for 1d6 Rounds." },
        { "level": 7, "name": "Yeast feast", "description": "Once per day, conjure a yeasty feast equivalent to 1d6 fresh rations." }
      ]
    }
  ]
}
```

#### 2. Knacks module
**File**: `packages/rules-engine/src/knacks.ts`
**Action**: create:

```ts
import knackData from './data/knacks.json';

export interface KnackAbility {
  level: number;
  name: string;
  description: string;
}

export interface Knack {
  name: string;
  description: string;
  abilities: KnackAbility[];
}

/** All six mossling knacks, in rulebook d6 order. */
export function getKnacks(): Knack[] {
  return knackData.knacks as Knack[];
}

export function getKnack(name: string): Knack | null {
  return getKnacks().find(k => k.name === name) ?? null;
}
```

**File**: `packages/rules-engine/src/index.ts`
**Action**: modify — add `export * from './knacks';`

#### 3. Tests
**File**: `packages/rules-engine/src/__tests__/knacks.test.ts`
**Action**: create:

```ts
import { describe, it, expect } from 'vitest';
import { getKnacks, getKnack } from '../knacks';

describe('getKnacks', () => {
  it('returns six knacks in d6 order', () => {
    expect(getKnacks().map(k => k.name)).toEqual([
      'Bird Friend', 'Lock Singer', 'Root Friend',
      'Thread Whistling', 'Wood Kenning', 'Yeast Master',
    ]);
  });
  it('each knack has abilities at levels 1, 3, 5, 7', () => {
    for (const k of getKnacks()) {
      expect(k.abilities.map(a => a.level)).toEqual([1, 3, 5, 7]);
    }
  });
});

describe('getKnack', () => {
  it('round-trips by name and returns null for unknown', () => {
    expect(getKnack('Wood Kenning')?.abilities).toHaveLength(4);
    expect(getKnack('Nope')).toBeNull();
  });
});
```

#### 4. MagicTab wiring
**File**: `apps/web/src/components/character-sheet/MagicTab.tsx`
**Action**: modify — `const knackEntry = magic.spells.find(s => s.kind === 'knack') ?? null;` and pass:

```tsx
knack={knackEntry}
characterLevel={character.level}
onRollKnack={() => {
  const name = pickRandom(getKnacks().map(k => k.name));
  return name ? magic.addSpell(0, name, 'knack') : Promise.resolve(false);
}}
onPickKnack={name => magic.addSpell(0, name, 'knack')}
```
(import `getKnacks`.)

#### 5. KindredAbilitiesSection — knack UI
**File**: `apps/web/src/components/character-sheet/magic/KindredAbilitiesSection.tsx`
**Action**: modify. New props: `knack?: DBSpell | null; characterLevel?: number; onRollKnack?: () => Promise<boolean>; onPickKnack?: (name: string) => Promise<boolean>;`

Inside the `Knacks` trait card (`t.name === 'Knacks'`):
- If `knack`: look up `getKnack(knack.spell_name)`; render knack name + ✕ delete; below, list its 4 abilities — each `{a.name} (Level {a.level}): {a.description}`; abilities with `a.level <= characterLevel` full opacity, others dimmed (`opacity: 0.45`) with a "Level {a.level}" badge. Unknown name (free-text legacy): render name only.
- Else (not readOnly): "🎲 Roll Knack (d6)" button (`onRollKnack`) + `<select>` of the 6 knack names + Add (`onPickKnack`) — same form layout as glamour picker.

### Verification
#### Automated
- [x] `pnpm test` passes (knacks tests green)
- [x] `pnpm typecheck` passes
#### Manual
- [ ] Mossling (any class): Knacks card shows Roll (d6) + pick; roll persists `kind:'knack'`, survives reload
- [ ] Level 1 Mossling: only Level 1 ability full-opacity; Levels 3/5/7 dimmed
- [ ] Bump character level to 5 (edit sheet): Level 1/3/5 abilities now active
- [ ] Delete knack → picker returns; pick works
- [ ] Non-Mossling kindreds: no knack UI

---

## Phase 4: Auto-wizard creation seeding

### Changes

#### 1. Seed kindred abilities at auto complete
**File**: `apps/web/src/app/(app)/characters/new/auto/complete/page.tsx`
**Action**: modify.
- Imports: `hasInnateGlamours, hasKnacks, getSpellsForClass, getKnacks, pickRandom` from `@dolmenwood/rules-engine`; `insertCharacterSpell` from `@/lib/api/spells`.
- New fn beside `seedInventory`:

```ts
/** Best-effort: rolls the kindred's random glamour/knack. Failures are logged and skipped. */
async function seedKindredAbilities(characterId: string, kindred: string) {
  try {
    if (hasInnateGlamours(kindred)) {
      const name = pickRandom(getSpellsForClass('Enchanter').map(s => s.name));
      if (name) {
        await insertCharacterSpell(characterId, {
          character_id: characterId, spell_name: name, spell_level: 0,
          is_memorized: false, kind: 'kindred-glamour',
        });
      }
    }
    if (hasKnacks(kindred)) {
      const name = pickRandom(getKnacks().map(k => k.name));
      if (name) {
        await insertCharacterSpell(characterId, {
          character_id: characterId, spell_name: name, spell_level: 0,
          is_memorized: false, kind: 'knack',
        });
      }
    }
  } catch (e) {
    console.error('kindred ability seed failed', e);
  }
}
```

- Call site (line 88, after `seedInventory`):
```ts
await seedInventory(id, wizard.equipment, wizard.startingGold);
await seedKindredAbilities(id, wizard.kindred ?? 'Human');
```

Manual complete page: untouched (user decision — tab UI is the override path).

### Verification
#### Automated
- [x] `pnpm typecheck` passes
#### Manual
- [ ] Auto wizard as Elf Fighter → finish → sheet already shows a kindred glamour
- [ ] Auto wizard as Mossling → knack present with level abilities
- [ ] Auto wizard as Grimalkin → kindred glamour present (Shape-Shifting card too)
- [ ] Auto wizard as Human Fighter → nothing seeded, no console errors
- [ ] Manual wizard as Elf → no auto glamour; tab roll/pick available

---

## Phase 5: PDF export pass + docs

### Changes

#### 1. PDF export
**File**: `apps/web/src/lib/pdf/character-sheet.ts`
**Action**: modify. Current spells block (lines ~190-209) is gated by `isSpellcaster` — kindred glamour/knack entries on non-casters never print.
- Before the `isSpellcaster` block, pull kindred entries:
```ts
const kindredGlamour = c.spellbook.find(s => s.kind === 'kindred-glamour');
const knack = c.spellbook.find(s => s.kind === 'knack');
```
- Add their lines to the same notes/spell text area used by the block (append regardless of caster status):
  - `Kindred Glamour: <spellName>` when present
  - `Knack: <spellName>` when present
- In the existing `Spellbook:` line, exclude `kind === 'kindred-glamour'` and `kind === 'knack'` entries so they don't double-print.
- Requires `SpellbookEntryDoc.kind` (already widened in Phase 2) — confirm the `c.spellbook` type used here carries `kind` (it maps from `CharacterDoc`); if the PDF uses a UI-mapped shape, thread `kind` through that mapper.

#### 2. Tests
**File**: `apps/web/src/test/__tests__/pdf-export.test.ts`
**Action**: modify only if existing assertions break; add one assertion that a character with a `kind:'kindred-glamour'` entry emits `Kindred Glamour:` text.

#### 3. Docs
**Files/Action**: modify:
- `README.md` line 8: "Stats, Combat, Inventory, Magic, Notes" → "Stats, Combat, Inventory, Magic and Abilities, Notes"
- `.github/copilot-instructions.md` lines 38, 76: same label update ("MagicTab" component name unchanged).

### Verification
#### Automated
- [ ] `pnpm test` passes (pdf-export tests)
- [ ] `pnpm lint` passes
#### Manual
- [ ] Export PDF for a non-caster Elf with kindred glamour: "Kindred Glamour: X" printed
- [ ] Export PDF for Mossling with knack: "Knack: Y" printed
- [ ] Export PDF for Magician: spellbook line unchanged, no kindred lines

---

## Notes for the implementer
- `entryKind` legacy inference (`MagicTab.tsx:27`) must stay: entries with no `kind` and `spell_level === 0` are Enchanter-style glamours, NOT kindred glamours. New entries always carry explicit `kind`.
- Do not use inline `Math.random()` in components — `pickRandom` from rules-engine (Phase 2 adds it).
- `useSpells` arg rename (`innateGlamours` → `hasKindredMagic`) has exactly one caller: `MagicTab.tsx:24`.
- Kindred glamour and knack entries use `spell_level: 0` and never appear in `glamourEntries`/`spellEntries`/`runeEntries` filters because those check `kind` first (`entryKind` returns the explicit kind when present).
- Wait — `entryKind(s)` returns `s.kind` when set, so `kind:'kindred-glamour'` never equals `'glamour'`: filters are safe as written.
