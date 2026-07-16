# Research Findings

## Q1: Trace the sign-up/registration flow end to end

### Findings
- **Sign-up page** `apps/web/src/app/(auth)/sign-up/page.tsx` is a two-step wizard: `step: 'details' | 'role'` (`page.tsx:8-18`).
  - Step 1 collects `displayName` (optional), `email` (required), `password` (required, `minLength={8}`) — `page.tsx:112-124`.
  - Step 2 is two `RoleCard` buttons: "Player" (`'player'`) and "Dungeon Master" (`'referee'`) — `page.tsx:129-142`. Local `type Role = 'player' | 'referee'` at `page.tsx:8`, default `'player'` (`page.tsx:16`).
  - Submit POSTs `/api/auth/register` with `{ email, password, role, displayName: displayName || email.split('@')[0] }` — `page.tsx:29-33`. On success, auto `signIn('credentials', ...)` and route to `/characters` — `page.tsx:42-49`.
- **Register route** `apps/web/src/app/api/auth/register/route.ts`:
  - Coerces role: `body?.role === 'referee' ? 'referee' : 'player'` — `route.ts:8`. `displayName` passed only if string — `route.ts:9`.
  - Validates email regex (`route.ts:11-13`), password ≥ 8 chars (`route.ts:14-16`). Calls `createAccount(...)`, 201 on success (`route.ts:18-20`); 409 if error message includes `'already exists'`, else 500 (`route.ts:21-25`).
- **`createAccount`** `apps/web/src/lib/data/account.ts:100-125`:
  - Lowercases email again (`:101`), duplicate check via `fetchAccountDocByEmail` (`:102-104`).
  - Doc fields: `id: crypto.randomUUID()` (`:107`), `email` (`:108`), `role` re-validated a second time (`:109`), `displayName` fallback to email local-part (`:110`), `inviteCode: await generateInviteCode()` (6-char, collision-checked, `:77-93`), `isAdmin: false` (`:112`), `phone: null` / `emailOptIn: true` / `smsOptIn: false` / `whatsappOptIn: false` / `whatsappConsentAt: null` (`:113-117`), `passwordHash: bcrypt 10 rounds` (`:118`), `requiresPasswordReset: false` (`:119`), `createdAt`/`updatedAt` (`:120-121`). Written via `accounts().items.create(doc)` (`:123`).
- **`AccountDoc`** `apps/web/src/lib/cosmos/types.ts:10-29` — container `accounts`, partition key `/id` (`types.ts:9`). Comment at `types.ts:13-14`: `'referee'` is the stored value for the DM role, kept for storage compatibility; UI says "DM".

## Q2: Where is the account `role` field defined, stored, and consumed?

### Type definitions
- `packages/types/src/index.ts:5` — shared `export type Role = 'player' | 'referee'` (compat comment at `:3-4`); used in domain `Account` interface at `:42-47`.
- `apps/web/src/lib/cosmos/types.ts:15` — `AccountDoc.role: 'player' | 'referee'` (persistence).
- `apps/web/src/lib/data/account.ts:20` — snake_case `Account.role: string` (widened); `SignUpInput.role: 'player' | 'referee'` at `:31`.
- `apps/web/src/app/(auth)/sign-up/page.tsx:8` — component-local `Role` alias (not imported from `@dolmenwood/types`).
- `apps/web/src/stores/auth-store.ts:11` — `AuthState.role: 'player' | 'referee' | null` (inline union).
- `apps/web/src/lib/data/admin.ts:14` — `AdminData.accounts[].role: string`; `apps/web/src/app/(app)/admin/page.tsx:10` — local row type; `apps/web/src/app/(app)/campaign/page.tsx:20` — inline `{ id: string; role: string }`.

