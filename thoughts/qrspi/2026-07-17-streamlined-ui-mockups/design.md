# Design Discussion

## Current State
Mobile-first PWA, all screens capped `maxWidth:600px`, single-column stacks of
bordered surface cards. Navigation is tab-heavy and density is high:

- **Shell** (`(app)/layout.tsx:18-31`): fixed 52px top header that holds *only*
  the NotificationBell (mostly empty bar); fixed 80px bottom nav with 5-6 emoji
  items (`BottomNav.tsx:12-20`); every page re-implements its own
  `maxWidth:600px` container + `<h1>` (no shared PageHeader — `characters/page.tsx:24`,
  `campaign/page.tsx:50`, `settings/page.tsx:36`).
- **Character sheet** (`characters/[id]/page.tsx`): 5 horizontally-scrolling tabs
  (Stats/Combat/Inventory/Magic/Notes), each tab stacks **5-8 sections**
  (`research.md` Q4). Stats has 7, Combat 6-7, Inventory 7-8. Notes adds its own
  nested sub-tab bar. AC and Saving Throws appear in *both* Stats and Combat.
- **Campaign hub** (`campaign/page.tsx`): 4 tabs (Party/Bank/Schedule/NPCs);
  Overview tab stacks full DM view + full Player view; everything is stacked
  cards with collapsible sub-sections.
- Emoji used as icons everywhere; no icon set. Cinzel display font for headings,
  body falls back to sans (Satoshi never loaded — `research.md` Q1).

## Desired End State
A published **HTML artifact** (light theme, real color tokens + Cinzel) showing
**6-8 mockup screens** that demonstrate a simpler, lower-density, less tab-heavy
version of the three surfaces. Success = the user can look at the artifact and
say "yes, ship in this direction" (or redirect) before any code is touched. These
are non-interactive visual mockups — no real data, no wiring.

**Mockup screen list (hero + key states):**
1. **Shell frame** — slim unified top app-bar (back · title · contextual action ·
   bell) + refined bottom nav. Wraps every other mockup.
2. **Character sheet — primary view** — redesigned default tab with reduced
   density via progressive disclosure (essentials up top, detail collapsed).
3. **Character sheet — second tab** (Inventory or Combat) — shows the
   collapse/expand density pattern applied to a dense tab.
4. **Campaign hub — Party** — DM/Player consolidated, collapsed-by-default cards.
5. **Campaign hub — Schedule** — streamlined session list.
6. **Empty state** — cleaner emoji+prompt pattern (one example).
7-8. Optional: a "before/after" density comparison panel (current stacked
   sections vs collapsed default view) to make the streamlining legible.

## Patterns to Follow
- **Color tokens** — light values from `globals.css:6-14` verbatim
  (`--color-bg #f5f2e8`, `--color-surface #faf8f0`, `--color-primary #2d5a27`,
  `--color-gold #c49a1a`, `--color-danger #8b1a1a`, `--color-text #1e1b0f`,
  `--color-text-muted #6b6450`, `--color-border #d4ceb8`). Mockup must look like
  the shipped app.
- **Cinzel display font** for headings (`--font-display`), sans body.
- **Surface-card idiom** (`var(--color-surface)` bg, 1px `--color-border`,
  8-12px radius) — keep it, it's the app's visual DNA (`research.md` Q5).
- **Sticky underline tab bar** (`characters/[id]/page.tsx:121-149`) — retained
  on the character sheet only (restyled as sheet dividers); the campaign hub
  moves off this pattern entirely (see Decision 7).
- **44px touch targets**, mobile 600px column, safe-area awareness.

**Patterns to NOT follow (things the mockup should visibly improve):**
- Near-empty 52px header holding only the bell — reclaim it as the page app-bar.
- Duplicated per-page header/container markup — mockup implies one shared frame.
- 5-8 sections dumped flat per tab — mockup shows progressive disclosure instead.
- AC/Saves duplicated across Stats *and* Combat — mockup keeps both tabs but
  shows the full detail once (Combat) and a compact summary in Stats.

## Design Decisions
1. **Deliverable = single HTML Artifact**, one scrollable page with each mockup
   in a labeled phone-frame, so all screens compare side by side. Chosen over
   React prototype (too close to implementation for an exploration pass) and
   plain wireframes (user wants high-fi).
2. **Light theme only** — full real theme, skip dark-mode variants for speed.
   Dark can follow if direction approved.
3. **Three levers, in priority order: reduce density → simplify navigation →
   visual polish.** (User picked these three; explicitly *not* "unify patterns" —
   the shared-component refactor is real tech debt but out of scope for a *visual*
   mockup pass; see Not Doing.)
4. **Density approach = progressive disclosure**, not deletion. Nothing is
   removed; secondary sections collapse behind expandable headers so the default
   view is short. Preserves all existing functionality (task says redesign layout,
   not cut features).
5. **Nav simplification = clearer hierarchy, same tab count.** Character sheet
   keeps its 5 tabs (Stats+Combat merge rejected as too aggressive). Instead:
   de-duplicate content *within* tabs (AC/saves shown fully in Combat, Stats
   shows only a compact summary pill linking there), and campaign Party shows one
   role-aware view instead of stacked DM+Player.
6. **Icons stay emoji** — replacing the icon system is its own project; mockup
   keeps emoji so it reads as the same app.
7. **Character sheet and campaign hub get deliberately different experiences**
   (user direction). Today both use the identical sticky-underline-tab +
   card-stack pattern (`research.md` Q5 "tab bar identical to character sheet").
   The mockup splits them:
   - **Character sheet = immersive personal document.** Character-first framing:
     large header with portrait/HP/XP as the hero, parchment-leaning surfaces,
     Cinzel accents, tabs styled as understated sheet dividers. Feels like *your
     character*, optimized for at-the-table play (rolls, HP, inventory at thumb
     reach).
   - **Campaign hub = table dashboard.** Utility/management framing: denser
     informational rows, section navigation instead of look-alike underline tabs
     (e.g. segmented control or card-link grid to Party/Schedule/Bank/NPCs),
     flatter surfaces, oriented to coordination between sessions.
   Both still share the same design tokens so the app stays one family.

## What We're NOT Doing
- Not writing production code or touching `apps/web` — mockups only.
- Not wiring real data, state, or interactivity beyond what an HTML artifact needs
  to show a state.
- Not the shared-component consolidation (Button/Card/Modal/Input) — noted as debt,
  but a *visual* mockup, not a refactor. Can spin out separately.
- Not redesigning the creation wizard (dropped from scope), auth screens, News,
  Dice, Settings, Admin, or Noble Houses.
- Not adding dark-mode mockups this pass.
- Not changing the token set, fonts loaded, or fixing the Satoshi/`--font-body`
  gap (that's an implementation fix, not a mockup concern).

## Open Risks
- **Density cuts may hide info DMs/players rely on.** Progressive disclosure
  defaults are guesses; the mockup must make "what's collapsed" obvious so the
  user can veto specific choices.
- **Stats/Combat de-duplication** (full detail in Combat, summary in Stats) still
  changes what players see on the default tab — mockup must make the summary
  affordance obviously tappable so it doesn't read as data loss.
- **High-fi look depends on real runtime feel** we can't observe from source
  (`research.md` Open Areas) — spacing rhythm in the artifact is an educated
  approximation of the live app.
- **Artifact is static** — reviewers may read collapsed sections as "deleted."
  Mitigate with a visible "▸ N more" affordance and a short legend.
