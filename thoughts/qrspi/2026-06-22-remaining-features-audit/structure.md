# Structure Outline

## Approach

Ship the seven roadmap slices (design.md) as independent, separately-mergeable phases
in priority order. Confirmed during structuring: the manual `complete` save path
already works, neither creation path persists equipment, the sub-par banner already
exists, and coin weight is 1-per-coin — so several phases are smaller than the design
feared. Phases S1/S5/S6 are inherently single-surface (docs / route delete / static
assets) and can't be "vertical" — noted explicitly.

Verify commands (run from repo root):
`pnpm --filter @dolmenwood/web typecheck` · `pnpm --filter @dolmenwood/web build` ·
`pnpm --filter @dolmenwood/rules-engine test` · `pnpm dev` for manual checks.

---

## Phase S1: Refresh `copilot-instructions.md`  *(single-surface — docs)*

Update the stale doc to match reality so later phases build on accurate context.

**Files**: `.github/copilot-instructions.md`
**Key changes** (prose, no code):
- `campaign/` is built (overview/bank/schedule), not "coming soon".
- `/party` is the real orphan stub (not nav-linked).
- Manual wizard currently stops at step 7 (until S2 lands).
- Note optional-rules toggles + PWA-icon status (until S3/S6 land).

**Verify**: doc review — every claim cross-checks against `research.md`. No build impact.

---

## Phase S2: Manual wizard steps 8–13

Render real components for manual steps 8–13 so manual creation completes and persists,
mirroring the steps-2–6 `basePath` reuse. The `complete` page already saves.

**Files**:
- `apps/web/src/app/(app)/characters/new/manual/[step]/page.tsx` — remove `if (step>7)` gate (`:36-51`), extend switch (`:53-70`) for cases 8–13.
- `apps/web/src/components/wizard/steps/Step8Equipment.tsx` … `Step13Details.tsx` — add `basePath` prop to each, replace hardcoded `/characters/new/auto/...` nav with `${basePath}/...`.

**Key changes**:
- `Step8Equipment({ basePath = '/characters/new/auto' }: { basePath?: string })` — and same signature for `Step9AC`, `Step10Speed`, `Step11Alignment`, `Step12LevelXP`, `Step13Details` (matches `Step2Kindred` pattern at `manual/[step]/page.tsx:55`).
- Step 13 "next" target becomes `${basePath}/complete`.
- No new types, no store change (store already holds alignment + details; equipment stays display-only for both paths — parity preserved).

**Verify**: `pnpm --filter @dolmenwood/web typecheck` + `build` pass. Manual: walk
`/characters/new/manual/1` → 13 → complete; character saves and opens its sheet. Auto
path still works (regression check on shared components).

---

## Phase S3: Wire the three optional-rules toggles

Make each toggle from `useOptionalRules()` change observable behavior. Three thin
wirings, each independently verifiable.

**Files**:
- `packages/rules-engine/src/speed.ts` (+ `src/__tests__/speed.test.ts`, `src/index.ts`) — add coin-weight helper.
- `apps/web/src/components/character-sheet/inventory/WeightBar.tsx` + `InventoryTab.tsx` — consume coin weight.
- `apps/web/src/components/wizard/steps/Step1AbilityScores.tsx` + `ManualStep1AbilityScores.tsx` — gate sub-par banner.
- `apps/web/src/components/wizard/steps/Step7HP.tsx` + `ManualStep7HP.tsx` + `apps/web/src/app/(app)/characters/[id]/level-up/components/HPRollStep.tsx` — HP low-roll reroll prompt.

**Key changes**:
- `calculateCoinWeight(coins: { gp: number; sp: number; cp: number; pp?: number }): number` — new export (1 weight per coin).
- `WeightBar({ items, coinWeight = 0 }: { items: DBInventoryItem[]; coinWeight?: number })` — add `coinWeight` into `totalWeight` (`WeightBar.tsx:11-14`); `InventoryTab` computes it as `coinWeightEnabled ? calculateCoinWeight(coins) : 0`.
- `subParReroll` gates the existing banner (`Step1AbilityScores.tsx:73`): `{subpar && subParReroll && (...)}`.
- `hpRerollLowRolls` shows a "Bad luck — re-roll?" prompt when an HP die roll is ≤2, in the three HP-roll surfaces.

