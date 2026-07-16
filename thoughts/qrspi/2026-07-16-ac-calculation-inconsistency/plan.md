# Implementation Plan

## Overview
One pure engine function `deriveCharacterAC(character, items)` becomes the sole producer of a
character's AC (returning `ACBreakdown`). Every display site routes through it, so Stats tab,
Combat tab, roster, and PDF show the same number. Friar class bonus and shields are wired;
Breggle (and Friar) bonuses gate on armor worn using new `isShield`/`armorBulk` item fields.

**Verification commands** (repo root):
- `npm test` — all packages (vitest via turbo). Scoped: `npx turbo test --filter=@dolmenwood/rules-engine`.
- `npm run typecheck` — turbo typecheck across packages.
- `npm run lint` — turbo lint.

**Key rules facts** (verified): `calculateAC` = `10 + dexMod + armor + kindred + class + shield`
(`ac.ts:11`). Friar `class-advancement.json` has per-level `acBonus` (L1 = 2), described as an
**unarmoured** bonus (`advancement.ts:152`). Only Breggle has kindred `acBonus`:
`"+1 AC (unarmoured or light armour)"` (`kindreds.json:28`). Stored inventory `itemType` for armor
is spelled `'armour'` (`use-add-item.ts:54`) — so classification must use the new fields, never
`itemType`.

---

## Phase 1: Engine core — `deriveCharacterAC` + `getClassACBonus` + armor gate

### Changes

#### 1. `ArmorBulk` type
**File**: `packages/types/src/index.ts`
**Action**: modify — add near `ItemType` (line 8).
```ts
export type ArmorBulk = 'none' | 'light' | 'medium' | 'heavy';
```
`ACBreakdown` already exists (`index.ts:215-223`) — reuse as the return type, no change.

#### 2. `getClassACBonus`
**File**: `packages/rules-engine/src/advancement.ts`
**Action**: modify — add after `getAttackBonus` (line 40).
```ts
/** Class-granted AC bonus for this level (Friar's unarmoured defence; 0 for other classes). */
export function getClassACBonus(className: string, level: number): number {
  const lvl = getClassLevel(className, level) as (ClassLevel & { acBonus?: number }) | null;
  return typeof lvl?.acBonus === 'number' ? lvl.acBonus : 0;
}
```

#### 3. Kindred gate helper
**File**: `packages/rules-engine/src/kindreds.ts`
**Action**: modify — add after `getKindredACBonus` (line 43).
```ts
/** True when the kindred's AC bonus is conditional on light/no armour (e.g. Breggle). */
export function isKindredACBonusArmorConditional(kindred: string): boolean {
  const s = getKindredData(kindred)?.acBonus ?? '';
  return /unarmoured|light/i.test(s);
}
```

#### 4. New engine file `character-ac.ts`
**File**: `packages/rules-engine/src/character-ac.ts`
**Action**: create.
```ts
import type { ACBreakdown, ArmorBulk } from '@dolmenwood/types';
import { calculateAC } from './ac';
import { getAbilityModifier } from './ability-modifiers';
import { getKindredACBonus, isKindredACBonusArmorConditional } from './kindreds';
import { getClassACBonus } from './advancement';

/** Minimal per-item shape the AC calc needs. Callers map their own inventory type to this. */
export interface ACItem {
  location: string; // 'equipped' | 'stowed' | 'tiny'
  armorAcBonus?: number | null;
  isShield?: boolean | null;
  armorBulk?: ArmorBulk | null;
}

export interface CharacterACInput {
  abilityScores: { dex: number };
  kindred: string;
  characterClass: string;
  level: number;
}

/** Sole producer of a character's AC. Shields split from body armour; kindred/class
 *  unarmoured-defence bonuses drop when medium/heavy body armour is worn.
 *  ponytail: one gate (no medium/heavy body armour) covers both Breggle ("unarmoured or
 *  light") and Friar ("unarmoured") — slightly looser than strict-unarmoured for the Friar
 *  in light armour; tighten if a strict-unarmoured class bonus is ever added. Null armorBulk
 *  (unmigrated data) falls open — bonus kept. */
export function deriveCharacterAC(char: CharacterACInput, items: ACItem[]): ACBreakdown {
  const equipped = items.filter((i) => i.location === 'equipped');
  const shieldItems = equipped.filter((i) => i.isShield);
  const bodyArmor = equipped.filter((i) => !i.isShield);

  const shieldBonus = shieldItems.reduce((s, i) => s + (i.armorAcBonus ?? 0), 0);
  const armorBonus = bodyArmor.reduce((s, i) => s + (i.armorAcBonus ?? 0), 0);

  const hasMediumOrHeavy = bodyArmor.some(
    (i) => i.armorBulk === 'medium' || i.armorBulk === 'heavy',
  );
  const lightOrUnarmoured = !hasMediumOrHeavy;

  const rawKindred = getKindredACBonus(char.kindred);
  const kindredBonus =
    isKindredACBonusArmorConditional(char.kindred) && !lightOrUnarmoured ? 0 : rawKindred;

  const rawClass = getClassACBonus(char.characterClass, char.level);
  const classBonus = lightOrUnarmoured ? rawClass : 0;

  const dexModifier = getAbilityModifier(char.abilityScores.dex);
  const total = calculateAC({
    dexScore: char.abilityScores.dex,
    armorBonus,
    kindredACBonus: kindredBonus,
    classACBonus: classBonus,
    shieldBonus,
  });

  return { base: 10, dexModifier, armorBonus, kindredBonus, classBonus, shieldBonus, total };
}
```

