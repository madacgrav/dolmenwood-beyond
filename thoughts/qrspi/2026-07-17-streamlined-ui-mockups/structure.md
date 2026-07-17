# Structure Outline

## Approach
Build one self-contained HTML artifact incrementally. Each phase adds a complete,
viewable mockup screen (or the shared scaffolding they all sit in) and is verified
by publishing the artifact and eyeballing that screen. Vertical slice = "a screen
you can look at," not "all the CSS, then all the markup." Foundation phase first
(tokens + phone-frame + design-language CSS) so every later screen inherits it.
No `apps/web` code is touched — output lives only in the artifact file.

**Artifact file**: `scratchpad/streamlined-ui-mockups.html` (single file, inline
CSS, no JS beyond optional expand/collapse toggles). Published via Artifact tool,
light theme, favicon 🌲.

---

## Phase 1: Foundation — tokens, frame, two design languages
Establish the shared shell every mockup renders inside: real color tokens as CSS
vars, Cinzel via a web-safe fallback stack, a reusable `.phone` frame + label, a
gallery grid, and the **two distinct surface languages** (Decision 7) as CSS
classes so later phases just apply them.

**Files**: `scratchpad/streamlined-ui-mockups.html`
**Key changes**:
- `:root` CSS vars = `globals.css:6-14` light values verbatim (`--color-bg`…`--color-border`) + radii.
- `.phone { max-width: 390px; ... }` — device frame + caption label.
- `.gallery` — responsive grid holding all phone frames.
- `.sheet-surface` (parchment/immersive: warmer bg, Cinzel accents, soft border) vs `.dash-surface` (dashboard: flatter, denser rows) — the two languages.
- `.appbar`, `.bottomnav` — shared chrome primitives (Phase 2 fills them).

**Verify**: publish artifact; page renders one empty labeled phone frame in the theme colors, no console errors. Both surface classes visibly differ on a swatch.

---

## Phase 2: Shell frame mockup (screen 1)
Slim unified top app-bar (back · title · contextual action · bell) replacing the
near-empty 52px header, plus refined bottom nav. This frame is reused as the
chrome inside screens 2-6, so it ships first.

**Files**: `scratchpad/streamlined-ui-mockups.html`
**Key changes**:
- `.appbar` filled: left back chevron, centered Cinzel title, right action + 🔔 badge.
- `.bottomnav` filled: 5 emoji items (🏠 📜 ⚔️ 🎲 ⚙️), active = color-primary bold + indicator.
- Annotation callout noting "reclaimed header" vs current.

**Verify**: publish; screen 1 shows app-bar + bottom nav, active nav item highlighted, matches token palette. Compare against `BottomNav.tsx:12-20` item list (parity of destinations).

---

## Phase 3: Character sheet — immersive language (screens 2 + 3)
The two hero character-sheet screens in the **immersive/personal-document**
language: (2) primary tab with portrait/HP/XP hero header + progressive-disclosure
sections; (3) a dense tab (Inventory) showing the collapse/expand pattern.

**Files**: `scratchpad/streamlined-ui-mockups.html`
**Key changes**:
- Hero header: 64px portrait, name (Cinzel), `kindred class · Level N`, HP bar, XP bar — modeled on `CharacterSheetHeader.tsx`.
- Sheet-divider tabs (restyled underline, `.sheet-surface`), 5 tabs retained.
- `.section` with `.section--collapsed` showing "▸ N more" affordance + legend (mitigates static-artifact risk).
- Stats primary: essentials expanded (abilities grid, HP/AC summary pill → "see Combat"), secondary sections collapsed.
- Inventory screen: WeightBar + CoinPurse expanded, ItemList grouped, LightTracker collapsed, add FAB.

**Verify**: publish; screens 2-3 render in parchment language, visibly distinct from Phase 2 dashboard chrome; collapsed sections show the "▸ N more" affordance; no section content deleted (all present, just collapsed).

---

## Phase 4: Campaign hub — dashboard language (screens 4 + 5)
The two campaign screens in the **table-dashboard** language: (4) Party with one
role-aware view (not stacked DM+Player) + segmented/card-link section nav instead
of underline tabs; (5) Schedule as a streamlined session list.

**Files**: `scratchpad/streamlined-ui-mockups.html`
**Key changes**:
- Section nav: segmented control or card-link grid to Party/Schedule/Bank/NPCs (`.dash-surface`, flatter).
- Party: single role-aware roster (members + characters + HP), collapsed-by-default campaign cards.
- Schedule: session rows with date, RSVP summary counts, compact list (no calendar toggle in mockup).

**Verify**: publish; screens 4-5 clearly read as a *different experience* from the character sheet (flatter, denser, non-underline nav) while sharing tokens. Side-by-side in gallery, the split is obvious.

---

## Phase 5: Empty state + before/after panel (screens 6-8)
The polish/legibility screens: (6) one cleaner empty-state (emoji + prompt +
action) and (7-8, optional) a before/after density comparison panel — current flat
5-8-section stack vs new collapsed default.

**Files**: `scratchpad/streamlined-ui-mockups.html`
**Key changes**:
- Empty state: centered emoji, muted prompt, primary action — refined vs `research.md` Q5 pattern.
- Before/after: two mini phone frames, "Current" (flat stack) vs "Streamlined" (collapsed), short caption.

**Verify**: publish; gallery shows all 6-8 screens; before/after makes the density reduction legible at a glance. Final read-through for token/spacing consistency across every frame.

---

## Testing Checkpoints
- **After P1**: artifact publishes, theme colors correct, two surface languages differ, empty frame renders.
- **After P2**: shell chrome (app-bar + bottom nav) complete and reusable; nav destinations match current app.
- **After P3**: character sheet reads as immersive personal document; progressive disclosure visible; nothing deleted.
- **After P4**: campaign hub reads as a distinct dashboard experience; different nav pattern; still same token family.
- **After P5**: full 6-8 screen gallery; before/after panel present; consistent throughout. Artifact ready for user's ship/redirect verdict.

## Notes on slicing
- This deliverable is inherently one file, so "vertical" = one complete *screen*
  per phase rather than crossing DB/API/UI layers (no backend exists for a mockup).
  Each screen is independently viewable and vetoable — if Phase 4 is wrong, Phases
  1-3 still stand as valid mockups.
- Phase 1 is the only non-screen phase; it's the shared foundation and can't be
  skipped, but its output is still verifiable (empty frame + swatches).
