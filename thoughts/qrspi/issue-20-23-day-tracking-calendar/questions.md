# Research Questions

## Context
Focus on four areas of this Next.js + Cosmos DB monorepo: (1) per-character resettable resources and how they are refreshed, (2) any existing model of in-game or in-world temporal state and the `moonSign` field, (3) campaign-scoped shared state that the referee controls and the whole party reads, and (4) the server-tier data-access conventions and how static reference data is stored and loaded — including the `packages/rules-engine` package, not just `apps/web`. Also distinguish the existing real-world scheduling/calendar code from any in-world time handling.

## Questions

1. Which per-character resources are consumable or use-limited (spell slots, HP, prepared spells, any per-day/per-rest ability uses), how are they stored on the character document, and where is each one reset? Trace the full mutation path from UI action to Cosmos write, including any existing "rest" operation.

2. Where is `moonSign` defined, set, and displayed, and does any model of in-game time exist anywhere — elapsed days, in-world dates, downtime, or a "current day" counter at the character or campaign level?

3. How is campaign-scoped shared state that the referee controls and party members read (e.g. sessions/schedule, campaign data) modeled, stored, and authorized? Trace both a read and a write for one representative example, including the authorization helpers used.

4. Take one existing feature and document every layer of the server-tier data-access pattern — the data module, the API route, the `lib/api` client wrapper, and the authz helper — and show how they connect end to end.

5. How is static, read-only reference/game data (equipment catalog, classes, spells, tables) stored, seeded, and loaded at runtime? What would adding a new reference dataset involve?

6. What do the existing `lib/calendar.ts` and the scheduling feature actually serve (real-world player availability vs. anything in-world), and how is date/time represented and rendered there?
