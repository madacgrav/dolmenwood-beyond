# Structure Outline

## Approach

Six vertical slices, each shippable: fix the visual foundations first (fonts, theme
bootstrap, new tokens), then the shell app-bar, then the character sheet in two
slices (Stats+hero, then remaining tabs), then the campaign hub in two slices
(Party+segmented nav, then Schedule+rest). Shared primitives (`CollapsibleSection`,
`EmptyState`, `AppBar`) land with their first consumer, never as a bare layer.
Verify each phase with `npm run test --workspace apps/web` + `npm run typecheck`
+ manual check against the mockup gallery. Paths relative to `apps/web/src`.

---

## Phase 1: Foundations — fonts, theme bootstrap, tokens

Real Cinzel renders app-wide; stored theme applies before paint; the two surface
styles get tokens. Immediately visible, everything later builds on it.

**Files**: `app/layout.tsx`, `app/globals.css`,
`app/(app)/settings/components/AppearanceSection.tsx`

**Key changes**:
- `globals.css:17` — `--font-display: var(--font-cinzel), 'Georgia', serif`;
  `--font-body` → loaded body font (add `next/font` Inter or equivalent in
  `layout.tsx`) or honest fallback stack; keep `--font-mono` as-is.
- Inline pre-paint `<script>` in root layout `<head>`: read
  `localStorage['dolmenwood-theme']`, set `data-theme` on `<html>`.
- New tokens in `@theme` + both dark blocks (`:29-41`, `:44-54`):
  `--surface-sheet` (parchment gradient stops), `--surface-dash`, plus any
  gold-accent variants the mockups need.

**Verify**: `test` + `typecheck` pass; manually — Cinzel visible on characters list
heading; set Dark in settings, hard-reload → no light flash; auth pages unchanged.

---

## Phase 2: Shell — app-bar, header context, 64px nav

Header becomes back · title · action · bell; pages can inject titles; bottom nav
tightens. Simple pages migrate to prove the contract.

**Files**: `app/(app)/layout.tsx`, new `components/layout/AppBar.tsx`, new
`components/layout/PageHeaderContext.tsx`, `components/layout/BottomNav.tsx`,
`components/notifications/NotificationBell.tsx` (dropdown offset), migrated pages:
`app/(app)/characters/page.tsx`, `app/(app)/settings/page.tsx`,
`app/(app)/news/page.tsx`, `app/(app)/dice/page.tsx`

**Key changes**:
- `PageHeader { title: string; back?: boolean | string; action?: ReactNode }` — context value
- `usePageHeader(header: PageHeader): void` — client hook, sets on mount/deps change
- `<PageHeaderProvider>` wraps children in `(app)/layout.tsx`; `<AppBar/>` (client)
  replaces the inline header; keeps 52px, adds back chevron + centered title + action
  slot; bell unchanged.
- `BottomNav` height 80px → 64px; `<main>` paddingBottom 80px → 64px (+safe-area).
- Migrated pages drop their `<h1>`; keep own `maxWidth` containers for now (frame
  extraction optional, low value vs churn — decide in plan).

**Verify**: `test` + `typecheck`; manually — title centered on 4 migrated pages, back
chevron navigates, bell dropdown aligns, nav 64px, unmigrated pages still render
their own h1 without double-title.

---

## Phase 3: Character sheet — hero header, sheet style, Stats disclosure

The sheet becomes the "immersive document": hero header, parchment surfaces,
sheet-divider tabs, Stats tab disclosure with Combat-at-a-glance pill.
`CollapsibleSection` is born here.

**Files**: new `components/ui/CollapsibleSection.tsx` (+test),
`components/character-sheet/CharacterSheetHeader.tsx` + `header/*`,
`app/(app)/characters/[id]/page.tsx`, `app/(app)/characters/[id]/view/page.tsx`
(shared tab-bar extraction), `components/character-sheet/StatsTab.tsx`,
`stats/CombatStatsSection.tsx`

**Key changes**:
- `CollapsibleSection { title: string; count?: number; defaultOpen?: boolean; children }`
  — renders `▸ N more` affordance, chevron idiom from `RetainerCard.tsx:29-52`,
  component-local state.
- Hero header: 64px portrait, display-font name, HP bar (primary) + XP bar (gold)
  — restyle of existing `HeaderTopBar`/`PortraitButton`/`HPBar`/`XPBar`; back/Edit/⋮
  stay in sheet header (app-bar suppressed or minimal on this route — resolve the
  overlap risk here).
- Tab bar restyled as sheet dividers; extracted `SheetTabs` used by both owner and
  `/view` routes.
- Stats: expanded = AbilityScores, Combat-at-a-glance pill (links to Combat tab);
  collapsed = Traits, Skills, SavingThrows, Languages, Retainers. Disclosure legend.

**Verify**: `test` + `typecheck` (HPBar/AC tests untouched); manually — hero renders,
tabs styled, collapsed sections expand with correct counts, pill switches to Combat
tab, `/view` route matches, dark theme legible.

---