### Readers / writers
- **Only writer**: `createAccount` (`account.ts:109`). No role-mutation function exists; `updateDisplayName` (`:143-149`) and `updateNotificationPrefs` (`:151-165`) don't touch it.
- `docToAccount` maps `doc.role` → `Account.role` — `account.ts:37-49` (line 42).
- `getAdminData` passes `a.role` through to admin payload — `admin.ts:58`.
- **API surface**: `GET /api/account` returns role via `fetchAccount` → `docToAccount` (`apps/web/src/app/api/account/route.ts:19-23`). `POST /api/auth/register` consumes it (`register/route.ts:8`).
- **Client store**: `useAuthStore` (`auth-store.ts:9-27`) holds `role` + `setRole` + reset in `signOut()` — but **no component imports it**; dead as far as the repo grep shows.
- `apps/web/src/lib/authz.ts` never reads `AccountDoc.role`; all its DM checks derive from `CampaignDoc.refereeId`/`members`. Admin gate is `me.isAdmin` (`admin.ts:34`), a separate boolean.
- Test fixtures referencing role: `account.test.ts:20-87`, `campaigns.test.ts:5-7,110`, `bank-levelup.test.ts:8-9,95`, `migration-transform.test.ts:16,24`, `proposals-notifications.test.ts:5-7`, `notification-whatsapp.test.ts:5-7`.

### Two distinct "referee" concepts
1. `AccountDoc.role: 'player' | 'referee'` — global account role.
2. `CampaignDoc.refereeId` — per-campaign DM account id; same word root, unrelated field.

## Q3: Which UI components and server routes gate on the global role?

### Findings
- **`apps/web/src/app/(app)/campaign/page.tsx`** — the main consumer:
  - `checkRole()` fetches `/api/account`, sets `isDM = account.role === 'referee'` (`page.tsx:17-27`, check at `:22`).
  - Tab list with `dmOnly` on `bank` (`:29-33`, flag at `:31`); `visibleTabs = tabs.filter(t => !t.dmOnly || isDM)` (`:35`) hides Bank tab from non-DMs.
  - "DM view" caption under header when `isDM` (`:56-60`).
  - `OverviewTab` receives `isDM` (`:96-98`), which branches `DungeonMasterView` vs `PlayerView` (`apps/web/src/components/campaign/OverviewTab.tsx:11-13`).
  - Bank tab content double-gated: `activeTab === 'bank' && isDM` (`:100-112`).
  - `ScheduleTab` receives `isDM` (`:114-116`); propagated into `ProposalsSection` (`ScheduleTab.tsx:193,267`), then `ProposalList.tsx:39` / `SessionList.tsx:53` compute `canManage = created_by === userId || isDM` for edit/delete UI.
- **`apps/web/src/app/(app)/settings/components/ProfileSection.tsx`** — badge color (`:56`) and label "Dungeon Master"/"Player" (`:95-99`). Display only.
- **`apps/web/src/app/(app)/admin/page.tsx:188`** — table label `acc.role === 'referee' ? 'Dungeon Master' : 'Player'`. Display only; admin access is gated by `me.isAdmin` in `getAdminData` (`admin.ts:32-34`), not role.
- **`apps/web/src/app/api/campaigns/route.ts:12-15`** — branches on client-chosen `?as=` param, NOT on `account.role`: `as=referee` → `loadDMCampaigns()`; `as=names` → `listMyCampaignNames()`; default → `loadPlayerCampaigns()`. Nothing in the route reads `AccountDoc.role`.
- **`apps/web/src/lib/api/campaigns.ts`** — `loadDMCampaigns()` fetches `?as=referee` (`:57-62`); `loadPlayerCampaigns()` fetches bare (`:64-69`). Neither checks role.
- **Sign-up** role picker selected-state (`sign-up/page.tsx:130,137`) and register-route coercion (`register/route.ts:8`) are the remaining role reads.
- Downstream `isDM` props (`ScheduleTab`, `ProposalsSection`, `ProposalList`, `SessionList`) all originate from `campaign/page.tsx`'s global-role-derived state. `bank.ts:67`'s local `isDM` is campaign-derived (`isDMOfAccount`), not global role.

