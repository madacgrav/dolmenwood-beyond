# Design Discussion

## Current State

`calculateAC` (`packages/rules-engine/src/ac.ts:11-20`) is a pure formula:
`10 + dexMod + armorBonus + kindredACBonus + classACBonus + shieldBonus`. There is **no
"get a character's AC" function** — each of five display sites assembles `ACInputs` itself,
inconsistently:

- **armorBonus** — hardcoded `0` in StatsTab (`StatsTab.tsx:30`) and Step9AC wizard
  (`Step9AC.tsx:14`); derived via three *duplicated* equipped-armor reducers elsewhere
  (`inventory.ts:58-64`, `characters.ts:82-94`, `pdf/character-sheet.ts:112-114`). Same
  character reads a different AC on Stats tab vs Combat tab whenever armor is equipped —
  **the reported bug.**
- **classACBonus** — hardcoded `0` everywhere, though Friar per-level AC exists
  (`class-advancement.json:892…1088`, values 2→5).
- **shieldBonus** — hardcoded `0` everywhere; a shield is just an equipped item whose
  `armorAcBonus` folds into the armor sum.
- **kindredACBonus** — `getKindredACBonus` (`kindreds.ts:38-43`), only Breggle `+1`
  (`kindreds.json:28`), applied unconditionally despite "unarmoured or light armour" text.

`ACBreakdown` type exists but has no producer (`packages/types/src/index.ts:215-223`).
No AC test covers any app call site (`ac.test.ts` tests the formula with literals only).

## Desired End State

One function `deriveCharacterAC(character, inventory)` in rules-engine is the sole producer
of a character's AC. All five sites call it (or consume its result). It returns an
`ACBreakdown` (base/dexMod/armor/kindred/class/shield/total). AC is **identical** on Stats
tab, Combat tab, roster card, and PDF for the same character. Friar class bonus and shields
are wired. Breggle `+1` is gated by armor worn.

**Verify:** engine unit tests for `deriveCharacterAC` (Friar L1 unarmored, Breggle in
leather vs plate, shield stacking); manual check that a character with equipped armor shows
the same number on Stats and Combat tabs.

## Patterns to Follow

- **Pure engine helper + JSON data lookup** — `getKindredACBonus` reads `kindreds.json`
  (`kindreds.ts:30-43`); `getClassLevel` reads `class-advancement.json`
  (`advancement.ts:32-36`). `deriveCharacterAC` and a new `getClassACBonus` follow this shape.
- **Existing `ACBreakdown` type** (`packages/types/src/index.ts:215-223`) — use as the return
  type instead of inventing one.
- **Server-tier data pattern** (memory): data module → route → `lib/api` wrapper. The roster
  already batch-computes armor server-side (`characters.ts:82-94`); reuse that path.
- **`equippedArmorBonusOf(doc)`** (`inventory.ts:107-112`) already exists — fold the three
  duplicated reducers into the engine helper and delete the divergence.

**Do NOT follow:** the three independent armor reducers (Q3) — collapse them. Do NOT add a
fourth `useEffect` fetch in StatsTab (lift to parent instead).

## Design Decisions

1. **Single source of truth**: new `deriveCharacterAC(character, inventory): ACBreakdown` in
   `packages/rules-engine`. Pure; takes inventory as a param (engine has no DB access).
   Every site routes through it. *(Q2 answer)*

2. **Scope = full**: wire `classACBonus` (Friar) and separate `shieldBonus` out of the armor
   sum. *(Q1 answer)* New `getClassACBonus(className, level)` reads `class-advancement.json`
   `acBonus` (Friar-only today, `0` for other classes).

3. **StatsTab data**: lift equipped-armor (or the full `ACBreakdown`) to the parent character
   page; pass to both CombatTab and StatsTab. Removes CombatTab's independent re-fetch so both
   tabs cannot disagree. *(Q3 answer)*

4. **Breggle gate**: `deriveCharacterAC` drops the kindred bonus when the condition (parsed
   from the `acBonus` string, e.g. "unarmoured or light armour") is unmet — i.e. medium/heavy
   body armor equipped. *(Q4 answer)*

5. **Shield & armor-class identification — real data fields, not runtime name-matching**
   *(user-chosen)*: add `isShield: boolean` and `armorBulk: 'none'|'light'|'medium'|'heavy'|null`
   to `CatalogItemDoc` (`lib/cosmos/types.ts:260-273`) and `InventoryEntryDoc`
   (`lib/cosmos/types.ts:33-44`), plus the domain/client `InventoryItem` shapes. A one-time
   backfill script (pattern: `scripts/seed-catalog.ts`) stamps existing catalog docs and
   embedded inventory entries, using a name→`bulk` map derived from `equipment.json` — the
   fuzzy matching happens **once, offline, inspectable**, not per-render. `use-add-item.ts` /
   `addInventoryItem` copy the new fields at add-time like `armorAcBonus` today
   (`lib/data/inventory.ts:74`). `deriveCharacterAC` then reads fields, never names:
   `isShield` → `shieldBonus`; `armorBulk` → Breggle gate. Null/missing `armorBulk` on
   unmigrated data falls open (bonus kept).

## What We're NOT Doing

- Not touching RetainerCard/MountCard (`RetainerCard.tsx:57`, `MountCard.tsx:49`) — stored
  user-typed `ac`, structurally separate, out of scope.
- Not doing any runtime name-heuristics — classification is data, stamped by the backfill.
- Not full catalog re-seed from legacy Supabase — backfill only adds the two new fields to
  existing docs.
- Not wiring Grimalkin/Woodgrue situational "+2 vs Large" trait (`kindreds.json:196-199`) —
  combat-conditional, not a flat AC term.
- Step9AC keeps `armorBonus: 0` (no inventory exists at creation) but routes through the same
  helper for consistency of the other terms.
- Not building a live catalog re-lookup — inventory keeps its copied `armorAcBonus`.

## Open Risks

1. **Backfill name-mapping needs human review.** Catalog names diverge from `equipment.json`
   armour names (`Chainmail` vs `Chain mail armour`, `Plate mail`/`Full plate` vs
   `Plate armour`, `Step8Equipment.tsx:17-18`). The backfill script must print its proposed
   name→`armorBulk`/`isShield` assignments (and any unmatched armor items) for review before
   writing. One-time cost; runtime code never matches names. Unmigrated/null `armorBulk`
   falls open (Breggle bonus kept).
2. **Embedded inventory backfill touches character docs.** Inventory entries are embedded in
   `CharacterDoc.inventory` (`lib/cosmos/types.ts:151`), so the backfill must sweep character
   documents too, not just `catalog_items` — plus free-text items with no `catalogItemId`
   get `armorBulk: null`/`isShield: false` defaults.
3. **Legacy `armorAcBonus` base is unverifiable** (research Open Areas) — stored values came
   from Supabase; whether they're deltas over base-10 is assumed, not proven. The backfill's
   review output doubles as the audit point: print each armor item's `armorAcBonus` alongside
   `equipment.json`'s absolute `ac` and flag any value ≥10 as suspect.
4. **Shield-vs-armor total is mathematically identical** unless the breakdown is displayed —
   separating `shieldBonus` only changes behavior through the Breggle gate and any UI that
   renders `ACBreakdown`. If no breakdown UI is planned, the separation is low-value cost.
5. **Async lift** — moving armor fetch to the parent page changes the character-page data flow
   (`characters/[id]/page.tsx`) and the referee `/view` route which reuses the tabs.
