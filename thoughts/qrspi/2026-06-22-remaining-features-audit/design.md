# Design Discussion — Remaining-Feature Roadmap

This is a steering document for closing the genuine gaps the audit found. It is a
**prioritized roadmap**, not a single-feature spec — each slice is sized and
sequenced so later phases (`4_structure`, `5_plan`) can pick them up one at a time.

## Current State

The app is far more complete than `copilot-instructions.md` implies. Rules-engine
covers all 11 PRD §6 derived stats (`research.md` Q7). Campaign/bank/schedule and
the auto + import creation paths are fully wired end-to-end (Q1, Q4). The confirmed
gaps:

- **Manual creation stops at step 7.** Steps 8–13 render `"… — coming soon"` + skip
  links (`manual/[step]/page.tsx:36-51`); no `ManualStep8`–`13` exist.
- **Three optional-rules toggles are stored-but-unused** — `subParReroll`,
  `hpRerollLowRolls`, `coinWeightEnabled` persist via `use-optional-rules.ts:10`
  but nothing reads them (Q6).
- **Roster AC is wrong** — `CharacterCard.tsx:24-25` hardcodes `armorBonus:0` and
  `kindredACBonus:0` into `calculateAC`.
- **`/party` is a dead stub** (`party/page.tsx:1-8`), not in `BottomNav` (Q4/Q5).
- **PWA icons are a placeholder SVG** — no 192/512 PNGs (`public/icons/`).
- **No dice-roller tab** — PRD §5.2 nav item, never built (Q5).
- **`copilot-instructions.md` is stale** (calls `campaign/` a stub; the real stub is
  `/party`).

## Desired End State

1. Manual creation is a true peer of auto — all 13 steps render real components and a
   character saves successfully through `/manual/complete`.
2. All three optional-rules toggles change observable behavior (reroll prompts in
   creation/level-up; coin weight in the encumbrance bar).
3. Roster cards show AC that matches the character sheet's Combat-tab AC.
4. `/party` route is gone; no orphan routes.
5. Installed PWA shows real raster icons on iOS/Android home screens.
6. A dice-roller surface exists in-nav (PRD parity).
7. `copilot-instructions.md` reflects reality.

**Verification:** manual creation completes & persists; toggling each rule visibly
changes a roll/encumbrance; roster AC == sheet AC for a character with armor; `/party`
404s/removed; Lighthouse PWA install uses PNG icons; dice tab reachable from nav.

## Patterns to Follow

- **End-to-end data pattern** (`research.md:121`): UI component → `lib/data/*` helper →
  Supabase RPC or table DML. Every new save path must use it (see `lib/data/characters`
  used by the import flow, `import/page.tsx:131-147`).
- **Shared step components via `basePath`** (`manual/[step]/page.tsx:53-70`): steps 2–6
  already reuse the auto `Step*` components with `basePath='/characters/new/manual'`.
  Extend the SAME pattern to steps 8–13 — parameterize their navigation, don't fork.
- **Optional-rules consumption**: read through the existing `useOptionalRules()` hook
  (`hooks/use-optional-rules.ts`); do not invent a second settings store.
- **Section + hook layout** (`combat/use-ammo-tracking.ts` + `AmmoSection`,
  `inventory/use-restock.ts` + `RestockSheet`): keep logic in a `use-*` hook, render in
  a section component. Coin-weight should live in/near `inventory/WeightBar.tsx:11-14`.
- **Pure calc in rules-engine**: `calculateAC` (`ac.ts:11`), `getKindredACBonus`
  (`kindreds.ts`) already exist — wire `CharacterCard` to call them with real values,
  matching how the Combat tab's `ArmourClassSection` already does it.

### Patterns to NOT follow

- **Display-only steps that skip the store** — `Step8Equipment` keeps item state
  locally and `Step10Speed` hardcodes `ESTIMATED_WEIGHT=200` (`research.md:18`). When
  reused for manual, decide explicitly whether each step persists (see Open Risks).
