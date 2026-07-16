# Research Findings

Scope: `apps/web` — Next.js 15 App Router, React 19, TypeScript, Tailwind v4 (CSS-first). Mobile/PWA-first.

## Q1: App shell and navigation

### Findings
- Shell: `src/app/(app)/layout.tsx:8-32`, async server component, `export const dynamic = 'force-dynamic'` (line 6). Outer `div` is `flex column, minHeight: 100dvh` (line 18).
- Admin flag resolved server-side: `fetchAccountDoc(session.user.id)`, `isAdmin = account?.isAdmin ?? false` (lines 9-15), passed to `BottomNav`.
- Header (`layout.tsx:19-27`): rendered only when `session` truthy. `position: fixed, top:0, height: 52px, zIndex: 50`, `justifyContent: flex-end`. Contents: **only** `<NotificationBell />` (line 25). No title, logo, or back button in the shell header.
- `<main>` (line 28): `flex:1`, `paddingTop: session ? '52px' : 0`, `paddingBottom: '80px'` (always).
- `BottomNav` (`components/layout/BottomNav.tsx`): client component, `usePathname()` derives active via `pathname.startsWith(item.href)` (line 48). Items `BASE_NAV_ITEMS` (12-18): Characters 🏠, News 📜, Campaign ⚔️, Dice 🎲, Settings ⚙️; `ADMIN_NAV_ITEM` 🛡️ appended when `isAdmin` (line 28). `position: fixed, bottom:0, height: 80px, zIndex: 50`, `justifyContent: space-around`, `paddingBottom: env(safe-area-inset-bottom)` (line 44).
- Each item is a Next `Link`, icon-over-label column, `minWidth/minHeight: 44px` (58-59), active `var(--color-primary)` + `fontWeight 600`, inactive `var(--color-text-muted)` + `400`.
- Navigation is pure client-side `Link` clicks; active tab derived reactively from pathname, not state.

## Q2: Styling system

### Findings
- Tokens: `globals.css:4-26` `@theme` block. Colors (`--color-bg/surface/primary/primary-hover/text/text-muted/gold/danger/border`), fonts (`--font-display` Cinzel, `--font-body` Satoshi/Inter, `--font-mono`), radii (`--radius-sm/md/lg`), single spacing token `--touch-target: 44px`.
- Dark mode declared twice: `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }` (29-41) AND `[data-theme="dark"]` explicit override (44-54) — same 9 color values duplicated.
- Global touch-target rule: `button, [role="button"], a { min-height: var(--touch-target); display:inline-flex; align/justify center }` (89-95) — enforces 44px app-wide.
- **Three co-existing consumption patterns:**
  1. **Tailwind utility classes** — rare. Only 4 files use `className=` with utilities: `ui/Button.tsx`, `ui/Card.tsx` (arbitrary values like `bg-[var(--color-primary)]`), root `layout.tsx:42` (font vars), `news/[slug]/page.tsx:52` (`wp-content`).
  2. **Inline `style={{}}` referencing CSS vars** — dominant. `style={{` appears **1489 times across 138 files**. Colors/fonts always via `var(--color-*)`; derived shades via `color-mix()` (e.g. `header/HPBar.tsx:58`).
  3. **Local style-constant modules** — `settings/components/styles.ts` (`sectionStyle`, `sectionHeaderStyle`, `inputStyle`) shared by 8 settings files. Same top-of-file `const xStyle: React.CSSProperties` pattern duplicated per-file in ~10 other files (auth pages, campaign forms, wizard steps) — only settings' is actually shared.
- `lib/utils.ts:1-6` `cn()` (clsx + tailwind-merge) used only by Button/Card.

## Q3: Character sheet screen