**Verify**: `pnpm --filter @dolmenwood/rules-engine test` passes (new `calculateCoinWeight` cases). Manual, per toggle: (a) enable Coin Weight → carried weight/speed in Inventory tab changes; (b) disable Sub-Par Re-roll → banner no longer appears on low rolls; (c) enable HP reroll → rolling 1–2 HP offers a re-roll in creation and level-up.

---

## Phase S4: Fix roster-card AC

Roster cards compute AC with real armor + kindred bonuses so they match the sheet.

**Files**: `apps/web/src/components/characters/CharacterCard.tsx`
**Key changes**:
- Replace `armorBonus: 0` / `kindredACBonus: 0` (`:24-25`) with real values: equipped-armor bonus derived from the character's inventory (or persisted AC field) and `getKindredACBonus(character.kindred)` from `@dolmenwood/rules-engine`.
- If equipped-armor data isn't available on the roster query, note the data source needed (inventory join vs. a stored `ac` column) — resolve in plan phase.

**Verify**: `typecheck` + `build`. Manual: a character wearing armor shows the same AC on
the roster card and on the Combat tab's `ArmourClassSection`.

---

## Phase S5: Remove `/party` stub  *(single-surface — route delete)*

Delete the orphaned route that duplicates `/campaign`.

**Files**: delete `apps/web/src/app/(app)/party/page.tsx` (and empty `party/` dir).
**Key changes**: none beyond deletion. Confirm no `Link`/`router.push('/party')` exists
(research: not in `BottomNav`; grep to be safe).

**Verify**: `build` passes; `grep -r "/party"` finds no references; navigating to `/party`
404s.

---

## Phase S6: Real PWA icons  *(single-surface — assets + manifest)*

Replace the placeholder SVG with raster icons so installs show a real home-screen icon.

**Files**: `apps/web/public/icons/icon-192.png`, `icon-512.png` (new); `apps/web/public/manifest.json`.
**Key changes**:
- Generate 192×192 and 512×512 PNGs (maskable + any).
- `manifest.json` `icons[]` references the PNGs (keep or drop the SVG entry).

**Verify**: `build`. Manual: Chrome DevTools → Application → Manifest shows PNG icons, no
icon warnings; install prompt uses the raster icon.

---

## Phase S7: Dice-roller tab  *(net-new surface — lowest priority)*

Add an in-nav quick dice roller built on existing `rules-engine/dice.ts`.

**Files**:
- `apps/web/src/app/(app)/dice/page.tsx` (new) — roller UI.
- `apps/web/src/components/layout/BottomNav.tsx` — add `{ href: '/dice', label: 'Dice', icon: '🎲' }` to `BASE_NAV_ITEMS` (`:12-17`).
- (optional) `apps/web/src/components/dice/` for roller components.

**Key changes**:
- Client page using `rollDie` / `rollFromNotation` (`@dolmenwood/rules-engine`); buttons for d4–d100 + notation input; history list.
- No store/DB — ephemeral client state.

**Verify**: `typecheck` + `build`. Manual: Dice tab reachable from BottomNav; rolls
display; at 375px viewport the nav bar (now 5–6 tabs) still fits without overflow.

---

## Testing Checkpoints

- **After S1**: doc matches reality; nothing else changed.
- **After S2**: manual creation completes end-to-end and persists; auto path unregressed.
- **After S3**: all three toggles visibly change behavior; rules-engine tests green.
- **After S4**: roster AC == sheet AC for an armored character.
- **After S5**: `/party` gone, no dangling references, app builds.
- **After S6**: manifest serves PNG icons; install shows real icon.
- **After S7**: Dice tab live and usable; mobile nav still fits.

Each phase is independently valuable — if S5–S7 are dropped for time, S1–S4 still stand
on their own. The only intra-roadmap coupling: S1's doc should be re-touched after S2/S3
land (it describes their pre-change state), or S1 can simply describe the post-change
target state up front.
