# Research Questions

## Context

Focus on the authenticated web app under `apps/web/src`. The areas of
interest are: the `(app)` route-group layout and its navigation
(`app/(app)/layout.tsx`, `components/layout/BottomNav.tsx`,
`components/notifications/NotificationBell.tsx`); the character sheet route and
its tab components (`app/(app)/characters/[id]/page.tsx`,
`components/character-sheet/**`); the campaign hub route and its tabs
(`app/(app)/campaign/page.tsx`, `components/campaign/**`); the global design
tokens (`app/globals.css`); and the shared UI primitives in
`components/ui/**`. Report the current state of the code as it exists today —
do not rely on any dated snapshot that may be in the repo.

## Questions

1. What design tokens are defined in `globals.css` today (colors, fonts, radii,
   spacing, shadows, font sizes), how do components actually consume them
   (inline `style` vs Tailwind utilities vs `var(...)`), and how is the
   light/dark theme switch implemented?

2. Trace how a page inside the `(app)` route group gets its outer frame: where
   do the fixed top header, the page title/heading, the max-width container,
   and the bottom navigation each come from, and how much of that is repeated
   per-page versus provided by the shared layout?

3. Map the character sheet: what tabs exist, how is tab state managed, what
   sections does each tab render (name the components), and specifically where
   do armour class and saving throws get computed and displayed across the
   tabs?

4. Map the Magic tab in detail: what sections does it render today (spell
   slots, prepared spells, spell book, kindred abilities, glamours, knacks,
   runes), how is each section gated by class/kindred, and how do its
   roll/pick/add interactions flow through the data layer?

5. Map the campaign hub: what tabs exist today, how is tab access gated (e.g.
   DM-only vs player), and how do the party/roster views differ between a DM
   and a player viewer?

6. What reusable UI primitives currently exist in `components/ui/**` (and
   elsewhere), which are actually used versus unused, and how are recurring
   widgets that lack a shared primitive — modals, form inputs, numeric inputs,
   collapsible/expandable sections, skeleton loaders, empty states — currently
   implemented across the app?

7. What patterns already exist for collapsing or progressively disclosing
   secondary content (accordions, "show more" toggles, expandable rows,
   sub-tabs), and where are they used?