## Q4: How does `lib/authz.ts` model campaign-level authorization?

### Helpers (`apps/web/src/lib/authz.ts`)
- `HttpError` (`:10`), `forbidden()`/`notFound()`/`badRequest()` (`:16-18`).
- `assertOwner(accountId, ownerId)` (`:21-23`) — 403 unless equal. Internal use only (by `assertCharacterOwner` `:131`).
- `fetchCampaignDoc(campaignId)` (`:42-51`) — point-read `campaigns` by id (pk = id), null on error. Internal only (`assertCampaignParticipant` `:67`).
- `isCampaignMember(doc, accountId)` (`:53-54`) — `doc.members.some(m => m.accountId === accountId)`. Internal only.
- `isCampaignDM(doc, accountId)` (`:56-57`) — `doc.refereeId === accountId`. Internal only (via `isCampaignParticipant`).
- `isCampaignParticipant(doc, accountId)` (`:59-60`) — member OR DM. Called directly with prefetched docs in `proposals.ts:76,141` and `schedule.ts:55,121`.
- `assertCampaignParticipant(campaignId, accountId)` (`:63-71`) — fetch + 404/403, returns doc. Callers: `campaigns.ts:238` (roster), `:278` (pack animals), `proposals.ts:35`, `schedule.ts:41`.
- `listCampaignsRunByDM(accountId)` (`:73-81`) — cross-partition `WHERE c.refereeId = @id ORDER BY c.createdAt DESC`. Callers: `authz.ts:103` (internal), `campaigns.ts:199,219`, `bank.ts:110`.
- `listCampaignsWithMember(accountId)` (`:83-92`) — `EXISTS` subquery on `c.members`. Callers: `campaigns.ts:211,220`.
- `isDMOfAccount(dmId, targetAccountId)` (`:98-105`) — false if self (`:102`); true when `dmId` runs a campaign the target is a member of (`:104`). Callers: `campaigns.ts:262` (awardXP), `bank.ts:47,67`.
- `canReadCharacter(accountId, doc)` (`:108-111`) — owner OR `isDMOfAccount(accountId, doc.ownerId)`. Callers: `characters.ts:112`, `mounts.ts:37`, `retainers.ts:35`.
- `assertCharacterOwner(accountId, characterId)` (`:114-133`) — point-read hot path + cross-partition fallback to distinguish 404/403. Callers: `level-up.ts:70`, `inventory.ts:41`, `characters.ts:66,125,139`, `spells.ts:59`, `portraits.ts:37`.

### Observations
- None of these read `AccountDoc.role` — server-side authz is already fully per-campaign (`refereeId` / `members`).
- `bank.ts:47` blocks reads unless owner or `isDMOfAccount`; `bank.ts:67-69` local `isDM` allows DM negative-amount entries, restricts positive deposits to owner.
- `admin.ts:3` imports only `forbidden`; admin gate is `isAdmin` (`admin.ts:32-34`).

## Q5: Campaign document structure and creation

