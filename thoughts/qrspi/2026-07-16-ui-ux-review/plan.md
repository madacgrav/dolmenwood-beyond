# Implementation Plan

## Overview
Create 9 GitHub issues in `madacgrav/dolmenwood-beyond` capturing the UI/UX
review: 4 behavior defects (Track A) and 5 structural/styling items (Track B,
umbrella + 4 children). No app code changes. All issues assigned to `madacgrav`,
labels-only, no milestone.

## Mechanics (applies to every phase)
Windows PowerShell + heredoc quoting is fragile — write each body to a scratchpad
file, then create with `--body-file`. Scratchpad dir:
`C:\Users\madac\AppData\Local\Temp\claude\D--Source-dolmenwood-beyond\76562b05-f4f4-4cd3-b609-7247c7e56f7e\scratchpad`

Per issue:
```bash
# 1. Write body to scratchpad/<slug>.md (via Write tool)
# 2. Create:
gh issue create \
  --repo madacgrav/dolmenwood-beyond \
  --title "<title>" \
  --assignee madacgrav \
  --label "<l1>" --label "<l2>" \
  --body-file "<scratchpad>/<slug>.md"
```
Capture each returned issue URL/number. **Dedup first** (see Verification) so a
re-run does not double-create.

---

## Phase 1: Track A defect issues (4)

### A1 — Silent inventory-fetch failure
**Title**: `Inventory fetch failures are silent (indistinguishable from empty)`
**Labels**: `bug`, `character-management`
**Body**:
```markdown
## Problem
When the inventory network fetch fails, the tab shows an empty inventory with no
error. A failed load looks identical to a character who genuinely owns nothing.

## Evidence
- `use-inventory.ts` exposes only `loading`, no `error` field.
- `listInventory` returns `[]` on `!res.ok` (`apps/web/src/lib/api/inventory.ts:39`), swallowing the failure.
- `InventoryTab.tsx:47-55` renders a skeleton while loading but has no error branch.
- Contrast the correct pattern: `apps/web/src/hooks/use-characters.ts:11-19` surfaces an explicit `error` string, and the API returns `{ error }` on failure.

## Proposed direction
Add an `error` field to `use-inventory.ts` (mirror `use-characters.ts`). Have
`listInventory` / `use-inventory` distinguish a failed fetch from an empty result.
Render an error branch in `InventoryTab` (red inline message like `SpendForm.tsx:92-93`).

## Acceptance criteria
- [ ] `use-inventory` returns `error` alongside `loading`.
- [ ] A failed inventory fetch surfaces a visible error, not an empty list.
- [ ] Genuinely-empty inventory still shows the existing empty-state copy.

## Notes / constraints
Keep the optimistic-update path in `use-inventory.ts:65-69` intact.
```

### A2 — Double-tappable add-forms
**Title**: `Add-forms have no in-flight state (double-submit possible)`
**Labels**: `bug`, `character-management`
**Body**:
```markdown
## Problem
Add Item / Add Spell / Add Retainer submit buttons have no loading or disabled
state. A user can tap twice during the network round-trip and create duplicates.

## Evidence
- `AddItemForm`, `AddSpellForm`, `AddRetainerForm` submit handlers are fire-and-forget async with no disabled/loading UI.
- Correct pattern already exists: `SpendForm.tsx:95-106` (disable + dim + "Spending…"), `AddMountForm.tsx:109-121` ("Saving…"), `RestockSheet.tsx:191-218` (loading + success banner).

## Proposed direction
Add an in-flight boolean to each of the 3 forms (or their companion hooks),
disable + dim the submit button and swap its label while the mutation is pending,
matching `SpendForm`/`AddMountForm`.

## Acceptance criteria
- [ ] `AddItemForm`, `AddSpellForm`, `AddRetainerForm` disable the submit button while pending.
- [ ] Button label swaps to a pending state (e.g. "Adding…", "Hiring…").
- [ ] Double-tap during submit does not fire a second mutation.

## Notes / constraints
Field state for AddItem/AddRetainer lives in companion hooks (`use-add-item`,
`use-retainers`); AddSpell owns state locally — the pending flag placement differs.
```