#### 5. Export
**File**: `packages/rules-engine/src/index.ts`
**Action**: modify — add line.
```ts
export * from './character-ac';
```

#### 6. Tests
**File**: `packages/rules-engine/src/__tests__/character-ac.test.ts`
**Action**: create.
```ts
import { describe, it, expect } from 'vitest';
import { deriveCharacterAC } from '../character-ac';

const base = { abilityScores: { dex: 10 }, kindred: 'Human', characterClass: 'Fighter', level: 1 };
const eq = (o: object) => ({ location: 'equipped', ...o });

describe('deriveCharacterAC', () => {
  it('base 10 with no items', () => {
    expect(deriveCharacterAC(base, []).total).toBe(10);
  });
  it('Friar L1 unarmoured gets +2 class bonus → 12', () => {
    expect(deriveCharacterAC({ ...base, characterClass: 'Friar' }, []).total).toBe(12);
  });
  it('Friar in medium/heavy armour loses class bonus', () => {
    const items = [eq({ armorAcBonus: 4, armorBulk: 'heavy' })];
    const b = deriveCharacterAC({ ...base, characterClass: 'Friar' }, items);
    expect(b.classBonus).toBe(0);
    expect(b.total).toBe(14); // 10 + 4 armour
  });
  it('Breggle keeps +1 in light armour', () => {
    const items = [eq({ armorAcBonus: 2, armorBulk: 'light' })];
    const b = deriveCharacterAC({ ...base, kindred: 'Breggle' }, items);
    expect(b.kindredBonus).toBe(1);
    expect(b.total).toBe(13); // 10 + 2 + 1
  });
  it('Breggle loses +1 in plate', () => {
    const items = [eq({ armorAcBonus: 6, armorBulk: 'heavy' })];
    expect(deriveCharacterAC({ ...base, kindred: 'Breggle' }, items).kindredBonus).toBe(0);
  });
  it('shield splits from armour and stacks', () => {
    const items = [eq({ armorAcBonus: 2, armorBulk: 'light' }), eq({ armorAcBonus: 1, isShield: true })];
    const b = deriveCharacterAC(base, items);
    expect(b.armorBonus).toBe(2);
    expect(b.shieldBonus).toBe(1);
    expect(b.total).toBe(13);
  });
  it('null armorBulk falls open (Breggle keeps bonus)', () => {
    const items = [eq({ armorAcBonus: 2, armorBulk: null })];
    expect(deriveCharacterAC({ ...base, kindred: 'Breggle' }, items).kindredBonus).toBe(1);
  });
  it('stowed items ignored', () => {
    const items = [{ location: 'stowed', armorAcBonus: 5 }];
    expect(deriveCharacterAC(base, items).armorBonus).toBe(0);
  });
});
```

### Verification
#### Automated
- [x] `npx turbo test --filter=@dolmenwood/rules-engine` passes (new + existing `ac.test.ts`, `kindreds.test.ts`, `advancement.test.ts`) — 170 tests green
- [x] `npm run typecheck` clean

#### Manual
- [x] None (pure engine; no app behavior change yet).

---

## Phase 2: Rewire all display sites → `deriveCharacterAC`

Items at each site have no `isShield`/`armorBulk` yet (added Phase 3) — the function falls open,
so this phase delivers **armor consistency** (the reported bug) with shield/gate inert.

### Changes