- **"Stored but unused" localStorage** — the toggles/offline-flag anti-pattern
  (`research.md:122`). Do not add more write-only settings.

## Design Decisions

1. **Roadmap, not big-bang** — ship as independent vertical slices in priority order;
   each is separately mergeable and verifiable. Sequence below.
2. **Manual 8–13 reuses auto components** (chosen over a manual rewrite or dropping
   manual) — parameterize `Step8Equipment`…`Step13Details` navigation with `basePath`,
   then delete the `if (step > 7)` gate at `manual/[step]/page.tsx:36`. Lowest-risk path
   to parity; mirrors the proven steps 2–6 approach.
3. **Wire all three toggles** — `subParReroll` + `hpRerollLowRolls` feed the HP/ability
   roll flows in creation and level-up; `coinWeightEnabled` feeds `WeightBar`. A
   weight-per-coin constant lives in rules-engine (alongside `speed.ts`) so the rule is
   testable and not inlined in the UI.
4. **Fix roster AC at the call site** — pass equipped-armor bonus + `getKindredACBonus`
   into `calculateAC` in `CharacterCard`; no schema change.
5. **Delete `/party`** rather than build it — `/campaign` already owns party/overview.
6. **Icons: generate real PNGs** (192 + 512) and reference them in `manifest.json`
   alongside (or replacing) the SVG; no service-worker logic change.
7. **Dice tab is the one net-new surface** — new `(app)/dice` route + a `BottomNav`
   entry, built on the existing `rules-engine/dice.ts` primitives. Lowest priority.
8. **Docs refresh first** — update `copilot-instructions.md` up front so it documents
   the *current* truth the rest of the work builds on.

### Recommended sequence

| # | Slice | Tier | Why here |
|---|---|---|---|
| S1 | Refresh `copilot-instructions.md` | Must | The literal trigger; cheap; unblocks accurate context |
| S2 | Manual wizard steps 8–13 | Must | Biggest functional gap; restores PRD parity |
| S3 | Wire 3 optional-rules toggles | Must | Removes "stored-but-unused" anti-pattern |
| S4 | Fix roster-card AC | Should | Correctness bug, isolated |
| S5 | Remove `/party` stub | Should | Trivial cleanup |
| S6 | Real PWA icons (192/512) | Should | Install polish |
| S7 | Dice-roller tab | Nice | Net-new surface; defer if time-boxed |

## What We're NOT Doing

- Standalone retainer sheet (PRD S-06), promote-to-PC stat carry-over redesign, or
  mount `saves` UI — noted as backlog, out of this effort.
- Settings-side JSON **import** (import already exists via the creation flow).
- Populating the empty `packages/ui`; removing unused `Button`/`Card` is optional.
- Any rules-engine recalculation work — it already meets/exceeds PRD §6.
- News/WordPress, campaign, banking, scheduling — already complete.
- Anything in PRD §10 (out-of-scope): DM screen, real-time sync, map, NPC tracker, etc.

## Open Risks

- **Equipment/derived steps may not persist for EITHER path.** Auto steps 8/9/10/12 are
  display-only; rolled equipment never reaches the store (`research.md:18`). S2 must
  decide: (a) match auto's confirm-only behavior (cheapest, keeps parity), or (b) make
  manual genuinely persist equipment — which would expand scope into the auto path too.
  Recommend (a) for parity; flag (b) as a separate slice if real persistence is wanted.
- **Sub-par reroll banner may not exist yet** — `subParReroll` has no consumer; the
  Step 1 detection/banner UI (PRD §S-03A) may need building, not just gating. Confirm
  during structure phase.
- **Coin-weight rule value** — need the canonical Dolmenwood weight-per-coin to add to
  rules-engine; verify against the book before encoding.
- **Dice tab admin-gating** — `BottomNav` already conditionally appends `/admin`
  (`BottomNav.tsx:19,27`); adding a 5th/6th tab affects mobile layout density — confirm
  the bar still fits at 375px.
