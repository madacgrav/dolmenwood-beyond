# Design Discussion

Implements GitHub issue #72 (streamlined character sheet, campaign hub, app shell),
updated for app drift since the issue was written. Approved mockup gallery:
https://claude.ai/code/artifact/a0f86c0b-56cc-49ce-9b6d-3c772db99bd4
Paths relative to `apps/web/src`.

## Current State

- **Shell** (`app/(app)/layout.tsx`): fixed 52px header holding only `NotificationBell`
  (`:19-27`); 80px `BottomNav` rendered unconditionally (`:29`); `<main>` pads for both.
  No layout-level max-width, title, or back button — 20+ pages hand-roll containers
  with varying widths (600/900/540px…), 16 hand-rolled `<h1>`s (research Q2).
- **Character sheet** (`app/(app)/characters/[id]/page.tsx`): 5 tabs, local state,
  sticky underline tab bar. Each tab stacks 5-8 flat sections. AC computed once at page
  level (`:100` `deriveCharacterAC`) but displayed twice (stats pill row + combat
  breakdown card that only shows Base+DEX); saving throws rendered twice
  (`stats/SavingThrowsSection` static, `combat/SavingThrowsSection` rollable).
  `view/page.tsx` duplicates AC derivation and the tab list. Magic tab now has up to
  **6 sections** (KindredAbilities, Slots, Prepared, SpellBook, Glamours, Runes —
  `MagicTab.tsx:66-158`) with a `kind` discriminator; tab label is "Magic and Abilities".
- **Campaign hub** (`app/(app)/campaign/page.tsx`): **5 tabs** — Party, Bank (dmOnly),
  Schedule, NPCs, **Quests** (added since issue #72). Overview stacks full DM view +
  full player view for every viewer (`OverviewTab.tsx:6-13`). Role gating inconsistent:
  Bank account-wide, Schedule/NPCs per-campaign `is_dm`, Quests none.
- **Tokens/fonts** (`app/globals.css:6-25`): 9 colors, 3 fonts, 3 radii; no
  spacing/shadow/size tokens. Consumption 100% inline `style={{var(--color-*)}}`.
  **Broken wiring**: `--font-display` is a literal 'Cinzel' string, not
  `var(--font-cinzel)` — the loaded webfont only reaches 4 auth pages; Satoshi never
  loaded; theme choice persisted to localStorage but never re-applied on load
  (`settings/components/AppearanceSection.tsx:7-22`).
- **Primitives**: `ui/Button`+`ui/Card` dead (0 uses); `ui/NumberField` live (2 uses);
  no shared Modal (7+ z-index values), Skeleton (26 inline copies), EmptyState (10+
  copies), or Collapsible — though 5 hand-built disclosure idioms exist (research Q7).

## Desired End State

- **Shell**: real app-bar (52px): back chevron · centered Cinzel page title ·
  contextual action slot · 🔔 with badge. Bottom nav 64px, same destinations. Shared
  600px page frame provided by the shell; per-page `<h1>`/container duplication removed
  from migrated pages. Verify: shell renders titles/actions on characters list, sheet,
  campaign, settings; back navigation works; nav height 64px.
- **Character sheet** = immersive personal document: hero header (64px portrait,
  display-font name, kindred/class/level, HP + XP bars), parchment gradient surfaces,
  sheet-divider tabs, 12px radii. Progressive disclosure per tab (`▸ N more`
  affordance, nothing deleted). Stats gets one-line "Combat at a glance" pill linking
  to Combat; full AC breakdown + saves live once in Combat (breakdown upgraded to show
  armor/shield/kindred/class bonuses the engine already computes). Compact hero variant
  on Inventory. Verify: all data still reachable; collapsed counts accurate; AC math
  unchanged (existing tests).
- **Campaign hub** = table dashboard: segmented control `Party · Schedule · Quests ·
  NPCs · Bank` (Bank last, hidden for non-DMs), flat surfaces, denser rows, 8px radii.
  Party = one role-aware card per campaign (DM variant: roster + XP award + collapsed
  settings; player variant: roster + rest prompt). Schedule: proposals on top,
  single-line session rows, calendar demoted. Verify: dual-role user sees DM card for
  DM'd campaign and player card for played campaign; no stacked duplicate views.
- **Foundations fixed**: `--font-display` wired to loaded Cinzel; body font token
  resolves to a loaded font; theme bootstrap re-applies stored choice before paint.
  Empty-state pattern (emoji · display headline · muted line · one CTA) applied to
  redesigned surfaces. Dark theme pass via existing token overrides.

## Patterns to Follow

- **Inline styles + `var(--color-*)`** — the app's only styling convention (1412 uses,
  153 files). New components follow it. Do NOT resurrect the Tailwind/`cn()` style of
  dead `ui/Button`/`ui/Card`.
