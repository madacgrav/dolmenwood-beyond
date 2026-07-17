# Implementation Plan

## Overview
Build one self-contained HTML artifact (`scratchpad/streamlined-ui-mockups.html`)
showing 6-8 light-theme, high-fidelity mockup screens that demonstrate a lower-
density, less tab-heavy redesign of the character sheet (immersive personal-
document language) and campaign hub (table-dashboard language), inside a reclaimed
app-bar + bottom-nav shell. No `apps/web` code changes.

**Global conventions for the whole file:**
- Single `.html` file, all CSS in one `<style>` block, minimal vanilla JS only for
  expand/collapse toggles (a 12-line delegated click handler).
- Real tokens from `globals.css:6-14` (light values). Cinzel via Google Fonts —
  **but the Artifact CSP blocks external hosts**, so use a serif fallback stack
  (`Georgia, 'Times New Roman', serif`) for display and note it in a caption. No
  `@import url()` / `<link>` to fonts (would be CSP-blocked and fail silently).
- Phone frames laid out in a responsive gallery so all screens compare at once.
- Every mockup is static; interactivity limited to collapse toggles.
- File is written directly (not into a doctype/head skeleton — the Artifact tool
  wraps `<head>`; per Artifact rules write page content only, no `<html>/<head>/<body>`).

---

## Phase 1: Foundation — tokens, frame, two design languages

### Changes

#### 1. Root tokens + base
**File**: `scratchpad/streamlined-ui-mockups.html`
**Action**: create

```html
<style>
:root{
  --color-bg:#f5f2e8; --color-surface:#faf8f0; --color-primary:#2d5a27;
  --color-primary-hover:#234820; --color-text:#1e1b0f; --color-text-muted:#6b6450;
  --color-gold:#c49a1a; --color-danger:#8b1a1a; --color-border:#d4ceb8;
  --radius-sm:4px; --radius-md:8px; --radius-lg:12px; --touch:44px;
  --font-display:Georgia,'Times New Roman',serif;   /* Cinzel stand-in, CSP-safe */
  --font-body:system-ui,-apple-system,'Segoe UI',sans-serif;
}
*{box-sizing:border-box;margin:0}
.page{background:#e7e2d2;color:var(--color-text);font-family:var(--font-body);
  padding:2rem;min-height:100vh}
.page h1.gallery-title{font-family:var(--font-display);color:var(--color-primary)}
</style>
```

#### 2. Phone frame + gallery
**File**: same
**Action**: create

```html
<style>
.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(390px,1fr));
  gap:2rem;align-items:start;max-width:1400px;margin:1.5rem auto 0}
.phone{width:390px;margin:0 auto;background:var(--color-bg);border-radius:28px;
  border:10px solid #2b2820;overflow:hidden;position:relative;
  height:780px;display:flex;flex-direction:column;box-shadow:0 8px 30px rgba(0,0,0,.25)}
.phone .screen{flex:1;overflow-y:auto}
.caption{font-family:var(--font-display);color:var(--color-primary);
  text-align:center;margin:.75rem 0;font-size:1.05rem}
.note{font-size:.75rem;color:var(--color-text-muted);text-align:center;margin-bottom:1rem}
</style>
```

#### 3. Two surface languages (Decision 7)
**File**: same
**Action**: create

```html
<style>
/* immersive / personal-document: warmer, softer, Cinzel accents */
.sheet-surface{background:linear-gradient(#faf8f0,#f3eedd);
  border:1px solid var(--color-border);border-radius:var(--radius-lg);
  padding:.9rem 1rem}
.sheet-surface .label{font-family:var(--font-display);letter-spacing:.04em;
  text-transform:uppercase;font-size:.7rem;color:var(--color-text-muted)}
/* dashboard: flatter, denser, tighter rows */
.dash-surface{background:var(--color-surface);border:1px solid var(--color-border);
  border-radius:var(--radius-md);padding:.6rem .75rem}
.dash-row{display:flex;justify-content:space-between;align-items:center;
  padding:.5rem .25rem;border-bottom:1px solid var(--color-border);font-size:.85rem}
</style>
```