### A3 — Fake offline toggle
**Title**: `Offline-mode toggle does nothing (dead localStorage key)`
**Labels**: `bug`, `platform`
**Body**:
```markdown
## Problem
The Settings "Offline Mode" toggle writes a flag that nothing reads. It gives the
user a false impression of control; real offline behavior is unrelated to it.

## Evidence
- `OfflineModeSection.tsx` reads/writes `localStorage['dolmenwood-offline']` (lines ~9, ~24).
- That key is read nowhere else in the codebase (grep confirms 1 file).
- Real offline is `next-pwa` (`apps/web/next.config.ts:11-26`, `NetworkFirst`, generated `sw.js`, precached `offline.html`), fully disconnected from the toggle.
- Layout never reads `navigator.onLine`; no offline banner anywhere.

## Proposed direction
Pick one: (a) wire the toggle to a real effect, or (b) remove the toggle and
instead surface a real connectivity banner driven by `navigator.onLine` +
`online`/`offline` window events. Option (b) is lower-risk and honest.

## Acceptance criteria
- [ ] No dead `dolmenwood-offline` localStorage key remains, OR it drives observable behavior.
- [ ] If a banner is added, it reflects real `navigator.onLine` state.

## Notes / constraints
Do not change the `next-pwa` service-worker caching strategy unless required.
```

### A4 — Tab-switch inventory refetch
**Title**: `Character sheet refetches inventory on every tab switch`
**Labels**: `enhancement`, `character-management`
**Body**:
```markdown
## Problem
Switching between character-sheet tabs refetches the full inventory each time and
remounts the tab, which can cause perceptible lag and flicker.

## Evidence
- `characters/[id]/page.tsx:43` — `useEffect` with dep `[id, activeTab]` calls `listInventory(id)` on every tab change.
- Tabs are gated `{activeTab === 'x' && <XTab/>}` (`page.tsx:147-151`), so React unmounts/remounts the previous tab on each switch.
- AC-sync comment (`page.tsx:41-42`) explains the refetch keeps armour class in sync with equipped/unequipped items.

## Proposed direction
Refetch inventory only when it actually mutates (or on an explicit invalidation),
not on every tab switch, while preserving AC correctness. Consider fetching once
and updating AC from the already-loaded `items` after inventory mutations.

## Acceptance criteria
- [ ] Inventory is not refetched purely because the active tab changed.
- [ ] Armour class stays correct after equip/unequip in the Inventory tab.
- [ ] No visible flicker when switching tabs.

## Notes / constraints
The AC-sync constraint at `page.tsx:41-42` is the reason the refetch exists —
any fix must keep `deriveCharacterAC` (`page.tsx:89-95`) fed with current items.
```