### Findings
- `characters/[id]/page.tsx:17` client component. State: `character`, `items`, `loading`, `activeTab: TabName` (`'stats'|'combat'|'inventory'|'magic'|'notes'`, line 15), `editMode`, delete-flow states (21-28).
- Data: `fetchCharacter` once (40); inventory refetched via `listInventory(id)` on **every tab switch** (`useEffect` dep `[id, activeTab]`, line 43) to keep AC in sync.
- AC: `deriveCharacterAC` from `@dolmenwood/rules-engine` (89-95), passed to Stats/Combat tabs.
- Tab bar: inline `tabs` array (97-103), sticky button bar (`position: sticky, top:0`, line 117); `onClick={() => setActiveTab(tab.id)}` is the whole mechanism — no URL sync, no lazy-load. Tabs gated `{activeTab === 'x' && <XTab/>}` (147-151), so React unmounts/remounts on switch.
- Header `CharacterSheetHeader.tsx:10`: `HeaderTopBar` (back, Edit/Done toggle, `⋮` overflow menu → XP log, level-up log, PDF, delete), `PortraitButton` (upload via `use-portrait-upload`), `HPBar` (header variant), `XPBar`. `hpEditOpen`/`xpEditOpen` mutually exclusive (63,71).
- Delete confirm is an **inline modal in the page** (154-196), not a component.
- Loading skeleton bespoke to this page (70-85).
- Tabs each own their data hooks: StatsTab (`useLanguages`, `useRetainers` + rules helpers), CombatTab (`useAmmoTracking`, `useMounts`, local weapons fetch), InventoryTab (`useInventory`, `useAddItem`, `useRestock`), MagicTab (`useSpells`, gated by `isSpellcaster`), NotesTab — **self-contained sub-tab screen** with its own `SUBTABS = ['General','Sessions','People']` (202) styled underline-pills (different from outer tab bar), 3 locally-defined components; GeneralNotes debounced 1000ms autosave.

## Q4: Shared primitives vs one-off reimplementations

### Findings
- `components/ui/` has exactly 3 primitives: `Button.tsx` (variant/size props, Tailwind), `Card.tsx` (elevated prop), `HPBar.tsx` (current/max/showNumbers).
- **Button and Card have ZERO JSX usages** anywhere in `apps/web/src` (grep for `<Button`/`<Card` = 0). All buttons/panels/modals across the app are raw `<button>`/`<div>` + inline styles. `cn()` only exercised inside the unused primitives.
- **Two HP bars**: `ui/HPBar.tsx` (1 consumer, `CharacterCard.tsx:7`) vs `character-sheet/header/HPBar.tsx:13-88` (used on sheet). Identical percent/color threshold formula (0.66/0.33) re-derived independently, no shared code/import. Track height differs (6px vs 8px). Header variant also owns HP-edit ±5/±1 buttons with hardcoded `minHeight: 44px` duplicating the global rule.
- **No shared Modal.** Four hand-rolled modals each reimplement fixed overlay + centered panel + Cancel/Confirm row: `BattleModal.tsx:26`, `DeleteAccountModal.tsx:21`, `DeleteSessionModal.tsx:13`, `PromoteRetainerModal.tsx:25`. Diverging constants: zIndex 50/200/200/100, scrim opacity 0.65/0.7/0.7/0.6, radius 16/14/14/14px. Plus the inline delete-confirm in the character page (Q3) = a 5th modal shape. None share a wrapper or import Button.

## Q5: Data-editing interaction patterns

### Findings
- **No shared form/field/input component.** Each add-form (`AddItemForm`, `SpendForm`, `AddSpellForm`, `AddRetainerForm`, `AddMountForm`) is standalone with its own inline styles. Only shared style consts: `magic/types.ts:15-30` (`INPUT_STYLE`/`SELECT_STYLE`) used solely by `AddSpellForm`.
- State ownership inconsistent: `AddItemForm`/`AddRetainerForm`/`AddMountForm` lift field state into companion hooks (`use-add-item`, `use-retainers`, `use-mounts`) as controller props (zero local `useState`); `AddSpellForm` and `SpendForm` own fields locally.
- Layout consistent *visually* without shared code: surface panel, `1px solid var(--color-primary)` active border, `borderRadius 10px`, label-above-input (`fontSize 0.72rem` muted label), Cancel + primary button row. Number groups use 4-col grids (`AddRetainerForm.tsx:35`, `AddMountForm.tsx:83`).
- **No validation library** — all ad-hoc guard clauses (`.trim()` early returns) + self-clamping numeric inputs (`Math.max(1, parseInt||1)`, regex `.replace(/[^0-9]/g,'')`). Only `SpendForm` has real server-side validation + error UI (`/api/characters/[id]/coins/spend`).
- **Submit/loading feedback inconsistent**: `SpendForm`, `AddMountForm`, `RestockSheet` have disabled/dimmed/"…ing" states (RestockSheet also has success banner + insufficient-funds override). `AddItemForm`/`AddSpellForm`/`AddRetainerForm` have **no loading/disabled state** — fire-and-forget async, double-tap possible.
- Inline editable quantity `ItemRow.tsx:21`: two edit paths on one row — stepper `−`/`+` (`onSetQuantity ±1`, `−` disabled at 0) AND tap-to-edit input (local `editing`/`draft`, auto-focus, regex-filter, commit on blur/Enter). All funnel through `use-inventory.ts:65-69` `setItemQuantity` (clamps, optimistic, PATCH). No error surfaced to row — optimistic UI is the only feedback.
- `CoinPurse.tsx:20-27` uses always-editable `type=number` inputs (no edit toggle). `LightTracker` uses button-driven mutations with a shared `run()` try/catch-to-error helper (27-34) — the only inventory component with reusable error wrapping.