### Findings
- **`CampaignDoc`** `apps/web/src/lib/cosmos/types.ts:197-211` — container `campaigns`, pk `/id`: `id`, `name`, `refereeId` (DM account id, compat-named per comment `:200-201`), `inviteCode`, `members: { accountId, joinedAt }[]`, `partyMounts`, optional `sessions?`/`proposals?`, `createdAt`, `_etag?`.
- **`createCampaign`** `campaigns.ts:76-91` — `requireAccountId()` (`:77`), name validation (`:78-79`), `refereeId: me` establishes ownership (`:83`), empty `members`/`partyMounts`, invite code via `generateCampaignInviteCode()` (`:60-74`, 20 attempts, uniqueness query).
- **`joinCampaign`** `campaigns.ts:94-119` — lookup by uppercased invite code (`:98-104`); `replaceCampaignWithRetry` (`:34-55`, `_etag`/`IfMatch` optimistic concurrency, 3 retries on 412); authorize callback is no-op (`:110` — any authenticated account may join); 400 if already member (`:112-114`); appends `{ accountId: me, joinedAt }` (`:115`).
- **Roster** `getCampaignRoster()` `campaigns.ts:234-251` — `assertCampaignParticipant` gate (`:238`), `participantIds = [refereeId, ...members minus refereeId]` (`:239-242`), `is_dm: id === doc.refereeId` (`:248`).
- **Views**: `loadDMCampaigns()` (`campaigns.ts:197-207`, null when no campaigns at `:200`); `loadPlayerCampaigns()` (`:209-213`); `hydrateCampaign()` (`:178-195`) builds `CampaignData` with member display names + characters.
- **Routes**: `GET /api/campaigns` dispatch on `?as=` (`route.ts:10-19`); `POST` create (`:21-29`); `POST /api/campaigns/join` (`join/route.ts:5-12`); `GET .../roster` (`roster/route.ts:7-14`); plus mounts/proposals/schedule subroutes.
- **Client types** `apps/web/src/lib/api/campaigns.ts`: `Member` (`:31-36`), `CampaignData` (`:38-45`), `DMCampaignsData` (`:47-50`); wrappers `loadDMCampaigns` (`:57-62`), `loadPlayerCampaigns` (`:64-69`), `listMyCampaignNames` (`:72-77`), `createCampaign` (`:79-89`), `joinCampaign` (`:91-101`), `awardXP` (`:103-114`), pack animal helpers (`:116-133`).

## Q6: Migration/backfill patterns

### Findings
- **`scripts/migrate-supabase-to-cosmos.ts`** — one-time Supabase→Cosmos migration; idempotent via `items.upsert` (header `:1-14`); run as `npx tsx scripts/migrate-supabase-to-cosmos.ts` with env vars (`:8-9`). No `package.json` script entry (root `package.json:5-14`, `apps/web/package.json:5-13`).
  - `main()` (`:58-226`): env validation (`:62-64`), reads 19 Postgres tables in parallel (`:76-103`), groups rows by FK via `byKey()` (`:27-34`), upserts accounts 1:1 (`:118-121`), assembles character aggregates (`:139-160`), campaign aggregates (`:162-181`), notifications (`:183-189`).
  - Reconciliation: source counts vs Cosmos counts; passes if `cosmos >= source` (`:191-219`); `process.exit(1)` on mismatch (`:216-219`).
  - Credentials never migrated: `passwordHash=null`, `requiresPasswordReset=true` (`transform.ts:47-48`).
- **`scripts/lib/transform.ts`** — pure row→doc mappers:
  - `toAccountDoc` (`:32-52`): role mapping `row.role === 'referee' ? 'referee' : 'player'` (`:36`).
  - `toCampaignDoc` (`:210-274`): `refereeId: String(row.referee_id)` (`:263`); nests sessions/rsvps, proposals/availability, partyMounts.
  - Defensive coercions on unknown enums (inventory location → `'stowed'` `:113-117`, wage_type → `'daily'` `:194`, proposal status → `'open'` `:234-238`).
- Pattern: transforms live in `scripts/lib/` as pure functions and get unit-tested directly (`apps/web/src/test/__tests__/migration-transform.test.ts:8` imports from `../../../../../scripts/lib/transform`).

## Q7: Data-layer test patterns