## Phase 4: Character sheet — Combat, Inventory, Magic, Notes

Remaining tabs adopt disclosure; Combat AC breakdown completed; Inventory compact
hero; Magic per design decision 2.

**Files**: `components/character-sheet/CombatTab.tsx`,
`combat/ArmourClassSection.tsx`, `InventoryTab.tsx` + `inventory/*` (grouping only),
`MagicTab.tsx`, `NotesTab.tsx`, `app/(app)/characters/[id]/page.tsx` (compact hero
variant switch)

**Key changes**:
- `ArmourClassSection` props gain full breakdown:
  `{ breakdown: ACBreakdown }` — display armor/shield/kindred/class bonuses the
  engine already computes (`deriveCharacterAC`), not just Base+DEX.
- Combat: expanded = AC, Attack, HitDice; collapsed = Conditions, Ammo, Saves, Mounts.
- Inventory: compact hero (44px portrait, single HP bar); expanded = Encumbrance,
  Coins row, Items (Equipped/Stowed); collapsed = Light sources; Spend/Bank/Restock
  forms behind Coins/Items headings; FAB unchanged.
- Magic: expanded = SpellSlots, PreparedSpells; collapsed = KindredAbilities,
  SpellBook/Glamours, Runes — wrap existing sections, zero data-flow changes.
- Notes: sub-tabs restyled to match dividers.

**Verify**: `test` + `typecheck` (inventory/magic/pdf tests pass); manually — AC
breakdown sums to total; roll/pick glamour+knack still work inside collapsed
section; restock sheet still above nav; ammo battle flow intact.

---

## Phase 5: Campaign hub — segmented nav + role-aware Party

Hub becomes the dashboard: segmented control (5 tabs incl. Quests), Party renders
one role-correct card per campaign. Biggest behavioral change.

**Files**: `app/(app)/campaign/page.tsx`, new
`components/campaign/SegmentedNav.tsx`, `components/campaign/OverviewTab.tsx`
(rewrite), `overview/DungeonMasterView.tsx` → per-campaign `DMCampaignCard`,
`overview/PlayerView.tsx` → `PlayerCampaignCard`, `overview/MemberList.tsx`,
new `components/ui/EmptyState.tsx`

**Key changes**:
- `SegmentedNav { items: {id, label, emoji}[]; active; onChange }` — flat dashboard
  style, `Party · Schedule · Quests · NPCs · Bank`, Bank filtered as today.
- `OverviewTab`: fetch `listMyCampaignNames()` (pattern `ScheduleTab.tsx:51-52`),
  render per campaign: `is_dm ? <DMCampaignCard/> : <PlayerCampaignCard/>`.
  DM card = role banner, dense roster (mini HP bars), XP award, collapsed settings
  (invite code, date edit, pack animals — via `CollapsibleSection`). Player card =
  role banner, roster, rest prompt.
- `EmptyState { emoji; headline; message; cta?; escapeHatch? }` — first used for
  no-campaigns state (create + "I have an invite code" hatch).

**Verify**: `test` + `typecheck`; manually — dual-role account sees DM card for DM'd
campaign and player card for other; XP award works; rest prompt works; join via
escape hatch; 5 segments usable at 360px.

---

## Phase 6: Campaign Schedule + remaining tabs, empty states, dark pass

Schedule streamlined; Quests/NPCs/Bank restyled to dashboard; empty-state pattern
rolled out; final dark-theme sweep.

**Files**: `components/campaign/ScheduleTab.tsx`, `schedule/SessionList.tsx`,
`schedule/ProposalsSection.tsx`, `quests/QuestTab.tsx`, `npcs/NpcTab.tsx`,
`BankingTab.tsx` (styling), various empty states → `EmptyState`

**Key changes**:
- Schedule: proposals card top (gold border), sessions as single-line rows
  `title · date · ✓4 ?1 ✗0`, Upcoming/Past groups (past dimmed), calendar behind
  secondary toggle, dashed "➕ New session" button.
- Quests/NPCs/Bank: dashboard surface + row density, `EmptyState` adoption; no
  logic changes.
- Dark pass across all redesigned surfaces.

**Verify**: `test` + `typecheck`; manually — RSVP/voting/CRUD unchanged; each tab's
empty state renders; dark theme on every redesigned screen.

---

## Testing Checkpoints

After each phase, all of: `npm run test --workspace apps/web`,
`npm run typecheck --workspace apps/web`, `npm run lint --workspace apps/web`.

- **P1**: Cinzel app-wide, no theme flash on reload, new tokens exist in 3 blocks.
- **P2**: app-bar shows title/back/action on 4 migrated pages; nav 64px; no
  double-titles anywhere.
- **P3**: sheet hero + dividers + Stats disclosure live on owner AND `/view` routes.
- **P4**: all 5 sheet tabs disclosed; AC breakdown complete; magic/inventory flows
  verified working (roll glamour, restock, battle).
- **P5**: Party role-aware per campaign; segmented nav with Quests; EmptyState in use.
- **P6**: full hub restyled; dark pass done; mockup-gallery comparison per screen.
