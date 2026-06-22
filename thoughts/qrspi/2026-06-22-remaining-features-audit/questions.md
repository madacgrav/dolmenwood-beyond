# Research Questions

## Context

This is an implementation-status survey of the Dolmenwood Beyond monorepo
(`apps/web` Next.js 15 PWA, plus `packages/rules-engine`, `packages/types`,
`packages/ui`). For each area below, trace what currently exists in the code,
how complete the wiring is end-to-end (UI → store/hook → Supabase RPC/table),
and where the code falls back to a placeholder, "coming soon" message, hardcoded
value, or skip link. Treat `dolmenwood_beyond_prd.md` (Section 5 Screen Inventory
and Section 6 Rules Engine) as the reference for the intended feature set, but
report only on what is actually present in the code — not on what should be added.

## Questions

1. In the character-creation wizards under `apps/web/src/app/(app)/characters/new`,
   which steps render real components versus a "coming soon"/skip fallback across
   the auto, manual, and import paths? Trace how `wizard-store.ts` and the
   `Step*` / `ManualStep*` components are wired into each `[step]` route.

2. On the character sheet (`components/character-sheet/`), which interactive
   in-play tools described for the Stats, Combat, Inventory, and Magic tabs are
   actually implemented — e.g. inline skill/weapon/save dice rollers, the
   start-battle ammo counter, the inventory restock tool, coin-weight encumbrance,
   and spell-slot/memorization tracking? Identify which are present and functional
   versus absent.

3. How are retainers and mounts handled in the code? Trace the `retainers` and
   `mounts` tables, the rules-engine `retainers.ts`, the `AddRetainerForm` /
   `AddMountForm` components, and any dedicated retainer/mount sheet — including
   whether a "promote retainer to full character" flow and Knight full-stat-block
   mounts exist.

4. What does the campaign/party surface currently provide? Map the tabs and
   components under `app/(app)/campaign` and `components/campaign/` (overview,
   banking, schedule), the related Supabase RPCs (`create_campaign`, `join_campaign`,
   `award_xp`, banking, scheduling), the role-based player/referee views, and the
   status of the separate `app/(app)/party/page.tsx` route.

5. What is the app's navigation and shared-primitive structure? Trace the tabs
   registered in `components/layout/BottomNav.tsx`, how they compare to the routes
   that exist, the state of `packages/ui` versus `apps/web/src/components/ui`, and
   any `// TODO` markers in widely-used components such as `CharacterCard.tsx`.

6. What does the settings area and platform/offline layer implement? Trace the
   sections under `app/(app)/settings/components/` (profile, optional-rules toggles,
   appearance, offline mode, data export/import, account deletion), how the optional
   rules toggles are consumed elsewhere, and the PWA configuration (manifest,
   service worker, icons) in `apps/web`.

7. What does `packages/rules-engine` actually compute, and how does its coverage
   compare to the derived-stat and class-advancement tables in PRD Section 6?
   Enumerate the exported functions and data JSON files, the test files, and note
   any stats from the PRD calculation table that have no corresponding implementation.