### Phase 1 Verification
#### Automated
- [x] Dedup: `gh issue list --repo madacgrav/dolmenwood-beyond --state open --search "inventory OR offline OR add-form OR double-submit"` — confirm none of A1-A4 already exist before creating.
- [x] After create: `gh issue list --repo madacgrav/dolmenwood-beyond --label bug` shows A1 (#52), A2 (#53), A3 (#54).
- [x] `gh issue list --repo madacgrav/dolmenwood-beyond --label character-management` shows A1 (#52), A2 (#53), A4 (#55).
#### Manual
- [ ] Open each issue URL; body renders, `file:line` refs are correct, assignee = madacgrav.

---

## Phase 2: Umbrella styling issue (1)

### B5 — Revive `ui/` primitives (Tailwind) as house style
**Title**: `Adopt ui/ primitives (Tailwind) as the house styling pattern`
**Labels**: `enhancement`, `platform`
**Body**:
```markdown
## Problem
The app has two competing styling systems: 3 Tailwind-based `ui/` primitives that
are almost never used, and pervasive inline `style={{}}`. This drives duplication
across modals, forms, HP bars, and empty states.

## Evidence
- `apps/web/src/components/ui/Button.tsx` and `Card.tsx` have **zero** JSX usages anywhere.
- `ui/HPBar.tsx` has one consumer (`CharacterCard.tsx:7`).
- Inline `style={{}}` appears ~1489 times across 138 files.
- Target house pattern already exists: `Button.tsx:17-30` (Tailwind arbitrary values `bg-[var(--color-primary)]` + `cn()` from `lib/utils.ts:1-6`).

## Proposed direction
Establish the Tailwind-arbitrary-value + `cn()` primitive pattern as the house
style. Make `Button`/`Card` the real, adopted primitives. **Migration is
opportunistic** — files adopt primitives as they are touched; no big-bang rewrite.
This is an umbrella; the following child issues carry the concrete work:
- Shared `Modal` primitive
- Consolidate the two HP bars
- Shared `EmptyState` + loading/error contract
- Shared form `Field`/`Input` primitives

## Acceptance criteria
- [ ] A short house-style note exists (this issue) that child issues reference.
- [ ] `Button`/`Card` documented as the canonical primitives.
- [ ] Migration is explicitly opportunistic, not a blocking mega-PR.

## Notes / constraints
Two styling systems will coexist during migration — accepted trade-off.
```

### Phase 2 Verification
#### Automated
- [x] `gh issue view 56 --repo madacgrav/dolmenwood-beyond` returns the issue.
- [x] Record B5 issue number for cross-linking in Phase 3: **#56**.
#### Manual
- [ ] Body renders; labels `enhancement` + `platform`; assignee madacgrav.

---

## Phase 3: Track B children (4)
Each child body ends with `Part of #<B5>` (substitute the recorded number).

### B6 — Shared `Modal` primitive
**Title**: `Extract a shared Modal primitive (5 hand-rolled copies)`
**Labels**: `enhancement`
**Body**:
```markdown
## Problem
Five separate components hand-roll the same overlay + centered-panel + Cancel/
Confirm modal, with diverging z-index, scrim opacity, and corner radius.

## Evidence
- `BattleModal.tsx:26` (zIndex 50, scrim 0.65, radius 16px)
- `settings/components/DeleteAccountModal.tsx:21` (zIndex 200, scrim 0.7, radius 14px)
- `campaign/schedule/DeleteSessionModal.tsx:13` (zIndex 200, scrim 0.7, radius 14px)
- `character-sheet/stats/PromoteRetainerModal.tsx:25` (zIndex 100, scrim 0.6, radius 14px)
- Inline delete-confirm in `characters/[id]/page.tsx:154-196`
- No `ui/Modal.tsx` exists.

## Proposed direction
Add `ui/Modal` (overlay + panel + optional action-row) with shared z-index/scrim/
radius tokens. Migrate the 5 sites onto it (opportunistically per parent #<B5>).

## Acceptance criteria
- [ ] `ui/Modal` exists with a consistent overlay/panel/action-row API.
- [ ] The 5 modal sites are listed as migration targets.

## Notes / constraints
Part of #<B5>.
```

### B7 — Consolidate the two HP bars
**Title**: `Consolidate the two HPBar implementations`
**Labels**: `enhancement`, `character-management`
**Body**:
```markdown
## Problem
Two separate HPBar components duplicate the same percent/color threshold math.

## Evidence
- `apps/web/src/components/ui/HPBar.tsx` (1 consumer, `CharacterCard.tsx:7`), track 6px.
- `apps/web/src/components/character-sheet/header/HPBar.tsx:13-88` (sheet header), track 8px, plus HP-edit controls.
- Both re-derive the identical 0.66/0.33 threshold formula independently, no shared code.

## Proposed direction
Single source for percent/color logic; the header variant composes it and layers
its edit controls on top. Remove the duplicated threshold math.

## Acceptance criteria
- [ ] One shared HP percent/color function/component.
- [ ] Header HP bar composes it; edit controls preserved.
- [ ] `HPBar.test.tsx` still passes (`data-testid="hp-bar-fill"`).

## Notes / constraints
Part of #<B5>. Keep the `data-testid` the existing test depends on.
```

### B8 — Shared `EmptyState` + loading/error contract
**Title**: `Shared EmptyState + loading/error state conventions`
**Labels**: `enhancement`
**Body**:
```markdown
## Problem
Empty-state copy, skeletons, and error rendering are hand-rolled per component
with no shared component or hook contract.

## Evidence
- 4+ independently-written empty literals: `InventoryTab.tsx:117`, `SpellBookSection.tsx:55`, `PreparedSpellsSection.tsx:53`, `RetainersSection.tsx:76`.
- Per-page bespoke skeletons; only 2 route `loading.tsx` (`(app)/loading.tsx`, `(app)/admin/loading.tsx`).
- Hooks disagree on failures: `use-characters.ts` exposes `error`; `use-inventory.ts` returns `[]` silently (see related defect).

## Proposed direction
Add a shared `EmptyState` component and a reusable skeleton; document a hook
loading/error contract (every fetch hook exposes `loading` + `error`).

## Acceptance criteria
- [ ] `ui/EmptyState` exists; the 4 sites listed as adopters.
- [ ] A shared skeleton component exists.
- [ ] Documented hook loading/error contract.

## Notes / constraints
Part of #<B5>. Overlaps the silent-inventory-failure defect issue.
```

### B9 — Shared form `Field`/`Input` primitives
**Title**: `Shared form Field/Input primitives for add-forms`
**Labels**: `enhancement`, `character-management`
**Body**:
```markdown
## Problem
Every add-form repeats the same label-above-input field styling inline; only one
pair of shared consts exists.

## Evidence
- Only `magic/types.ts:15-30` (`INPUT_STYLE`/`SELECT_STYLE`) is shared, and by a single consumer (`AddSpellForm`).
- `AddItemForm`, `AddRetainerForm`, `AddMountForm` each repeat padding/border/radius/color literals per input.

## Proposed direction
Promote the field styling into shared `ui/` `Field`/`Input`/`Select` components
(Tailwind house style). Adopt across the add-forms opportunistically.

## Acceptance criteria
- [ ] `ui/` field components exist (`Field`/`Input`/`Select`).
- [ ] Add-forms listed as adopters.

## Notes / constraints
Part of #<B5>.
```

### Phase 3 Verification
#### Automated
- [x] `gh issue list --repo madacgrav/dolmenwood-beyond --label enhancement` shows B5 (#56), B6 (#57), B7 (#58), B8 (#59), B9 (#60).
- [x] Each B6-B9 body contains `#56` (cross-link resolves on GitHub).
#### Manual
- [ ] Open B6-B9; the `Part of #<B5>` link renders as a reference; assignee madacgrav.

---

## Final Verification
- [x] `gh issue list --repo madacgrav/dolmenwood-beyond --assignee madacgrav --state open` lists all 9 (A1-A4, B5-B9).
- [x] No duplicates created (each title appears once).
- [x] Record the 9 issue URLs in a closing summary for the PR/handoff step.

## Created issues
| # | Track | Title |
|---|-------|-------|
| [#52](https://github.com/madacgrav/dolmenwood-beyond/issues/52) | A1 | Inventory fetch failures are silent |
| [#53](https://github.com/madacgrav/dolmenwood-beyond/issues/53) | A2 | Add-forms have no in-flight state |
| [#54](https://github.com/madacgrav/dolmenwood-beyond/issues/54) | A3 | Offline-mode toggle does nothing |
| [#55](https://github.com/madacgrav/dolmenwood-beyond/issues/55) | A4 | Character sheet refetches inventory on tab switch |
| [#56](https://github.com/madacgrav/dolmenwood-beyond/issues/56) | B5 | Adopt ui/ primitives (umbrella) |
| [#57](https://github.com/madacgrav/dolmenwood-beyond/issues/57) | B6 | Shared Modal primitive |
| [#58](https://github.com/madacgrav/dolmenwood-beyond/issues/58) | B7 | Consolidate the two HPBars |
| [#59](https://github.com/madacgrav/dolmenwood-beyond/issues/59) | B8 | Shared EmptyState + loading/error contract |
| [#60](https://github.com/madacgrav/dolmenwood-beyond/issues/60) | B9 | Shared form Field/Input primitives |
```
