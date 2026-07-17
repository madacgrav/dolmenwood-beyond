# Research Questions

## Context
Focus on the web app at `apps/web` (Next.js App Router, React 19, Tailwind v4).
Investigate how the user-facing screens are currently built: the design-token /
theming system in `globals.css`, the app shell and navigation, the shared UI
primitives in `components/ui`, and the two densest feature screens — the
character sheet and the campaign hub. Report the existing structure, composition,
and data each area renders.

## Questions
1. How is the design system defined and consumed — what color/spacing/typography
   tokens exist in `apps/web/src/app/globals.css` (the `@theme` block and light/dark
   overrides), and how do components reference them?

2. How is the authenticated app shell structured — how do the `(app)` route-group
   layout, `BottomNav`, and shared chrome (headers, notification bell) compose page
   navigation and framing across screens?

3. What shared UI primitives exist in `apps/web/src/components/ui/` (Button, Card,
   HPBar), what props and variants do they expose, and where are they reused versus
   where do screens hand-roll their own markup instead?

4. How is the character sheet screen composed — how do its tabs (Stats, Combat,
   Inventory, Magic, Notes) and their sub-component folders organize layout, and
   what data does each tab render?

5. How is the campaign hub composed — how do its tabs (Overview, Schedule, Banking,
   NPCs) structure their layout and what content does each present?