#### 4. Page skeleton + one empty frame + swatch proof
**File**: same
**Action**: create — `<div class="page">`, `<h1 class="gallery-title">`, `<p class="note">` (font caption), `<div class="gallery">` with one empty `.phone` and a swatch row demonstrating both surface classes side by side.

### Verification
#### Automated
- [x] File written; open in browser or publish — renders with no console errors. (Verified via local serve + DOM checks: 0 console errors, tokens `#2d5a27` applied, toggle JS works, no horizontal overflow.)
#### Manual
- [ ] Background `#e7e2d2`, primary green title visible.
- [ ] One empty phone frame renders at 390px with rounded bezel.
- [ ] Swatch shows `.sheet-surface` (warm gradient) visibly distinct from `.dash-surface` (flat).

---

## Phase 2: Shell frame mockup (screen 1)

### Changes

#### 1. App-bar
**File**: same
**Action**: add
```html
<style>
.appbar{height:52px;display:flex;align-items:center;gap:.5rem;padding:0 .75rem;
  background:var(--color-surface);border-bottom:1px solid var(--color-border)}
.appbar .back{font-size:1.2rem;color:var(--color-text-muted)}
.appbar .title{flex:1;text-align:center;font-family:var(--font-display);
  color:var(--color-primary);font-size:1.05rem}
.appbar .act{font-size:1.15rem;position:relative}
.appbar .badge{position:absolute;top:-4px;right:-6px;background:var(--color-danger);
  color:#fff;border-radius:9px;font-size:.6rem;padding:0 4px}
</style>
```
Markup: `‹ back` · centered title · `🔔` with `.badge` "3".

#### 2. Bottom nav
**File**: same
**Action**: add
```html
<style>
.bottomnav{height:64px;display:flex;background:var(--color-surface);
  border-top:1px solid var(--color-border)}
.bottomnav a{flex:1;display:flex;flex-direction:column;align-items:center;
  justify-content:center;gap:2px;font-size:.65rem;color:var(--color-text-muted)}
.bottomnav a.active{color:var(--color-primary);font-weight:700}
.bottomnav a .ic{font-size:1.25rem}
</style>
```
Items (match `BottomNav.tsx:12-20`): 🏠 Characters (active), 📜 News, ⚔️ Campaign, 🎲 Dice, ⚙️ Settings.

#### 3. Screen-1 frame
**File**: same — a `.phone` whose `.screen` shows the app-bar, a placeholder body with an annotation callout ("Reclaimed the near-empty header → back · title · action · bell"), and the bottom nav. Caption "1 · Shell".

### Verification
#### Manual
- [ ] App-bar shows back + centered title + bell w/ red badge.
- [ ] Bottom nav shows 5 items, Characters active (green bold).
- [ ] Destinations match current app's nav list.

---

## Phase 3: Character sheet — immersive language (screens 2 + 3)

### Changes

#### 1. Hero header
**File**: same
**Action**: add (models `CharacterSheetHeader.tsx`)
```html
<style>
.hero{padding:1rem;background:linear-gradient(#f3eedd,#ece4cf);
  border-bottom:1px solid var(--color-border);display:flex;gap:.9rem}
.hero .portrait{width:64px;height:64px;border-radius:50%;background:#d9cfae;
  display:flex;align-items:center;justify-content:center;font-family:var(--font-display);
  font-size:1.4rem;color:var(--color-primary);border:2px solid var(--color-gold)}
.hero .name{font-family:var(--font-display);font-size:1.3rem;color:var(--color-text)}
.hero .sub{font-size:.8rem;color:var(--color-text-muted);margin-bottom:.4rem}
.bar{height:8px;border-radius:5px;background:var(--color-border);overflow:hidden;margin:.3rem 0}
.bar>span{display:block;height:100%}
.bar.hp>span{background:var(--color-primary)}
.bar.xp>span{background:var(--color-gold)}
.barlbl{font-size:.7rem;color:var(--color-text-muted);display:flex;justify-content:space-between}
</style>
```
Header content: portrait initials, name "Aldric Thorne", sub "Breggle Fighter · Level 3", HP bar (18/24) + XP bar (`✨ 2,400 / 4,000`).

