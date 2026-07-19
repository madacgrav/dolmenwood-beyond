# Implementation Plan

## Overview

Implement issue #72's streamlined UI: app-bar shell with page-header context, immersive
character sheet (hero header, sheet-divider tabs, progressive disclosure), dashboard
campaign hub (segmented nav incl. Quests, per-campaign role-aware Party), on fixed
font/theme foundations. Paths relative to `apps/web/src`. Styling convention: inline
`style={{}}` + `var(--color-*)` — never Tailwind classes.

Per-phase verification commands (run from repo root):
`npm run test --workspace apps/web && npm run typecheck --workspace apps/web && npm run lint --workspace apps/web`

---

## Phase 1: Foundations — fonts, theme bootstrap, tokens

### Changes

#### 1. Wire display font + load body font
**File**: `app/layout.tsx`
**Action**: modify
- Add Inter via `next/font/google` alongside existing Cinzel/JetBrains_Mono:
```tsx
const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });
// html className: `${cinzel.variable} ${jetbrainsMono.variable} ${inter.variable}`
```

#### 2. Token updates
**File**: `app/globals.css`
**Action**: modify
- `:17-19` rewire font tokens to the loaded webfonts:
```css
--font-display: var(--font-cinzel), 'Georgia', serif;
--font-body: var(--font-inter), 'Inter', sans-serif;
--font-mono: var(--font-jetbrains), 'Courier New', monospace;
```
- Add to `@theme` block (after `:14`), plus dark values in BOTH override blocks
  (`:29-41` media block and `:44-54` `[data-theme="dark"]`):
```css
/* sheet = immersive document surfaces; dash = flat dashboard */
--color-sheet-surface: #f8f4e6;      /* dark: #262218 */
--color-sheet-surface-deep: #efe8d4; /* gradient stop; dark: #1f1c14 */
--color-dash-surface: #faf8f0;       /* dark: matches --color-surface dark */
```
(Gradients composed inline as `linear-gradient(var(--color-sheet-surface), var(--color-sheet-surface-deep))`.)