#### 1. Character detail page — lift inventory + compute breakdown, pass to both tabs
**File**: `apps/web/src/app/(app)/characters/[id]/page.tsx`
**Action**: modify. Add inventory fetch + breakdown; pass `acBreakdown` to StatsTab & CombatTab.
```ts
// imports
import { listInventory, type InventoryItem } from '@/lib/api/inventory';
import { deriveCharacterAC, type ACItem } from '@dolmenwood/rules-engine';

// state
const [items, setItems] = useState<InventoryItem[]>([]);
useEffect(() => { listInventory(id).then(setItems); }, [id]);

// derive once (character may be null during load)
const acItems: ACItem[] = items.map((i) => ({
  location: i.location,
  armorAcBonus: i.armor_ac_bonus,
  isShield: i.is_shield,       // added Phase 3; undefined until then → falls open
  armorBulk: i.armor_bulk,
}));
const acBreakdown = character ? deriveCharacterAC(character, acItems) : null;
```
Then:
```tsx
{activeTab === 'stats' && <StatsTab character={character} acBreakdown={acBreakdown} editMode={editMode} onUpdate={handleUpdate} />}
{activeTab === 'combat' && <CombatTab character={character} characterId={id} acBreakdown={acBreakdown} />}
```
(Referee `/view` route reuses these tabs — apply the same lift there; see step 6.)

#### 2. StatsTab — consume prop, drop local AC assembly
**File**: `apps/web/src/components/character-sheet/StatsTab.tsx`
**Action**: modify.
- Add `acBreakdown: ACBreakdown | null` to `Props`.
- Delete the `calculateAC(...)` call (line 30) and `getKindredACBonus`/`calculateAC` imports.
- `const ac = acBreakdown?.total ?? 10;`

#### 3. CombatTab — consume prop, remove independent armor fetch
**File**: `apps/web/src/components/character-sheet/CombatTab.tsx`
**Action**: modify.
- Add `acBreakdown: ACBreakdown | null` to `Props`; `const ac = acBreakdown?.total ?? 10;`.
- Delete `equippedArmorBonus` state, the `fetchEquippedArmorBonus` call in the `useEffect` (line 35), the `calculateAC(...)` block (lines 46-52), and `calculateAC`/`getKindredACBonus`/`fetchEquippedArmorBonus` imports (keep `listEquippedWeapons`).
- `dexMod` stays (used by `ArmourClassSection`).

#### 4. Roster — compute full AC server-side
**File**: `apps/web/src/lib/data/characters.ts`
**Action**: modify `listCharactersWithArmor` → return `acByCharacter` (full total).
```ts
import { deriveCharacterAC, type ACItem } from '@dolmenwood/rules-engine';

export async function listCharactersWithArmor(): Promise<{
  characters: Character[];
  acByCharacter: Record<string, number>;
}> {
  const docs = await listCharacterDocs();
  const acByCharacter: Record<string, number> = {};
  for (const doc of docs) {
    const items: ACItem[] = (doc.inventory ?? []).map((e) => ({
      location: e.location, armorAcBonus: e.armorAcBonus, isShield: e.isShield, armorBulk: e.armorBulk,
    }));
    acByCharacter[doc.id] = deriveCharacterAC(doc, items).total;
  }
  return { characters: docs.map(docToCharacter), acByCharacter };
}
```
(`doc` satisfies `CharacterACInput` — has `abilityScores`, `kindred`, `characterClass`, `level`.
`e.isShield`/`e.armorBulk` added Phase 3; `undefined` until then, falls open.)

#### 5. Roster plumbing — rename `armorByCharacter` → `acByCharacter`
**Files**:
- `apps/web/src/lib/api/characters.ts` (`listCharacters` return: `acByCharacter`, default `{}`) — lines 19-32.
- `apps/web/src/hooks/use-characters.ts` — state `acByCharacter`, return it — lines 10,16-21,64.
- `apps/web/src/app/(app)/characters/page.tsx` — destructure `acByCharacter`, pass `ac={acByCharacter[character.id] ?? 10}` — lines 11,127.
- `apps/web/src/components/characters/CharacterCard.tsx` — prop `ac: number` replaces `armorBonus`; delete the `calculateAC(...)` block (lines 23-29) and `calculateAC`/`getKindredACBonus` imports (keep `getAttackBonus`); use `ac` directly at line 126.

#### 6. Referee view route
**File**: `apps/web/src/app/(app)/characters/[id]/view/page.tsx`
**Action**: modify — mirror step 1's inventory fetch + `deriveCharacterAC`, pass `acBreakdown` to its `CombatTab`/`StatsTab`.

