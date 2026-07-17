# Research Findings

## Q1: Design system definition & consumption

### Findings
- All tokens live in one `@theme` block — `apps/web/src/app/globals.css:4-26`. Exactly:
  - 9 colors: `--color-bg #f5f2e8`, `--color-surface #faf8f0`, `--color-primary #2d5a27`, `--color-primary-hover #234820`, `--color-text #1e1b0f`, `--color-text-muted #6b6450`, `--color-gold #c49a1a`, `--color-danger #8b1a1a`, `--color-border #d4ceb8` (`globals.css:6-14`).
  - 3 fonts: `--font-display 'Cinzel'…serif`, `--font-body 'Satoshi'…sans-serif`, `--font-mono 'JetBrains Mono'…mono` (`globals.css:17-19`).
  - 3 radii `--radius-sm/md/lg` (4/8/12px) + `--touch-target 44px` (`globals.css:22-25`).
- **No spacing scale, no shadow tokens, no font-size tokens.** Only the above.
- Dark mode: two blocks re-declare the same 9 colors (never fonts/radii) — media `prefers-color-scheme: dark` scoped `:root:not([data-theme="light"])` (`globals.css:29-41`) + explicit `[data-theme="dark"]` (`globals.css:44-54`). Toggle UI at `settings/components/AppearanceSection.tsx`.
- Fonts loaded via `next/font/google` in `layout.tsx:5-15` as `Cinzel`→`--font-cinzel`, `JetBrains_Mono`→`--font-jetbrains`, applied on `<html>` (`layout.tsx:42`). **Mismatch:** `@theme` names them `--font-display`/`--font-mono` (hardcoded strings, not `var(--font-cinzel)`); components use both interchangeably (`dice/page.tsx:40` uses `--font-display`, `sign-in/page.tsx:33` uses `--font-cinzel`). **`Satoshi` (`--font-body`) is never loaded** — falls back to Inter/sans-serif.
- **Consumption is always the literal `var(--color-*)` string** — either inline `style={{}}` or Tailwind arbitrary-value `bg-[var(--color-surface)]`. No bare utility classes (`bg-surface`, `text-muted`) anywhere (word-boundary grep confirmed). Examples: `Button.tsx:20-23`, `Card.tsx:12`, `BottomNav.tsx:38-60`, `header/XPBar.tsx:60-95`, `stats/shared.ts:5-12`.
- `--radius-*` tokens barely used — components use literal px or Tailwind `rounded-lg`. `--touch-target` used once (`globals.css:90-95`).
- Global CSS: keyframes `pulse`/`diceShake`/`celebrationBounce`/`levelUpPulse`/`spin` (`globals.css:63-87`); touch-target rule forcing `min-height:44px` on `button,[role=button],a` (`globals.css:89-95`); `.wp-content` family for rendered news HTML (`globals.css:97-108`).

## Q2: App shell & navigation

### Findings
- `(app)/layout.tsx:8-32` — async server component, `force-dynamic` (`:6`). Reads `auth()` session (`:9`), fetches account for `isAdmin` (`:11-15`). **No providers/context/theme provider** — just markup + 2 components.
- Shell structure (`:18-31`): outer flex-column `minHeight:100dvh`; **fixed header only if session** (`:19-27`, `height:52px`, `zIndex:50`, surface bg, holds only `<NotificationBell/>` right-aligned); `<main>` (`:28`) `flex:1`, `paddingTop:52px` (header offset), `paddingBottom:80px` (nav offset); `<BottomNav>` always rendered (`:29`).
- **No max-width at layout level** — every page reimplements its own `maxWidth:600px; margin:0 auto` container.
- `BottomNav.tsx` — client, inline styles only. Items (`:12-20`): Characters 🏠, News 📜, Campaign ⚔️, Dice 🎲, Settings ⚙️, +Admin 🛡️ (if `isAdmin`). Emoji icons, not an icon lib. Active = `pathname.startsWith(href)` prefix match (`:48`); fixed bottom, `height:80px`, `env(safe-area-inset-bottom)` padding, per-item 44px touch targets, active→`--color-primary` bold (`:32-67`).
- `NotificationBell.tsx` — client. Fetches on mount (`:24-31`), `unread` count (`:33`), 🔔 + red badge (`:44-65`); click toggles 280px dropdown at `top:52px` (`:67-98`); items show `body`+relative time, click marks read + refetch (`:35-40`). Unread count not mirrored on BottomNav.
- **No shared PageHeader** — each page hand-rolls `<h1>` + container: `characters/page.tsx:24-39`, `campaign/page.tsx:50-63`, `settings/page.tsx:36-39`. All independently repeat `maxWidth:600px` + `var(--font-display)` heading.
- Root `layout.tsx:36-46` — fonts + `globals.css` only, no providers. PWA metadata/viewport (`:17-34`, `themeColor #2d5a27`, non-zoomable).