#### 3. Pre-paint theme bootstrap
**File**: `app/layout.tsx`
**Action**: modify — inline script in `<head>` before children:
```tsx
<script dangerouslySetInnerHTML={{ __html:
  `try{var t=localStorage.getItem('dolmenwood-theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t)}catch(e){}` }} />
```
`AppearanceSection.tsx` needs no change (it already writes the same key/attribute).

### Verification
#### Automated
- [x] `npm run test` passes (170 tests, run in apps/web — note: `--workspace` flag doesn't work, turbo monorepo; run inside apps/web)
- [x] `npm run typecheck` passes
- [x] `npm run lint` passes
#### Manual (verified in browser 2026-07-18)
- [x] Characters-list heading renders true Cinzel — computed font = next/font Cinzel + fallback
- [x] Stored dark applied pre-paint on reload (data-theme=dark, bg #17160f)
- [x] Stored light overrides dark OS preference (emulated dark colorScheme, bg stayed light)
- [x] Auth pages untouched (local dev lacks AUTH_SECRET so /sign-in redirects; pages use --font-cinzel directly, not modified)

**Phase-1 finding**: Tailwind v4 strips `@theme` variables with no utility usage — new
surface tokens moved to a plain `:root` block (fix committed). Any future tokens
consumed only via inline `var()` must go in `:root`, not `@theme`.

---

## Phase 2: Shell — app-bar, header context, 64px nav

### Changes

#### 1. Page-header context
**File**: `components/layout/PageHeaderContext.tsx`
**Action**: create
```tsx
'use client';
export interface PageHeader { title?: string; back?: boolean | string; action?: ReactNode; }
// Context holds { header, setHeader }. Provider keeps useState<PageHeader>({}).
export function PageHeaderProvider({ children }: { children: ReactNode }) { ... }
export function usePageHeader(header: PageHeader) {
  // useEffect: setHeader(header) on mount/dep change; cleanup resets to {}
  // deps: [header.title, header.back] — action compared by identity is unstable;
  // callers must useMemo the action node or pass a stable element.
}
export function usePageHeaderValue(): PageHeader // for AppBar
```

#### 2. AppBar
**File**: `components/layout/AppBar.tsx`
**Action**: create — client component replacing the inline header in layout.
- 52px fixed, `zIndex: 50`, surface bg, bottom border (same shell values as today,
  `(app)/layout.tsx:20-24`).
- Grid `auto 1fr auto auto`: back chevron (`←`, 44px target; `router.back()` if
  `back === true`, `router.push(back)` if string; hidden if unset) · centered title
  (`fontFamily: var(--font-display)`, `fontSize: '1rem'`, ellipsis) · `{action}` slot
  (container `position: relative; overflow: visible` so the sheet ⋮ dropdown can
  anchor) · `<NotificationBell/>`.

#### 3. Layout rewire
**File**: `app/(app)/layout.tsx`
**Action**: modify
```tsx
<PageHeaderProvider>
  {session && <AppBar />}
  <main style={{ flex: 1, paddingTop: session ? '52px' : 0, paddingBottom: '64px' }}>{children}</main>
  <BottomNav isAdmin={isAdmin} />
</PageHeaderProvider>
```
(Provider is a client component with server children — valid composition.)

#### 4. BottomNav 80→64px
**File**: `components/layout/BottomNav.tsx`
**Action**: modify — `height: '64px'` (`:37` area); shrink per-item vertical padding;
keep 44px touch targets, safe-area padding, active styling.

#### 5. NotificationBell dropdown offset
**File**: `components/notifications/NotificationBell.tsx`
**Action**: modify — dropdown `top: '52px'` stays correct (header height unchanged);
verify only. No code change expected.

#### 6. Migrate 4 simple pages
**Files**: `app/(app)/characters/page.tsx`, `app/(app)/settings/page.tsx`,
`app/(app)/news/page.tsx`, `app/(app)/dice/page.tsx`
**Action**: modify — each: remove its `<h1>` block; add
`usePageHeader({ title: 'Characters' /* etc */ })`. Keep existing `maxWidth`
containers and padding (frame extraction intentionally skipped). Pages already
client components — if any is a server component (news), add a tiny client child
`<SetPageHeader title="News"/>` that calls the hook and returns null.

### Verification
#### Automated
- [x] test + typecheck + lint pass
#### Manual (verified in browser 2026-07-18; auth-gated flows blocked by missing local AUTH_SECRET)
- [x] Characters/Dice/News: centered Cinzel title in app-bar, 0 in-page h1 (Settings redirects to sign-in locally — code path identical to Dice)
- [x] Back chevron absent on top-level pages
- [x] Bell renders in bar (dropdown alignment unchanged, top:52px)
- [x] Bottom nav measured 64px; main paddingBottom 64px; characters FAB offset adjusted 96→80px
- [x] Unmigrated /campaign shows own h1, app-bar title empty — no double title

---

## Phase 3: Character sheet — hero header, sheet style, Stats disclosure

### Changes

#### 1. CollapsibleSection primitive
**File**: `components/ui/CollapsibleSection.tsx` (+ `test/__tests__/CollapsibleSection.test.tsx`)
**Action**: create
```tsx
interface Props { title: string; count?: number; defaultOpen?: boolean;
  emoji?: string; children: ReactNode; }
// Closed: header button `▸ {emoji} {title}` + muted `{count} more` on the right.
// Open: `▾ {emoji} {title}` + children. Local useState(defaultOpen ?? false).
// Header: full-width button, minHeight 44px, aria-expanded, sectionHead small-caps
// styling matching stats/shared.ts sectionHead.
```
Test: renders closed w/ count, click opens, aria-expanded flips.

#### 2. Sheet actions move to app-bar
**File**: `components/character-sheet/header/SheetActions.tsx`
**Action**: create — extraction of `HeaderTopBar.tsx:44-134` (Edit/Done toggle + ⋮
menu w/ XP History, Level Up History, Export PDF, Delete; read-only badge variant
from `:32-43`). Dropdown anchors `position:absolute; top:100%; right:0` inside the
app-bar action slot; keep z-index 98/99 click-catcher pattern.
Props: `{ characterId, editMode, readOnly, onToggleEdit, onDelete? }`.

**File**: `components/character-sheet/header/HeaderTopBar.tsx`
**Action**: delete (fully superseded).

#### 3. Hero header restyle
**File**: `components/character-sheet/CharacterSheetHeader.tsx`
**Action**: modify
- Remove `<HeaderTopBar/>` (`:25-32`) and its props (`onBack`, `onToggleEdit`,
  `editMode`, `onDelete` move to page-level SheetActions; keep `readOnly` for
  bars/portrait).
- Add `variant?: 'full' | 'compact'` prop. Full: current 64px portrait + name
  (`fontSize` up to 1.35rem) + kindred/class/level + HP + XP bars. Compact (used by
  Inventory in Phase 4): 44px portrait, name, single HP bar, no XP.
- Surface: `background: linear-gradient(var(--color-sheet-surface), var(--color-sheet-surface-deep))`,
  `borderRadius: 0 0 var(--radius-lg) var(--radius-lg)`.

#### 4. Shared sheet tab bar
**File**: `components/character-sheet/SheetTabs.tsx`
**Action**: create — extract tab bar markup from `characters/[id]/page.tsx:121-149`
(same list as `:105-111`) + `view/page.tsx:87-93,118`. Props:
`{ active: TabName; onChange: (t: TabName) => void }`. Restyle as sheet dividers:
active tab gets sheet-surface bg + top radius + display font; inactive muted; keep
sticky + `overflowX:auto` + 44px targets.

#### 5. Owner + view pages
**Files**: `app/(app)/characters/[id]/page.tsx`, `app/(app)/characters/[id]/view/page.tsx`
**Action**: modify
- Both: replace inline tab bar with `<SheetTabs/>`; call
  `usePageHeader({ title: character?.name ?? '', back: '/characters', action })` —
  owner action = `<SheetActions .../>` (memoized), view action = read-only badge.
- Owner: drop `onBack`/`onToggleEdit`/`onDelete` wiring from CharacterSheetHeader,
  keep delete-confirm modal at page level (`page.tsx:165`).
- Body container gets sheet gradient page background behind tabs.

#### 6. Stats tab disclosure
**File**: `components/character-sheet/StatsTab.tsx`
**Action**: modify — render order becomes:
- Disclosure legend line (muted, one-time: "▸ sections are collapsed, nothing removed")
- Expanded: `AbilityScoresSection`, `CombatStatsSection` (restyle as one-line
  "Combat at a glance" pill row: AC · Attack · Speed + link/button "Details →"
  switching to Combat tab — needs new prop `onGoToCombat?: () => void` threaded from
  page `setActiveTab`)
- Collapsed via `CollapsibleSection`: Traits, Skills, SavingThrows (stats variant),
  Languages, Retainers (counts = items in each; e.g. retainers.length)
- PromoteRetainerModal/Toast unchanged.

### Verification
#### Automated
- [x] test + typecheck + lint pass (incl. new CollapsibleSection test — 173 web tests)
#### Manual (requires authed session — blocked locally by missing AUTH_SECRET; user to verify)
- [ ] Owner sheet: app-bar shows name + Edit + ⋮ (all 4 menu items work: XP log, level-up log, PDF download, delete)
- [ ] `/view` as non-owner: badge in app-bar, DM XP-correction still works
- [ ] Hero: portrait upload, HP ±, XP add/set, Level-Up pulse all functional
- [ ] Stats: ability grid + glance pill visible; 5 collapsed sections expand; pill "Details" jumps to Combat tab
- [ ] Sheet dividers styled on owner AND view routes; dark theme legible

**Phase-3 notes**: inner-section duplicate `<h3>`s hidden via one global rule
(`.collapsible-body > section > h3:first-child`); PortraitButton gained a `size`
prop; compact hero variant switch landed early (plan had it in Phase 4).

---

## Phase 4: Character sheet — Combat, Inventory, Magic, Notes

### Changes

#### 1. Full AC breakdown
**File**: `components/character-sheet/combat/ArmourClassSection.tsx`
**Action**: modify — accept `breakdown: ACBreakdown` (rules-engine type; page already
computes it, `page.tsx:100`). Render rows: Base 10, DEX mod, armour, shield,
kindred, class — only non-zero rows besides Base/DEX; total must equal
`breakdown.total`. Thread prop through `CombatTab.tsx:57` (pass `acBreakdown`
instead of `ac`/`dexScore`/`dexMod`).

#### 2. Combat disclosure
**File**: `components/character-sheet/CombatTab.tsx`
**Action**: modify — Expanded: ArmourClassSection, AttackSection, HitDiceSection.
Collapsed: Conditions, Ammo (when applicable), SavingThrows (rollable), Mounts.
BattleModal untouched.

#### 3. Inventory compact hero + disclosure
**Files**: `app/(app)/characters/[id]/page.tsx`, `view/page.tsx` — pass
`variant={activeTab === 'inventory' ? 'compact' : 'full'}` to CharacterSheetHeader.
**File**: `components/character-sheet/InventoryTab.tsx`
**Action**: modify — Expanded: WeightBar (encumbrance + derived Speed), CoinPurse
row, ItemList (Equipped/Stowed groups). Collapsed: LightTracker ("Light sources"),
SpendForm + BankPanel behind a "Coins" CollapsibleSection adjacent to CoinPurse,
Restock trigger behind the Items heading area. Add-item FAB unchanged
(`InventoryTab.tsx:138` sticky bar / FAB stays above 64px nav — adjust bottom offset
80→64px if hardcoded).

#### 4. Magic disclosure
**File**: `components/character-sheet/MagicTab.tsx`
**Action**: modify — wrap existing sections, zero data-flow changes:
- Expanded: SpellSlotsSection, PreparedSpellsSection
- Collapsed: KindredAbilitiesSection (`count = magicalTraits.length + (kindredGlamourEntry?1:0) + (knackEntry?1:0)`),
  SpellBookSection spell mode (`count = spellEntries.length`) / glamour mode
  (`glamourEntries.length`), RunesSection (`runeEntries.length`)
- Empty/loading states unchanged.

#### 5. Notes dividers
**File**: `components/character-sheet/NotesTab.tsx`
**Action**: modify — restyle sub-tab bar (`:202-232`) to match SheetTabs divider
look (shared styles or copied constants; do NOT reuse SheetTabs component — different
tab type).

### Verification
#### Automated
- [x] test + typecheck + lint pass (365 tests total; inventory, magic, pdf tests green)
#### Manual (requires authed session — user to verify)
- [ ] Combat: breakdown rows sum to total with armour+shield equipped; saves roll inside collapsed section
- [ ] Inventory: compact hero shows; restock sheet opens above nav; spend/bank flows work behind "Spend & Bank" section; FAB positioned right
- [ ] Magic (Enchanter + Elf/Grimalkin + rune class + non-caster fighter): correct sections, roll/pick glamour + knack inside collapsed section, prepared-cast flow intact
- [ ] Notes: 3 sub-tabs styled, autosave works
- [ ] PDF export unchanged (prints all data regardless of collapse state)

**Phase-4 notes**: Combat render order now AC → Attack → HitDice expanded, then
collapsed Conditions/Ammo/Saves/Mounts (Conditions moved from top); Spend+Bank
combined behind one "Spend & Bank" CollapsibleSection; inventory FAB offset 96→80px.

---

## Phase 5: Campaign hub — segmented nav + role-aware Party

### Changes

#### 1. EmptyState primitive
**File**: `components/ui/EmptyState.tsx`
**Action**: create
```tsx
interface Props { emoji: string; headline: string; message?: string;
  cta?: { label: string; onClick: () => void }; escapeHatch?: ReactNode; }
// centered; emoji 2.5rem; headline in var(--font-display); message muted;
// cta = primary button; escapeHatch renders below (e.g. text link / inline form).
```

#### 2. SegmentedNav
**File**: `components/campaign/SegmentedNav.tsx`
**Action**: create
```tsx
interface Props { items: { id: string; label: string; emoji: string }[];
  active: string; onChange: (id: string) => void; }
// Pill container: dash surface bg, border, borderRadius var(--radius-md), padding 3px.
// Segments flex:1, active = primary bg + white text; 44px height.
// ≤380px viewports: hide label, emoji only (CSS clamp via fontSize/media not needed —
// use label span with `display` toggled by container query fallback: always show emoji,
// truncate label with ellipsis).
```

#### 3. Campaign page rewire
**File**: `app/(app)/campaign/page.tsx`
**Action**: modify — tab order/labels: `overview:⚔️ Party, schedule:📅 Schedule,
quests:📜 Quests, npcs:👥 NPCs, bank:🏦 Bank(dmOnly)` (`:34-40`); replace underline
tab bar (`:69-98`) with `<SegmentedNav/>`; add `usePageHeader({ title: 'Campaign',
action: <Link href="/campaign/houses">🏰</Link> })`; drop in-page h1 (`:56-65`).

#### 4. Role-aware Party
**File**: `components/campaign/OverviewTab.tsx`
**Action**: rewrite
```tsx
// Fetch both lists once here (parallel): loadDMCampaigns(), loadPlayerCampaigns().
// dmIds = Set(dm.campaigns.map(c=>c.id))
// Render: dm.campaigns → <DMCampaignCard/>; player campaigns where !dmIds.has(id) → <PlayerCampaignCard/>.
// Neither list → <EmptyState emoji="🏰" headline="No Campaigns Yet"
//   cta={create form reveal} escapeHatch={<JoinCampaignForm/> reveal via "I have an invite code"}/>
// Below cards (when any exist): CollapsibleSection "Join or create" holding both forms.
```

**File**: `components/campaign/overview/DMCampaignCard.tsx`
**Action**: create from `DungeonMasterView.tsx` per-campaign card body (`:226-267`):
role banner (campaign name, in-world date via CurrentDateCard DM mode, "You are DM"
chip), dense roster (restyle MemberList rows: name · class/level chip · mini HP bar —
HP data available via members' characters as in `PartyRoster.tsx:57-92`; keep XP-award
preview annotations), XPAwardPanel, collapsed "Campaign settings" CollapsibleSection
(InviteCodePanel, date edit, PackAnimalsSection). State/handlers (xpAwards, packs,
handleAwardXP `:91-129`) move with it.

**File**: `components/campaign/overview/PlayerCampaignCard.tsx`
**Action**: create from `PartyRoster.tsx`: role banner ("You are a Player" chip),
CurrentDateCard read-only, RestPrompt, roster rows (existing HP-bar tiles).

**Files**: `overview/DungeonMasterView.tsx`, `overview/PlayerView.tsx`
**Action**: delete after extraction (OverviewTab owns fetching now).

### Verification
#### Automated
- [ ] test + typecheck + lint pass
#### Manual
- [ ] Dual-role account: DM card for DM'd campaign, player card for played one — no stacked duplicates
- [ ] Pure player: player card only + collapsed join/create
- [ ] No campaigns: EmptyState w/ create CTA + invite-code escape hatch; both flows complete
- [ ] XP award (with modifier preview) + rest prompt + invite code + pack animals + date advance all work
- [ ] 5 segments usable at 360px width; Bank hidden for non-DM

---

## Phase 6: Campaign Schedule + remaining tabs, empty states, dark pass

### Changes

#### 1. Schedule streamline
**Files**: `components/campaign/ScheduleTab.tsx`, `schedule/SessionList.tsx`,
`schedule/ProposalsSection.tsx`
**Action**: modify
- ProposalsSection card at top: `border: 1px solid var(--color-gold)`, votable rows
  w/ counts (existing logic).
- SessionList: single-line rows `title · date · ✓N ?N ✗N`; group Upcoming/Past
  (past `opacity: 0.6`); row tap expands existing RSVP/edit controls (reuse
  chevron idiom or current inline controls).
- Calendar: demote — replace list/grid toggle with secondary "📅 Calendar view"
  text button; list is default.
- "➕ New session": dashed-border button style.

#### 2. Dashboard restyle, no logic changes
**Files**: `components/campaign/quests/QuestTab.tsx`, `npcs/NpcTab.tsx`, `BankingTab.tsx`
**Action**: modify — dash surface + `var(--radius-md)` + denser row padding; replace
inline empty states (`QuestTab.tsx:117-120`, `NpcTab.tsx:107-110`, `BankingTab.tsx:81-84`,
`ScheduleTab.tsx:170-173`, `SessionList.tsx:33-36`) with `<EmptyState/>`.

#### 3. Dark pass
**Action**: sweep all redesigned surfaces in dark theme; adjust the 3 new tokens'
dark values if contrast fails; check hero gradient, segmented active state, gold
proposal border, dimmed past sessions.

### Verification
#### Automated
- [ ] test + typecheck + lint pass — full suite final run
#### Manual
- [ ] Schedule: propose → vote → auto-session; RSVP from row; edit/delete gated to DM/owner; calendar reachable
- [ ] Quests/NPCs/Bank: CRUD flows unchanged, restyled
- [ ] Every redesigned screen in dark theme, incl. sheet + hub + empty states
- [ ] Side-by-side vs mockup gallery: shell, Stats, Inventory, Party, Schedule, empty states

---

## Cross-phase notes

- Never introduce new z-index values; shell bars 50, dropdowns 60/98-99, modals keep existing.
- `readOnly` prop flows unchanged; every new interactive affordance respects it.
- Collapse state is component-local and non-persisted; PDF export reads data, not UI.
- If `usePageHeader` action nodes cause render loops, memoize with `useMemo` on
  `[editMode, readOnly, characterId]`.
- Issue #72 phases map: P1-2 = issue phase 1+2 foundations/shell; P3-4 = phase 3;
  P5-6 = phases 4+5.