- **New tokens go in the `@theme` block** (`globals.css:6-25`) with dark values in both
  existing override blocks (`:29-41`, `:44-54`) — needed for parchment/sheet surface
  colors.
- **Collapse affordances**: follow chevron + conditional-render idiom
  (`RetainerCard.tsx:29-52`, `MemberList.tsx:20-34`) but centralize as one shared
  `CollapsibleSection` (component-local `useState`, like retainers — not the persisted
  `showMembers` model).
- **Per-campaign role derivation**: `campaigns.find(c => c.id===id)?.is_dm ?? false`
  (`ScheduleTab.tsx:51-52`) is the correct role pattern; Party adopts it. Bank's
  account-wide `hasDMCampaigns` gate stays as-is (tab visibility only).
- **Section composition**: keep tab → section-components structure
  (`StatsTab.tsx`, `MagicTab.tsx`) — wrap sections, don't rewrite them.
- **`ui/NumberField`** (`ui/NumberField.tsx`) is the model for new shared primitives:
  inline-style, minimal props, single file, test alongside.
- **Anti-patterns to avoid**: hand-rolled per-page `maxWidth` containers; per-page
  `<h1>`; new one-off modal z-indexes; stacking both role views; duplicating derived
  state between owner and `/view` routes (don't add a third copy).

## Design Decisions

1. **Quests joins segmented nav**: `Party · Schedule · Quests · NPCs · Bank` — Quests
   exists and is participant-facing; Bank last since DM-only.
2. **Magic tab disclosure**: expanded = Spell Slots + Prepared Spells (during-play
   data); collapsed = Kindred Abilities, Spell Book/Glamours, Runes (reference
   material). Roll/pick flows unchanged inside collapsed sections.
3. **Fix font + theme wiring in scope**: point `--font-display` at
   `var(--font-cinzel)`; load a body font (or make `--font-body` honest); add a
   pre-paint bootstrap script applying `localStorage['dolmenwood-theme']`. The
   redesign's visual identity depends on these.
4. **App-bar via React context**: client `AppBar` in the layout + `PageHeaderProvider`;
   pages call `usePageHeader({ title, action, back })`. Supports dynamic titles
   (character name) and contextual actions (Edit) that a route→title map cannot.
5. **Party tab renders per-campaign role**: one card per campaign, DM or player variant
   chosen by that campaign's `is_dm` — correct for dual-role users; matches
   Schedule/NPC pattern. Join/create affordances collapse behind an escape hatch.
6. **Split design languages, one token family** (from issue): sheet = warm parchment
   gradients, Cinzel accents, 12px radii; hub = flat, dense, 8px radii. New surface
   tokens rather than per-component hex literals.
7. **Progressive disclosure, not deletion** (from issue): secondary sections collapse
   behind `▸ N more`; default view = essentials. All 5 sheet tabs stay.
8. **Shared bits limited to what the redesign needs**: `CollapsibleSection`, `AppBar` +
   header context, `EmptyState`, sheet/dash surface styles. Full Button/Card/Modal/
   input consolidation remains separate tech debt (issue's explicit scope call).

## What We're NOT Doing

- No redesign of creation wizard, auth, News, Dice, Settings, Admin, Noble Houses.
- No icon-library migration (emoji stays); no desktop/wide layout.
- No Modal/Button/Card/input consolidation beyond redesign needs; dead `ui/Button`/
  `ui/Card` left alone (delete later as tech debt).
- No Quests permission model change (any-participant edit is server-side behavior;
  out of scope — flag separately).
- No merge of Stats+Combat tabs (explicitly rejected in issue).
- No data-model or API changes; purely presentational except the header context.
- Not unifying owner vs `/view` route duplication beyond reusing new components.

## Open Risks

- **Hero header + app-bar overlap**: sheet already has its own `HeaderTopBar` with
  back/Edit/⋮ menu; moving these into the shared app-bar touches the ⋮ menu (export
  PDF, delete, logs) — needs a slot design that doesn't regress those actions.
- **Theme bootstrap script** must run pre-paint (inline script in root layout) to avoid
  a flash; Next.js inline-script handling needs care.
- **Wiring `--font-display` to real Cinzel** changes rendered font on every page at
  once (most users currently see Georgia) — broad but intended visual shift.
- **Party consolidation** removes the always-visible JoinCampaignForm/create form;
  escape-hatch discoverability needs the empty-state CTA to carry it.
- **Segmented control with 5 items** at 360px viewports — may need label truncation or
  icon-only segments; verify on mobile width.
- `view/page.tsx` duplicates the tab list — sheet-divider restyle must be applied in
  both places or extracted.
