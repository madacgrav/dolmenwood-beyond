# Design Discussion

## Goal
Bring the character sheet UI to **parity with the printed Dolmenwood sheet** for
the fields we choose to model. Selected scope (per review): surface stored
identity fields, add Magic Resistance save, add Exploring/Overland movement, add
a Kindred & Class Traits box, fix the Speed-source bug, and clean up two naming
nits. **Pellucidium coin is explicitly out.**

## Current State
- Identity: only name, kindred, class, level shown in header (`CharacterSheetHeader.tsx:53,56`). `alignment`, `moonSign`, `background` are stored (`types:70-72`, `cosmos/types.ts:143-145`), captured in the wizard, exported to PDF — but rendered nowhere on the live sheet.
- Saves: 5 rows (Doom/Ray/Hold/Blast/Spell) in both `stats/SavingThrowsSection.tsx:5-11` and `combat/SavingThrowsSection.tsx:7-13`. No Magic Resistance row, though `getMagicResistance(wisScore, kindredBonus)` already exists (`rules-engine/retainers.ts:11`) and kindred bonuses live in `kindreds.json:181,260`.
- Movement: single "Speed" `StatPill` (`stats/CombatStatsSection.tsx:20`), fed by `calculateSpeed(0)` — **hardcoded 0, always 40′** (`StatsTab.tsx:32`). No Exploring (feet/turn) or Overland (travel points) anywhere; no rules-engine functions for them.
- Traits: no freeform "Kindred & Class Traits" field on model or UI. Notes tab has only General/Sessions/People (`NotesTab.tsx:202`).
- Ability labels: INT sublabel is "Intellect" (`stats/AbilityScoresSection.tsx:9`).
- Item type: model enum `weapon/armor/gear/spell_component/ammo/coin` (`types:5`) ≠ AddItemForm options `weapon/armour/gear/consumable/other` (`inventory/types.ts:18`).

## Desired End State
1. Header shows Alignment, Moon Sign, Background alongside name/kindred/class.
2. Both SavingThrows sections show a 6th row: **Magic Resistance**, target from `getMagicResistance(wis, kindredBonus)`.
3. Stats "Combat Stats" shows three movement values: **Speed** (ft/round), **Exploring** (ft/turn), **Overland** (travel points/day), all derived from the character's *real* encumbrance-based speed.
4. A **Kindred & Class Traits** freeform text box, autosaved like General Notes.
5. INT sublabel reads "Intelligence"; AddItemForm item-type options match the model enum.

**Verify:** load a character with non-null alignment/moonSign/background → all three visible in header. A WIS 16 kindred-bonus character → Magic Resistance row shows correct target. Load an encumbered character → Speed pill reflects real weight (not always 40′) and Exploring/Overland update with it. Type in the Traits box → persists across reload. INT card says "Intelligence". Add-item type dropdown matches model enum.

## Patterns to Follow
- **Section component**: each Stats/Combat section is a self-contained component under `stats/` or `combat/` taking derived props from the tab container (`StatsTab.tsx:39-104`, `CombatTab.tsx:50-93`). New movement/traits UI follows this.
- **Derived stats at point of use**: stats are recomputed via `@dolmenwood/rules-engine` calls in the tab container, not stored (`StatsTab.tsx:29-32`). New `getMagicResistance`/movement calls go here.
- **Debounced autosave via onUpdate**: General Notes textarea saves with `onUpdate({ notes })` debounced 1s + "Saved ✓" indicator (`NotesTab.tsx:25-41`). Traits box copies this exactly.
- **Server-tier for new stored fields**: any new persisted field (traits) flows type → `CharacterDoc` → mapper (`lib/data/mappers/character.ts`) → `applyCharacterUpdates`. No new API route needed — `PATCH /api/characters/[id]` already handles partial `Character` updates.
- **StatPill** (`stats/StatPill.tsx`) for the movement values.
- **readOnly threading**: every section takes a `readOnly` prop for the view page (`[id]/view/page.tsx`). New sections must too.

**Do NOT follow**: `calculateSpeed(0)` hardcode (`StatsTab.tsx:32`) — it's the bug we're fixing; wire real equipped weight the way `WeightBar.tsx:12-17` already does.

## Design Decisions
1. **Scope = selective parity**: add the four chosen sheet features + fixes; skip Pellucidium and skip surfacing sex/age/height/weight. — matches review answers.
2. **Identity fields in header**, not a new Stats section — matches printed sheet's top-of-page identity block; smallest change (`CharacterSheetHeader.tsx`).
3. **Magic Resistance reuses existing rules** — call `getMagicResistance(abilityScores.wis, kindredMagicResistanceBonus)`; add the kindred-bonus lookup (read `magicResistance` from `kindreds.json`) if no accessor exists yet. Render as 6th row in both SavingThrows components.
4. **Movement derived from real speed** — fix the speed source to use actual equipped weight (share the `WeightBar` calc), then add `getExplorationRate(speed)` and `getOverlandRate(speed)` to the rules engine. Show all three in `CombatStatsSection`.
5. **Traits = new `traits?: string` field** on `Character`/`CharacterDoc`, rendered as an autosaved textarea. Place it as a section in the **Stats tab** (front-of-sheet on paper), not Notes.
6. **item_type reconcile** — change AddItemForm options to the model enum values (`weapon/armor/gear/spell_component/ammo/coin`) so stored `item_type` is always valid; keep display labels friendly. Verify `deriveCharacterAC`'s shield/armor detection still keys off the right fields (it uses `armorAcBonus`/`isShield`, not `item_type`, so unaffected).
7. **INT label** → "Intelligence" (`AbilityScoresSection.tsx:9`).

## What We're NOT Doing
- Pellucidium coin (no `pp` on `Coins`, purse, or persistence).
- Surfacing sex/age/height/weight on the sheet.
- Persisting Conditions (`combat/ConditionsSection.tsx` stays local state — not on printed sheet).
- Encumbrance Weight-vs-Slots toggle (app is weight-only; printed sheet offers both but we keep weight).
- `armor_bulk` UI (stays model-only; already consumed by AC derivation).
- Any new API routes — reuse existing PATCH.

## Open Risks
- **Exploring/Overland exact numbers unknown**: printed sheet labels Speed "Feet/Round", Exploring "Feet/Turn", Overland "Travel Points/day" — three *different* values. No rules-engine table exists. Exact Speed→Exploring→Overland mapping must be sourced from the Dolmenwood Player's Book (`Dolmenwood_Player_s_Book.pdf` in repo root) before implementing; this is the one item that can block the movement slice.
- **Kindred magic-resistance accessor**: `getMagicResistance` takes a bonus arg but there may be no existing function returning a kindred's `magicResistance` from `kindreds.json` — may need a small `getKindredMagicResistance(kindred)` helper (mirror `getKindredACBonus`).
- **PDF export alignment**: the exporter already maps Magic Resistance/Exploring/Overland as "blank — no app field" (`lib/pdf/character-sheet.ts:21-22`). Once these are modeled, the exporter should populate them too, or the export stays intentionally blank — decide during planning.