#### 2. Sheet-divider tabs
**File**: same
**Action**: add — restyled underline tabs, 5 retained: Stats (active) · Combat · Inventory · Magic · Notes.
```html
<style>
.sheettabs{display:flex;gap:.25rem;padding:0 .5rem;background:#f3eedd;
  border-bottom:1px solid var(--color-border);overflow-x:auto}
.sheettabs a{padding:.6rem .5rem;font-size:.8rem;color:var(--color-text-muted);
  white-space:nowrap;border-bottom:2px solid transparent}
.sheettabs a.active{color:var(--color-primary);font-weight:700;
  border-bottom-color:var(--color-primary)}
</style>
```

#### 3. Progressive-disclosure section + legend
**File**: same
**Action**: add
```html
<style>
.section{margin:.75rem 1rem}
.section>.head{display:flex;justify-content:space-between;align-items:center;
  font-family:var(--font-display);text-transform:uppercase;font-size:.72rem;
  letter-spacing:.05em;color:var(--color-text-muted);cursor:pointer;padding:.35rem 0}
.section>.head .more{color:var(--color-primary);font-weight:700}
.section.collapsed>.body{display:none}
.legend{margin:.5rem 1rem;font-size:.7rem;color:var(--color-text-muted);
  background:#f3eedd;border:1px dashed var(--color-border);border-radius:var(--radius-sm);padding:.4rem .6rem}
</style>
<script>
document.addEventListener('click',e=>{
  const h=e.target.closest('.section>.head'); if(!h)return;
  h.parentElement.classList.toggle('collapsed');
});
</script>
```
Legend text: "▸ N more = collapsed section, nothing removed — tap to expand."

#### 4. Screen 2 — Stats primary
**File**: same — `.phone` with app-bar + hero + sheet-tabs + legend, then sections:
- **Ability Scores** (expanded): 3×2 grid of ability cards (STR/INT/WIS/DEX/CON/CHA with score + mod, prime abilities gold-starred) — from `stats/AbilityScoresSection.tsx`.
- **Combat summary pill** (expanded, de-dup per Decision 5): compact row "AC 15 · Saves ✓ · → Combat" linking out, NOT the full block.
- **Skills** collapsed (`▸ 4 more`), **Languages** collapsed (`▸ 2 more`), **Retainers** collapsed (`▸ 1 more`).
Caption "2 · Character Sheet — Stats".
```html
<style>
.abilgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem}
.abil{background:var(--color-surface);border:1px solid var(--color-border);
  border-radius:var(--radius-md);padding:.5rem;text-align:center}
.abil.prime{border-color:var(--color-gold)}
.abil .sc{font-family:var(--font-display);font-size:1.3rem}
.abil .md{font-size:.7rem;color:var(--color-text-muted)}
.summpill{display:flex;justify-content:space-between;background:var(--color-surface);
  border:1px solid var(--color-border);border-radius:var(--radius-md);padding:.55rem .75rem;font-size:.85rem}
</style>
```

#### 5. Screen 3 — Inventory (dense tab, disclosure)
**File**: same — `.phone`, Inventory tab active, sections:
- **WeightBar** expanded (carried vs cap, color bar), **CoinPurse** expanded (gp/sp/cp).
- **Items** expanded: grouped Equipped / Stowed rows (name · type · weight chip · qty stepper visual).
- **Light Tracker** collapsed (`▸ 1 active`).
- Add-item FAB (circular, bottom-right, `position:absolute` inside frame).
Caption "3 · Character Sheet — Inventory".

### Verification
#### Manual
- [ ] Screens 2-3 in warm parchment language, visibly different from Phase 2 chrome.
- [ ] Collapsed sections show `▸ N more`; clicking a section head toggles it.
- [ ] Legend present; no section content deleted.
- [ ] Stats shows compact combat *summary* pill, not full AC/saves block.

---

## Phase 4: Campaign hub — dashboard language (screens 4 + 5)

### Changes

#### 1. Section nav (not underline tabs)
**File**: same
**Action**: add — segmented control
```html
<style>
.segnav{display:flex;gap:.3rem;padding:.6rem .75rem;background:var(--color-bg)}
.segnav a{flex:1;text-align:center;font-size:.78rem;padding:.5rem .25rem;
  border-radius:var(--radius-md);background:var(--color-surface);
  border:1px solid var(--color-border);color:var(--color-text-muted)}
.segnav a.active{background:var(--color-primary);color:#fff;border-color:var(--color-primary);font-weight:700}
</style>
```
Segments: Party (active) · Schedule · Bank · NPCs.