## Q3: Shared UI primitives

### Findings
- `components/ui/` = exactly 3 files: `Button.tsx`, `Card.tsx`, `HPBar.tsx`.
- **`Button` and `Card` are ORPHANS — 0 usages anywhere** (grep `<Button`/`<Card`/import paths all empty outside definitions). They're the only files using `cn()`/Tailwind `className`; rest of app is inline styles. Raw `<button>` appears **211 times across 108 files**.
  - `Button.tsx:1-37` — variants primary/secondary/danger/ghost, sizes sm/md/lg. Unused.
  - `Card.tsx:1-21` — `elevated?` bool, surface bg + border. Unused.
- `HPBar` (ui) used in **2 places only**: `CharacterCard.tsx:7,143` + its test. `current/max/showNumbers`, color thresholds >0.66 green / >0.33 gold / else danger (`HPBar.tsx:9`), 6px bar.
- **Second unrelated `HPBar`** at `character-sheet/header/HPBar.tsx:13-88` — different signature, hand-rolls its own bar + `-5/-1/+1/+5` buttons; used by `CharacterSheetHeader.tsx:4`.
- **No shared Modal/Dialog** — 16 files hand-roll `position:fixed; inset:0` overlays with differing z-index/backdrop: `combat/BattleModal.tsx:27` (z50), `stats/PromoteRetainerModal.tsx:25` (z100), `schedule/DeleteSessionModal.tsx:13` (z200), `CharacterCard.tsx:150-156` (z100), plus `DeleteAccountModal`, `RestockSheet`, `PortraitButton`, etc.
- **No shared form inputs** — raw `<input>` 61×/39 files, `<select>` 17×/12 files, each inline-styled. Same block (`padding`/`borderRadius:6px`/`border`/`minHeight:44px`/`boxSizing`) recurs independently in `CampaignCreateForm.tsx:26-39`, `AddItemForm.tsx`, `AddRetainerForm.tsx`.

## Q4: Character sheet composition

### Findings
- Single client route `characters/[id]/page.tsx:17`. Fetches character (`:30-38`, redirects if null) + inventory (`:43`, refetched on every `activeTab` change to keep AC synced). AC derived at page level via `deriveCharacterAC` (`:94-100`), passed to Stats/Combat.
- Tab state `useState` (`:24`): stats/combat/inventory/magic/notes. Tab bar = sticky flex-row buttons (`:121-149`), `overflowX:auto; scrollbarWidth:none` for horizontal scroll of 5 tabs; active→color-primary + bold + 2px bottom border. Body = conditional `&&` render (`:152-156`). Content in `maxWidth:600px` container (`:151`).
- **Header** (`CharacterSheetHeader.tsx`): composes `HeaderTopBar` (back, Edit/Done toggle, ⋮ overflow → XP log/Level-up log/Export PDF/Delete), `PortraitButton` (64px circle, upload), `HPBar`, `XPBar`. Name `<h2>` + `kindred class · Level N`. XPBar has owner (Add/Set modes) + dm-correction variants, pulsing "⬆ Level Up!" when `xp>=nextLevelXP`.
- **Density: each tab stacks 5-8 `<section>`s**, each = `sectionHead` small-caps `<h3>` + a bordered surface card or list of cards. Grid used only for ability scores (3-col). Numeric data as pills/chips, not tables. Dice-rollers/steppers/toggles embedded inline per card.
  - **StatsTab** (7 sections): AbilityScores (3×2 grid), CombatStats pills (AC/Attack/Speed), Skills (d6 roll), SavingThrows (static), Languages, Retainers (+PromoteModal/Toast).
  - **CombatTab** (6-7): Conditions chips (non-persisted), ArmourClass, Attack (d20 per weapon), Ammo (conditional, +BattleModal), HitDice, SavingThrows (rollable variant), Mounts.
  - **InventoryTab** (7-8): WeightBar, CoinPurse, SpendForm, BankPanel, Restock button→sheet, ItemList (Equipped/Stowed/Tiny groups), LightTracker, add FAB (`position:fixed`).
  - **MagicTab** (3, or placeholder if non-caster): SpellSlots, PreparedSpells, SpellBook. Driven by `useSpells`.
  - **NotesTab** (no sub-folder): own sub-tab bar General/Sessions/People (`:202-236`, same underline pattern). Debounced-autosave textarea + dated entry lists.

