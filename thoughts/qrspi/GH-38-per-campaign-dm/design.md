# Design Discussion

## Current State
A global account `role: 'player' | 'referee'` decides everything DM-related on the client. Server-side authorization is already fully per-campaign and does **not** read `role`.

- **Role written once** at `createAccount` (`account.ts:109`); no mutation path. Defined in `packages/types/src/index.ts:5`, `cosmos/types.ts:15`, `account.ts:20,31`, `auth-store.ts:11` (dead — zero importers), plus inline row types in admin/campaign pages.
- **Sign-up** is a two-step wizard; step 2 is a Player/DM `RoleCard` picker (`sign-up/page.tsx:129-142`) → POSTed and coerced in `register/route.ts:8`.
- **Campaign page** (`campaign/page.tsx`) is a *global binary*: `isDM = account.role === 'referee'` (`:22`) flips the whole screen. `OverviewTab` renders `DungeonMasterView` (all run campaigns) OR `PlayerView` (all joined campaigns) (`OverviewTab.tsx:11-13`). Bank tab is `dmOnly` (`:31,35,100`). One account cannot see both.
- **Both overview views already handle N campaigns** and reuse per-campaign cards: `DungeonMasterView` (create + invite/XP/pack-animals per card), `PlayerView` (join + roster per card). Roster already carries `is_dm` per participant (`campaigns.ts:248`).
- **Server authz** (`authz.ts`) derives DM/member from `CampaignDoc.refereeId`/`members` only. `?as=referee` (`campaigns/route.ts:13`) returns only campaigns where caller **is** `refereeId` — safe regardless of `role`.
- **Display-only role reads**: settings badge (`ProfileSection.tsx:56,95-97`), admin table label (`admin/page.tsx:188`).
- **Migration**: pure row→doc transforms in `scripts/lib/transform.ts`, unit-tested directly (`migration-transform.test.ts`). `toAccountDoc` maps `role` (`:36`).

## Desired End State
Every account is a player. DM-ship is per-campaign (`refereeId`), which already works server-side. The global `role` field is removed. The Campaign page uses a **per-campaign selector**: pick a campaign, and the view/affordances derive from whether the account is that campaign's DM (`is_dm`).

**Verify correct when:**
- Sign-up collects no role; new accounts have no `role` field; a new account can create a campaign (becomes its DM) and join another (is a player there).
- On the campaign page, selecting a run campaign shows DM affordances (invite, XP, bank, pack animals); selecting a joined campaign shows the player roster. Bank is reachable only for a selected campaign the account DMs.
- No live code references `AccountDoc.role`; typecheck + full vitest suite green.
- Existing former-`referee` accounts keep DM-ship of their campaigns (unchanged `refereeId`) and can now also join others as players.

## Patterns to Follow
- **Per-campaign authz predicates** — `isCampaignDM`/`isDMOfAccount`/`assertCampaignParticipant` (`authz.ts:56-105`). Reuse; do not add new role checks.
- **Roster `is_dm` flag** (`campaigns.ts:248`) is the canonical per-campaign DM signal for the client. Prefer surfacing it over any global flag.
- **Data-access layering**: page → `lib/api/campaigns.ts` wrapper → `app/api` route → `lib/data` module → `authz.ts`. Keep it.
- **Pure transform + direct unit test** for the backfill (`scripts/lib/transform.ts` + `migration-transform.test.ts`).
- **Cosmos fake tests** (`campaigns.test.ts`, `account.test.ts`) — update seeds that set `role`.
- **Do NOT follow** the "keep stored names for storage compat" convention here (we chose deletion) — but leave `refereeId` and `?as=referee` field/param names as-is; only the account `role` field goes.
- **Dead code**: delete `auth-store.ts` role state (or the whole store if fully unused).

## Design Decisions
1. **Campaign page → hybrid, tab-appropriate DM-ship** (revised from "per-campaign selector" after structure phase surfaced two constraints: Bank data is DM-global via `dmBankOverview`/`listCampaignsRunByDM`, and `ScheduleTab` already owns a campaign picker). Realization per tab:
   - **Overview**: render both the DM section (`DungeonMasterView`, run campaigns) and the Player section (`PlayerView`, joined campaigns) — both already handle N campaigns, so "show both" is near-free and lets an account be DM and player at once.
   - **Bank**: gate visibility on "runs ≥1 campaign" (`loadDMCampaigns()` non-empty), not global role. Bank aggregates all run campaigns anyway.
   - **Schedule**: `ScheduleTab` derives per-campaign `is_dm` from its existing picker (extend `listMyCampaignNames` to carry `is_dm`), replacing the global `isDM` prop — this is the genuine per-campaign DM logic and is mostly already in place.
   Chosen because it satisfies "DM of one campaign, player of another" with the least churn and no fake scoping of DM-global data.
2. **Delete the `role` field entirely**: remove from `AccountDoc`, `packages/types` `Role`/`Account`, `account.ts` (`SignUpInput`, `docToAccount`, `createAccount`), admin types, and inline page row types. Cosmos is schemaless so stale `role` on old docs is harmless until the backfill runs.
3. **Backfill script strips `role`**: one-off `npx tsx` script (mirrors `migrate-supabase-to-cosmos.ts` invocation) that upserts account docs with `role` removed. Idempotent. Add a `transform.ts`-style pure helper + direct unit test.
4. **Remove role badge and admin role column**: drop from `ProfileSection.tsx` and `admin/page.tsx`; stop passing `role` through `getAdminData` (`admin.ts:58`).
5. **Sign-up collapses to one step**: remove the role step + `RoleCard`; `register/route.ts` drops role handling; POST body loses `role`.

## What We're NOT Doing
- Not touching server-side authz logic (`refereeId`/`members` predicates already correct).
- Not renaming `refereeId`, the `campaigns` `?as=referee` param, or other stored/DB-facing identifiers.
- Not adding a role-management/admin UI (no promote/demote — DM-ship is implicit in campaign ownership).
- Not changing campaign creation, join, invite, XP, bank, or schedule mechanics beyond how the page selects/scopes them.
- Not building analytics like "DM of N / player in M" counts.

## Open Risks
- **Selector UX / tabs**: today tabs (Overview/Bank/Schedule) are global. Scoping them to a selected campaign is the largest UI change; the schedule tab already takes a campaign context via `listMyCampaignNames`. Need a participated-campaigns endpoint that includes `is_dm` (extend `?as=names`, or reuse roster). Detail deferred to structure phase.
- **Empty states**: account with zero campaigns (neither run nor joined) needs a combined create/join entry point (currently split across the two views).
- **Backfill safety**: confirm no other stored doc type embeds account `role` before deletion (research found none beyond `AccountDoc`).
- **`packages/types` external consumers**: `Role`/`Account` importers outside the web app weren't enumerated (research Open Area); removing `Role` may touch the shared package's other consumers.
- **Session/JWT**: verify Auth.js session/JWT doesn't embed `role` (research found no role logic in `lib/auth/*`, but confirm during implementation).