#### 2. Screen 4 — Party (role-aware, dashboard)
**File**: same — `.phone`, app-bar "Campaign", segnav, then `.dash-surface` cards:
- Role banner "You are DM · Ashwood Vale" (single role-aware view, not stacked DM+Player).
- Party roster as `.dash-row`s: member · character · class badge · level · mini HP bar.
- Collapsed-by-default "Campaign Settings" card (`▸ invite code, in-world date`).
Caption "4 · Campaign — Party". Denser than the sheet screens (tighter rows, flat surfaces).

#### 3. Screen 5 — Schedule (streamlined list)
**File**: same — `.phone`, segnav Schedule active, session rows:
```html
<style>
.session{display:flex;justify-content:space-between;align-items:center;
  padding:.6rem .75rem;border:1px solid var(--color-border);border-radius:var(--radius-md);
  background:var(--color-surface);margin:.4rem .75rem;font-size:.85rem}
.session .rsvp{font-size:.7rem;color:var(--color-text-muted)}
</style>
```
2-3 sessions: title · date · RSVP summary "✓4 ?1 ✗0". "➕ New session" button. No calendar toggle (list only). Caption "5 · Campaign — Schedule".

### Verification
#### Manual
- [ ] Screens 4-5 read as a distinct *dashboard* experience: flatter, denser rows, segmented nav (not underline tabs).
- [ ] Party is one role-aware view, not stacked DM + Player.
- [ ] Side-by-side in gallery, character-sheet vs campaign split is obvious; shared token palette.

---

## Phase 5: Empty state + before/after panel (screens 6-8)

### Changes

#### 1. Screen 6 — Empty state
**File**: same
```html
<style>
.empty{display:flex;flex-direction:column;align-items:center;justify-content:center;
  height:100%;gap:.75rem;text-align:center;padding:2rem}
.empty .emo{font-size:3rem}
.empty .msg{color:var(--color-text-muted);font-size:.9rem}
.empty .cta{background:var(--color-primary);color:#fff;border-radius:var(--radius-md);
  padding:.7rem 1.4rem;font-family:var(--font-display)}
</style>
```
Content: 🏰, "No campaigns yet", "Create your first campaign to gather your party." + CTA. Caption "6 · Empty State".

#### 2. Screens 7-8 — Before/after density
**File**: same — two mini `.phone` frames side by side:
- **Current**: flat stack of 7 look-alike section cards (dense, no collapse) — simulate today's Stats tab.
- **Streamlined**: same tab with 3 expanded + 4 collapsed `▸` rows.
Caption "7-8 · Before / After — Stats density". Short paragraph under it stating the reduction.

### Verification
#### Automated
- [x] Publish artifact via Artifact tool (favicon 🌲, light theme); loads with no console errors. (Published: https://claude.ai/code/artifact/a0f86c0b-56cc-49ce-9b6d-3c772db99bd4 — 6 phone frames + 2 before/after minis, 5 collapsed sections, 2 segnavs, nav labels match BottomNav.tsx.)
#### Manual
- [ ] Gallery shows all 6-8 screens.
- [ ] Before/after makes density reduction legible at a glance.
- [ ] Final pass: token palette + spacing consistent across every frame; two experiences clearly distinct; collapse toggles work.

---

## Testing Checkpoints
- **P1**: publishes, theme correct, two surface languages differ, empty frame + swatch.
- **P2**: reusable app-bar + bottom nav, nav destinations match app.
- **P3**: character sheet = immersive; progressive disclosure works; nothing deleted; combat summary pill in Stats.
- **P4**: campaign hub = distinct dashboard; segmented nav; role-aware Party; same token family.
- **P5**: full gallery + before/after; consistent; collapse JS works. Ready for user's ship/redirect verdict.

## Deviations from structure.md
- **Font**: structure said "Cinzel via web-safe fallback"; plan pins the exact
  reason — Artifact CSP blocks external font hosts, so a serif stack stands in and
  a caption discloses it. No behavior change, just made the constraint explicit.
- Everything else follows the 5-phase structure verbatim.
