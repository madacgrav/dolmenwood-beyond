# Research Questions

## Context
Focus on the Next.js web app under `apps/web/src`: the auth/sign-up flow, the account and campaign Cosmos data modules (`lib/data/`, `lib/cosmos/types.ts`), the authorization helpers in `lib/authz.ts`, and the client-side state/API wrappers that consume account data. Also look at `scripts/` and `apps/web/src/test/` for data-transform and testing patterns.

## Questions

1. Trace the sign-up/registration flow end to end: what data does the sign-up page collect, how does the register API route process it, and what fields end up on the created account document?

2. Where is the account `role` field defined, stored, and consumed? List every type definition, data-module function, API route, client store, and shared package type that reads or writes it.

3. Which UI components and server routes gate behavior on the account's global role (e.g. `role === 'referee'`), and what exactly does each gate control (tabs, views, badges, query branches)?

4. How does `lib/authz.ts` model campaign-level authorization today? What helpers exist for determining DM-ship, membership, and participation of a campaign, and which data modules call each helper?

5. How is a campaign document structured and created — what establishes ownership (`refereeId`), how is membership (`members`) managed, and how do the campaigns API routes and client wrappers (`lib/api/campaigns.ts`) expose DM vs. member views?

6. What patterns exist for data migrations and backfills (e.g. `scripts/migrate-supabase-to-cosmos.ts`, `scripts/lib/transform.ts`), and how are they tested?

7. How do the data-layer tests (`apps/web/src/test/`) exercise account and campaign behavior — what does the Cosmos fake support, and which existing tests cover role- or DM-related logic?