#### 7. PDF exporter
**File**: `apps/web/src/lib/pdf/character-sheet.ts`
**Action**: modify — replace inline reduce + `calculateAC` (lines 111-124).
```ts
const acItems: ACItem[] = c.inventory.map((e) => ({
  location: e.location, armorAcBonus: e.armorAcBonus, isShield: e.isShield, armorBulk: e.armorBulk,
}));
set('Armour Class', deriveCharacterAC(c, acItems).total);
```
Update imports: add `deriveCharacterAC, type ACItem`; drop `calculateAC`, `getKindredACBonus` if now unused.

#### 8. Step9AC wizard — route through helper (no inventory at creation)
**File**: `apps/web/src/components/wizard/steps/Step9AC.tsx`
**Action**: modify.
```ts
import { deriveCharacterAC } from '@dolmenwood/rules-engine';
const breakdown = deriveCharacterAC(
  { abilityScores, kindred: kindred ?? 'Human', characterClass: characterClass ?? 'Fighter', level: 1 },
  [],
);
const ac = breakdown.total;
```
Confirm `characterClass` is available from `useWizardStore()`; if not, read it from the store
(it is set in an earlier step). Rows display can keep using `breakdown.dexModifier`,
`breakdown.kindredBonus`, `breakdown.classBonus`.

#### 9. Remove now-orphaned `fetchEquippedArmorBonus`
**File**: `apps/web/src/lib/api/inventory.ts`
**Action**: delete `fetchEquippedArmorBonus` (lines 58-64) only if grep shows no remaining callers.
Leave `equippedArmorBonusOf` (`lib/data/inventory.ts:107-112`) — unrelated; not touched.

### Verification
#### Automated
- [ ] `npm run typecheck` clean (all rename sites updated)
- [ ] `npm test` green
- [ ] `npm run lint` clean
- [ ] `grep -rn "armorByCharacter\|fetchEquippedArmorBonus" apps/web/src` returns nothing

#### Manual
- [ ] Character with equipped armour shows the **same** AC on Stats tab, Combat tab, roster card, and PDF export.
- [ ] Referee `/characters/[id]/view` shows the same AC as the owner sheet.

---

## Phase 3: Data model — `isShield` + `armorBulk` fields end-to-end

### Changes

#### 1. Cosmos doc shapes
**File**: `apps/web/src/lib/cosmos/types.ts`
**Action**: modify.
- `CatalogItemDoc` (after line 269): `isShield: boolean;` and `armorBulk: ArmorBulk | null;`
- `InventoryEntryDoc` (after line 42): `isShield?: boolean;` and `armorBulk?: ArmorBulk | null;` (optional — absent on pre-migration docs)
- Import `ArmorBulk` from `@dolmenwood/types` at top.

#### 2. Domain + client item types
**Files**:
- `packages/types/src/index.ts` — `InventoryItem` (after line 157): `isShield?: boolean; armorBulk?: ArmorBulk;`
- `apps/web/src/lib/api/inventory.ts` — client `InventoryItem` (after line 19): `is_shield?: boolean; armor_bulk?: ArmorBulk | null;` (import `ArmorBulk` from `@dolmenwood/types`)

#### 3. Server mapping + write path
**File**: `apps/web/src/lib/data/inventory.ts`
**Action**: modify.
- `entryToItem` (line 13): add `is_shield: e.isShield ?? false, armor_bulk: e.armorBulk ?? null,`.
- `NewInventoryEntryInput` (line 45): add `is_shield?: boolean; armor_bulk?: ArmorBulk | null;`.
- `addInventoryItem` entry build (line 63): add `isShield: input.is_shield ?? false, armorBulk: input.armor_bulk ?? null,`.

#### 4. Catalog read → expose fields
**File**: `apps/web/src/lib/data/catalog.ts` — no change (`SELECT *` already returns new fields).
**File**: `apps/web/src/app/api/catalog/route.ts` — no change (returns docs verbatim).

#### 5. Add-item flow copies fields from catalog
**Files**:
- `apps/web/src/components/character-sheet/inventory/types.ts` — `CatalogItem` (line 4): add `is_shield: boolean; armor_bulk: ArmorBulk | null;`. `NewItemDraft` (line 34): add `is_shield: boolean; armor_bulk: ArmorBulk | null;`. `EMPTY_DRAFT` gets `is_shield: false, armor_bulk: null`.
- `apps/web/src/components/character-sheet/inventory/use-add-item.ts`:
  - catalog fetch mapping (lines 33-47): pull `isShield`, `armorBulk` from the doc into `is_shield`, `armor_bulk`.
  - `selectCatalogItem` (line 55): copy `is_shield: cat.is_shield, armor_bulk: cat.armor_bulk` into the draft.
  - `addItem` payload (line 69): add `is_shield: newItem.is_shield, armor_bulk: newItem.armor_bulk`.
  - `EMPTY_DRAFT` (line 6): add the two defaults.