### Findings
- **Runner**: vitest (`apps/web/package.json:11-12`), config `apps/web/vitest.config.ts`.
- **Cosmos fake** `apps/web/src/test/cosmos-fake.ts` — swapped in via `vi.mock('@/lib/cosmos/client', ...)` (`:8-9`):
  - Per-container `Map` stores (`:14`), `store(name)` (`:24-27`), `resetFake()` (`:29-34`).
  - `partitionKeyOf()` hardcodes pks (`:36-41`): `characters`→`ownerId`, `notifications`→`accountId`, `catalog_items`→`itemType`, else `id`.
  - `runQuery()` (`:45-86`) substring-matches SQL, incl. `c.refereeId = @id` (`:66-68`), `c.inviteCode = @code` (`:69-71`), members `EXISTS` (`:72-78`).
  - Point-read respects pk (`:91-95`); `.replace()` enforces `_etag` with 412 (`:96-114`); `fakeState.failNextReplaceWith412` for conflict tests (`:19,103-107`).
- **`account.test.ts`**: `createAccount` normalization, invite-code format, displayName default, role set from input (tested with both values, `:24,33,39`), duplicate email rejection (`:30-35`); `verifyPassword` null-hash (`:44-55`); `setPassword` (`:57-67`); `fetchAccount` returns `role: 'referee'` (`:77`); `deleteAccount` cascade (`:86-98`).
- **`campaigns.test.ts`**: mocks auth session with mutable `currentAccount` (`:5-13`); seeds REFEREE/PLAYER/OUTSIDER accounts (`:5-7,38-42`). Lifecycle create→join→roster (`:50-81`); `awardXP` DM-only/never-self incl. unrelated-DM rejection (`:83-116`, exercises `isDMOfAccount`); DM character visibility (`:118-132`, exercises `canReadCharacter`); pack animals (`:134-146`); retainers+mounts (`:148-178`).
- **`migration-transform.test.ts`**: node environment (`:1`); `toAccountDoc` role passthrough (`:16,25`); `toCharacterDoc` aggregate + coercion (`:38-87`); `toCampaignDoc` with `referee_id: 'ref-1'` (`:89-116`); `toNotificationDoc` (`:118-135`).

## Cross-Cutting Observations
- Server-side authorization is entirely per-campaign already: `authz.ts` derives every DM/member predicate from `CampaignDoc.refereeId`/`members` and never reads `AccountDoc.role`. The global role's live effects are all client-side: campaign page tab/view gating, settings badge, admin table label, sign-up picker.
- `?as=referee` on `GET /api/campaigns` is client-chosen; server safely returns only campaigns where the caller is actually `refereeId`. A "player"-role account that created a campaign would already get DM data from this branch.
- `role` is validated/coerced defensively at three layers (client default, route coercion `register/route.ts:8`, data-module re-check `account.ts:109`), but written exactly once — no role-change path exists post-signup.
- `useAuthStore` (`stores/auth-store.ts`) carries role state but has zero importers — dead code.
- Naming convention: stored values/fields keep old names (`role: 'referee'`, `refereeId`, `?as=referee`) for storage compatibility while UI text says "DM"/"Dungeon Master" (comments at `cosmos/types.ts:13-14,200-201`, `authz.ts:40`).
- Optimistic-concurrency mutation pattern: `replaceCampaignWithRetry` with `_etag`/412 retry (`campaigns.ts:34-55`), simulated by the fake (`cosmos-fake.ts:96-114`).
- Data-access layering: page/component → `lib/api/*` fetch wrapper → `app/api/*` route → `lib/data/*` module → `lib/authz.ts` predicate → Cosmos container.

## Open Areas
- `DungeonMasterView` / `PlayerView` internals were not read in detail; consumers of `loadDMCampaigns()`/`loadPlayerCampaigns()` client wrappers inside those components are inferred from `OverviewTab.tsx:11-13` but not traced line-by-line.
- No runtime data was inspected — how many existing accounts hold `role: 'referee'`, or whether any referee accounts have zero campaigns, can't be answered from code.
- `packages/types/src/index.ts` `Role`/`Account` types: no importer inventory was compiled beyond the web app (grep found usage at `index.ts:45`; external consumers of the package weren't enumerated).