## Q6: Loading / error / empty / offline states

### Findings
- **No shared async-state hook/wrapper.** Every hook rolls its own `loading`/`error` `useState`; skeletons/messages inline with hand-written styles.
- Route `loading.tsx` exists for only 2 segments: `(app)/loading.tsx` (5 pulsing bars) and `(app)/admin/loading.tsx` (layout-matched skeleton). No `loading.tsx` for `characters/[id]`, `campaign`, `news` — those handle loading client-side.
- `error.tsx` (root only, `console.error` + Try Again/`reset()`, no telemetry) and `not-found.tsx` (root only). No nested error boundaries.
- Hook inconsistency on failures: `use-characters.ts` exposes explicit `error` string (API returns `{error}` on `!res.ok`); `use-inventory.ts` exposes **only `loading`, no error** — `listInventory` returns `[]` on failure (`inventory.ts:39`), so a failed fetch is indistinguishable from empty inventory.
- Character-detail fetch failure → `router.push('/characters')` (page.tsx:33), no inline error. Bespoke skeleton (70-85) not shared with either `loading.tsx`.
- Empty states: 4+ independently-written literals, same idiom (`<p style muted>`): inventory `InventoryTab.tsx:117`, spellbook `SpellBookSection.tsx:55`, prepared `PreparedSpellsSection.tsx:53`, retainers `RetainersSection.tsx:76`. No `<EmptyState>` component.
- Offline: `OfflineModeSection.tsx` toggle writes `localStorage['dolmenwood-offline']` — **key read/written nowhere else**, no observable effect. Actual offline is `next-pwa` (`next.config.ts:11-26`, `NetworkFirst`, generated `sw.js`, `offline.html` precached but not wired as navigation fallback). Layout never reads `navigator.onLine`; no offline banner anywhere. The Settings toggle and the PWA mechanism are disconnected.

## Cross-Cutting Observations
- **Inline `style={{}}` is the de facto styling system** (1489 uses / 138 files). The 3 `ui/` Tailwind primitives are effectively dead code (Button/Card 0 uses; ui/HPBar 1 use). Tailwind is configured but barely consumed for components.
- **Duplication over abstraction is the consistent theme**: 5 modal shapes, 2 HP bars, per-file form styles, per-component skeletons/empty-states/error strings — all visually similar, none factored into shared components. Only real shared modules: `settings/components/styles.ts` (8 files) and `magic/types.ts` INPUT/SELECT consts (1 file).
- **44px touch target is enforced globally** (`globals.css:89-95`) yet also redundantly re-declared inline in many components (BottomNav, NotificationBell, header/HPBar, modal buttons).
- **Mobile-only layout**: no `min-width`/`max-width` breakpoints anywhere except a WordPress image rule; only media query is dark-mode. Fixed 52/80/44px sizing at all widths; viewport locked `userScalable: false` (root `layout.tsx:28-34`). PWA portrait-primary, standalone.
- **Feedback maturity varies by feature**: newest features (Spend, Restock, Light) have loading/error/success UI; older add-forms have none.

## Open Areas
- Actual visual/perceived "clunkiness" (animation jank, layout shift, tap latency) can't be measured from static code — would need runtime profiling.
- `AppearanceSection.tsx` theme-toggle internals not deeply traced (sets `data-theme` that Q2 CSS keys off).
- Whether inventory refetch-on-every-tab-switch (Q3) causes perceptible delay is a runtime question, not answerable from source.