## Q5: Campaign hub composition

### Findings
- `campaign/page.tsx:13-40` — client, `activeTab` state (overview/bank/schedule/npcs). Fetches account + `loadDMCampaigns` to gate DM-only Bank tab (`:19-31`). Tabs: ⚔️ Party, 🏦 Bank (dmOnly), 📅 Schedule, 👥 NPCs, filtered by `hasDMCampaigns` (`:33-40`).
- **Tab bar identical to character sheet** (`:67-96`): sticky flex-row, active color-primary + bold + 2px bottom border. Difference: campaign uses `flex:1 0 auto` per button (≤4 tabs, no scroll); char sheet uses `overflowX:auto` (5 tabs). Both in `maxWidth:600px` container.
- **OverviewTab** (`:6-13`): stacks DungeonMasterView + PlayerView.
  - DMView: campaign cards with InviteCodePanel, CurrentDateCard, collapsible MemberList, XPAwardPanel (uses `applyXPModifiers` from rules-engine), PackAnimalsSection. Empty→"🏰 No Campaigns Yet"+create form.
  - PlayerView: JoinCampaignForm + PartyRoster (CurrentDateCard, RestPrompt, member/character rows with HP bars).
- **ScheduleTab**: campaign `<select>` if multiple. ProposalsSection (date voting) + SessionList/SessionCalendar toggle. Sessions show RSVP breakdown, RsvpControl, Edit/Delete gated on owner/DM. DeleteSessionModal.
- **BankingTab** (DM-only): card per character w/ balance, transfer form (validated vs balance), expandable ledger.
- **NpcTab**: campaign `<select>`, NpcForm, NpcList grouped by status (STATUS_ORDER/META), NpcCard w/ relationship/status pill/note. Delete via `window.confirm` (flagged `// ponytail:` inline).
- **Noble Houses** sub-screens: `houses/page.tsx` list of cards→detail; `houses/[id]/page.tsx` alignment tag + Field rows (Domain/Seat/Head).
- Density identical to char sheet: vertical flex stacks of rounded surface cards (`borderRadius:10px`), skeleton pulse loaders, centered emoji+muted empty states, collapsible sub-sections not routes, all `maxWidth:600px` mobile-first.

## Cross-Cutting Observations
- **Two competing styling conventions.** The `ui/` primitives use Tailwind+`cn()`; the entire actual app uses inline `style={{}}` with `var(--color-*)`. The primitives are effectively dead code (only HPBar survives, 2 uses).
- **Repeated hand-rolled patterns with no abstraction:** page container (`maxWidth:600px; margin:0 auto`), page `<h1>` (`var(--font-display)`, color-primary), tab bar (sticky, active = color-primary bold + 2px bottom border), surface card (`var(--color-surface)` bg, 1px border, 8-12px radius), fixed-overlay modal, form input block, skeleton pulse loader, centered emoji empty-state. Each duplicated across many files.
- **Mobile-first throughout** — 600px cap, 44px touch targets, `100dvh`, safe-area insets, non-zoomable PWA viewport. No desktop/wide layout.
- **Tab pattern is the app's core navigation idiom** — same underline-tab component reimplemented at page level (char sheet, campaign) and nested (Notes sub-tabs).
- Icons are emoji everywhere (nav, tabs, headers, empty states) — no icon library.

## Open Areas
- No design mockups/Figma/tokens JSON exist beyond `globals.css` (confirmed prior locator pass).
- Auth screens `(auth)/` layout not examined this pass (out of scope — shell is `(app)` only).
- Actual runtime appearance (spacing rhythm, real density on device) not observable from source alone — would need the running app.
