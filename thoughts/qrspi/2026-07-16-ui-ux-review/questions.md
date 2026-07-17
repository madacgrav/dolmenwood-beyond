# Research Questions

## Context
Focus on the `apps/web` Next.js front-end: the authenticated app shell and
navigation (`src/app/(app)/layout.tsx`, `components/layout/BottomNav.tsx`), the
global styling/token system (`src/app/globals.css`, Tailwind v4 `@theme`), the
tabbed character sheet (`src/app/(app)/characters/[id]/` and
`components/character-sheet/`), the shared UI primitives in `components/ui/`, and
the many forms/modals/editable-field interactions across the app. Trace how these
are structured and where conventions diverge.

## Questions
1. How is the authenticated app shell and navigation structured — the top header,
   `<main>` content region, and `BottomNav` — and how does a user move between the
   primary screens (characters, campaign, dice, settings, admin)?

2. How is styling applied across the app? Trace the design-token system in
   `globals.css` (`@theme` custom properties, light/dark handling) and document
   where components consume Tailwind utility classes versus inline `style={{}}`
   objects versus local style-constant files.

3. How does the character sheet screen work — the tabbed interface (stats / combat
   / inventory / magic / notes), how tab state is managed, and how each tab's
   sections, forms, and data hooks are composed?

4. What shared UI primitives exist (`Button`, `Card`, HP/XP bars, `StatPill`,
   `ItemRow`), how consistently are they reused, and where do screens implement
   their own one-off versions of the same element (e.g. the two HP bars, the
   per-feature modals with no shared `Modal`)?

5. What are the recurring interaction patterns for editing data — forms
   (`AddItemForm`, `SpendForm`, spell/retainer/mount forms), editable inline
   fields (the `ItemRow` quantity stepper + tap-to-edit), modals, and stepper
   controls — and how consistent are their layout, validation, and feedback?

6. How does the UI handle loading, error, empty, and offline states, and where are
   these defined (route-level `loading.tsx`/`error.tsx`, per-hook fetch states,
   offline-mode settings)?

7. How are touch targets, responsiveness, and mobile ergonomics handled given the
   bottom-nav mobile-first layout (`--touch-target: 44px`, viewport/manifest setup,
   fixed header/nav spacing)?