#### 6. Enable Phase 2's field reads
The `i.is_shield`/`i.armor_bulk` and `e.isShield`/`e.armorBulk` references added in Phase 2 now
resolve to real fields — no code change, just types line up. Confirm typecheck.

### Verification
#### Automated
- [ ] `npm run typecheck` clean
- [ ] `npm test` green

#### Manual
- [ ] Seed one catalog doc locally with `isShield:true` (or via Phase 4 dry-run apply), add it to a character → AC breakdown shows a shield contribution separate from body armour.
- [ ] Equip a `armorBulk:'heavy'` item on a Breggle character → kindred +1 drops; on a Friar → class +2 drops.

---

## Phase 4: Backfill script for existing catalog + character docs

### Changes

#### 1. Backfill script
**File**: `scripts/backfill-armor-classification.ts`
**Action**: create (pattern: `scripts/seed-catalog.ts` — CosmosClient, env `COSMOS_ENDPOINT`/`COSMOS_KEY`).
Logic:
```ts
// name → classification, derived from equipment.json armour array (bulk field; Shield → isShield)
import equipment from '../packages/rules-engine/src/data/equipment.json';
const BULK_MAP: Record<string, 'none'|'light'|'medium'|'heavy'> = {
  none: 'none', light: 'light', medium: 'medium', heavy: 'heavy',
};
function classify(name: string): { isShield: boolean; armorBulk: string | null } {
  const n = name.trim().toLowerCase();
  if (n.includes('shield')) return { isShield: true, armorBulk: 'none' };
  // fuzzy match against equipment.json armour names (normalise: strip 'armour'/'mail', collapse spaces)
  const entry = equipment.armour.find((a) => normalise(a.name) === normalise(name));
  return { isShield: false, armorBulk: entry ? BULK_MAP[String(entry.bulk).toLowerCase()] ?? null : null };
}
```
- `--dry-run` (default): print a table — for every `catalog_items` armour doc AND every embedded
  `CharacterDoc.inventory[]` armour entry (itemType `armor`/`armour` or `armorAcBonus != null`):
  `name | armorAcBonus | proposed armorBulk | isShield | equipment.json ac`. Flag **unmatched**
  (`armorBulk: null`) and **suspect** (`armorAcBonus >= 10`, i.e. possibly an absolute AC). Write nothing.
- `--apply`: upsert `catalog_items` docs with `isShield`/`armorBulk`; for each `characters` doc,
  set the fields on matching embedded inventory entries and `replace` the doc. Free-text/non-armour
  items → `isShield:false`, `armorBulk:null`.
- Idempotent (re-run yields zero pending).

### Verification
#### Automated
- [ ] `npx tsx scripts/backfill-armor-classification.ts --dry-run` runs, prints the table.
- [ ] `npm run typecheck` clean (script compiles).

#### Manual
- [ ] Review the dry-run table: confirm `Chain mail armour`→medium, `Plate armour`→heavy, `Leather`→light, `Shield`→isShield; resolve any **unmatched** armour names by extending `normalise`/alias map; investigate any **suspect** `armorAcBonus >= 10`.
- [ ] `--apply`, then re-run `--dry-run` → zero pending changes.
- [ ] Spot-check a Breggle-in-plate and a Friar-in-plate existing character → bonus now gated.

---

## Testing Checkpoints
- **After P1**: `deriveCharacterAC` correct in isolation; no app change.
- **After P2**: reported bug fixed — identical AC across Stats/Combat/roster/PDF/view. Shield/gate present but inert (no field data).
- **After P3**: new shield/armour items classified at add-time; shield split + gate active for new data.
- **After P4**: existing items classified; gate/shield correct for all characters.

## Deviations from structure.md
- **Extended the armor gate to the Friar class bonus** (structure specced the gate for kindred only). The Friar `acBonus` is a documented *unarmoured* defence bonus (`advancement.ts:152`); applying it unconditionally in plate would be a new rules bug. Both kindred and class bonuses now share one gate (no medium/heavy body armour). Noted as a `ponytail:` ceiling in `character-ac.ts` (looser than strict-unarmoured for a Friar in light armour).
- **Roster returns full AC (`acByCharacter`), not armor** — `CharacterCard` can't run the gate/shield split (no inventory items on the client), so the total is computed server-side where inventory docs exist. This renames the existing `armorByCharacter` contract through the roster chain.
