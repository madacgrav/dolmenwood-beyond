# Research Findings

## Q1: Persistence layer structure end to end

### Client factories (3 contexts)
- **Browser**: `apps/web/src/lib/supabase/client.ts:3-8` — sync `createClient()` wrapping `createBrowserClient` from `@supabase/ssr`; reads `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`; cookies handled internally.
- **Server**: `apps/web/src/lib/supabase/server.ts:4-26` — async `createClient()` wrapping `createServerClient`; cookie adapters over `next/headers` `cookies()`; `setAll` swallows errors when called from Server Components (lines 14-22).
- **Service-role**: `apps/web/src/lib/supabase/service.ts:9-16` — plain `@supabase/supabase-js` `createClient` with `SUPABASE_SERVICE_ROLE_KEY`, `persistSession: false`; bypasses RLS; docstring restricts it to the notification-dispatch path. Sole consumer: `apps/web/src/app/api/notifications/drain/route.ts:21`.
- **Middleware builds its own inline `createServerClient`** (does not reuse server.ts): `apps/web/src/middleware.ts:9-28`.
- No client is parameterized with a `Database` generic anywhere — all are untyped `SupabaseClient` (see Q8).

### lib/data organization
13 modules in `apps/web/src/lib/data/` (account, bank, campaigns, characters, inventory, level-up, mounts, notifications, portraits, proposals, retainers, schedule, spells). Uniform shape:
- Plain shared TS modules — **no** `'use server'`/`'use client'` directives; every function takes an injected `supabase: SupabaseClient` as first arg, so the same functions run against browser or server clients.
- Mix of direct table access (`.from().select/insert/update/delete`) and RPC wrappers (`.rpc('award_xp')` etc.). Writes with invariants are funneled through RPCs (e.g. `bank.ts:51` → `bank_transaction`; `campaigns.ts:194-210` → `create_campaign`/`join_campaign`/`award_xp`; `proposals.ts:52` → `set_proposal_availability`; `account.ts:62` → `delete_my_account`).
- Error handling never throws; three patterns: (a) return `string | null` error message (`characters.ts:130`, `bank.ts:64`), (b) return `{ data, error }` composites (`characters.ts:84-93`, `campaigns.ts:194-200`), (c) silently swallow and return fallback `null`/`[]`/`0` (`account.ts:23-33`, `notifications.ts:13-20`, `campaigns.ts:246-251`).
- `characters.ts:21-80` holds the canonical snake_case↔camelCase row mappers (`mapCharacterRow`, `characterUpdatesToRow`), documented as the single source of truth (lines 10-17).
- 56 files import from `lib/data`; nearly all callers are `'use client'` components/hooks using the browser client (e.g. `hooks/use-characters.ts:4-19`, `app/(app)/settings/page.tsx:20-30`). The only `'use server'` file, `app/(auth)/actions.ts`, doesn't use `lib/data` at all.

### Direct DB access outside lib/data
- `app/(app)/layout.tsx:13-17` — `accounts.select('is_admin')` in the server layout.
- `app/(app)/admin/page.tsx:111-114` — `auth.getUser()` + `rpc('get_admin_data')`.
- `app/(app)/campaign/page.tsx:23` — `accounts.select('role')`.
- `components/campaign/ScheduleTab.tsx:52` — `campaigns.select('id, name')`.
- `components/campaign/BankingTab.tsx:36` — `characters.select(...)`.
- `components/character-sheet/stats/use-retainers.ts:63` — direct `characters.insert` (retainer promotion).
- `components/character-sheet/inventory/use-add-item.ts:32-34` — `catalog_items.select`.
- `app/(app)/characters/[id]/level-up-log/page.tsx:52-56` — `characters` + `level_up_logs` selects.
- ~25 files call `supabase.auth.*` directly (sign-in/up/out, reset, `getUser()` before queries) — full list in Q4.

## Q2: Complete database schema, RPCs, and triggers

### Tables (public schema; 21 tables + storage bucket)
**Accounts/auth**
- `accounts` — `20260425000001_initial_schema.sql:8-15`; `id uuid PK = auth.users(id) on delete cascade`, `email`, `role check ('player','referee')`, `display_name`, timestamps. Added later: `invite_code unique` (`20260425000004:32-50`), `is_admin` (`20260511000013:2`), `phone`/`email_opt_in`/`sms_opt_in`/`whatsapp_opt_in`/`whatsapp_consent_at` (`20260709000030:10-15`).

**Campaigns**
- `campaigns` — `20260425000001:34-40`; `referee_id FK accounts`, `invite_code unique`.
- `campaign_members` — `20260425000001:54-59`; PK `(campaign_id, account_id)`.

**Characters**
- `characters` — `20260425000001:99-121`; `owner_id FK accounts`, kindred/class/alignment CHECKs, `level 1..15`, `ability_scores jsonb`, hp, `portrait_url`. Added: `coins_gp/sp/cp` (`20260503000006:6-9`), `notes` (`20260510000010:68`), `session_notes`/`people_of_note` jsonb (`20260512000015:2-4`), `extra_languages` jsonb (`20260513000019:4-5`).
- `character_campaign_data` — `20260425000001:156-163`; PK `(character_id, campaign_id)`.
- `retainers` — `20260425000001:180-200`; `owner_character_id FK characters`, `saves jsonb`, wage fields.
- `mounts` — `20260425000001:219-235`; **polymorphic `owner_id` with no FK**, `owner_type check (character,party)`, `campaign_id FK`; `character_id FK` added `20260512000017:5-6`.
- `level_up_logs` — `20260425000001:338-347`; `changes jsonb`, hp rolls.

**Inventory (two parallel systems)**
- `inventory_items` — `20260425000001:264-281`; polymorphic `owner_type (character,retainer,mount)` + `owner_id` (no FK).
- `character_inventory` — `20260510000010:7-20`; character-only, `character_id FK`; the actively used one.
- `catalog_items` (reference data) — `20260425000002:4-17`; seeded ~90 rows there and in `seed.sql`.
- `spell_slots` — `20260425000001:313-321`; unique `(character_id, spell_rank)`; `slots_used <= slots_total` CHECK added `20260512000014:39-44`.
- `spell_preparations` — `20260511000011:17-24`.

**Banking**
- `bank_ledger` — `20260503000006:14-21`; signed `amount_gp <> 0`, `performed_by FK accounts`.

**Scheduling/proposals**
- `campaign_sessions` — `20260621000023:5-14`.
- `session_rsvps` — `20260621000023:49-55`; PK `(session_id, account_id)`; **RLS on, zero policies (RPC-only)**.
- `date_proposals` — `20260624000024:4-15`; `status check (open,confirmed,cancelled)`, `confirmed_session_id FK`.
- `proposal_availability` — `20260624000025:6-12`; PK `(proposal_id, account_id)`; **RLS on, zero policies (RPC-only)**.

**Notifications**
- `notifications` — `20260624000027:5-14`; `account_id FK`, `kind`, `body`, `read`.
- `notification_deliveries` — `20260709000031:10-20`; `channel check (email,sms,whatsapp)`, `status check (pending,sent,failed)`, unique `(notification_id, channel)`; **RLS on, zero policies (service-role only)**; comment at lines 8-9 explicitly states dispatch is app code, not triggers, because of the migration off Supabase.

### RPC functions (all SECURITY DEFINER unless noted; final versions listed)
- `handle_new_user()` — trigger fn; creates `accounts` row from `auth.users` insert with role/display_name from `raw_user_meta_data` + invite code — final version `20260425000004:53-66`.
- `handle_updated_at()` — `updated_at` trigger fn — `20260425000001:366-372` (not definer).
- `generate_invite_code()` / `generate_account_invite_code()` — random 6-char codes with uniqueness retry — `20260606000021:6-31`, `20260425000004:4-29`.
- `is_campaign_member` / `is_campaign_referee` — RLS helpers — `20260425000005:14-41`.
- `is_account_in_my_campaign` / `..._as_referee` — RLS helpers for accounts visibility — `20260503000007:7-36`.
- `create_campaign(p_name)` → uuid — `20260503000007:56-72`.
- `join_campaign(p_invite_code)` → json (raises on invalid/already-member) — final `20260512000014:99-137`.
- `award_xp(character, gain)` — referee-only, not self, atomic increment — `20260508000008:9-47`.
- `level_up(character, new_level, hp_gain, hp_roll, changes, xp_threshold)` — owner-scoped, monotonic level check, updates char + inserts `level_up_logs` in one txn — `20260509000009:15-88`.
- `get_admin_data()` → json — `is_admin` gate, full account/character/campaign dump + stats — `20260511000013:24-73`.
- `get_campaign_party_data(campaign)` → json — member-gated cross-player character visibility — `20260512000014:143-188`.
- `delete_my_account()` — deletes own `auth.users` row, cascades everything — `20260513000020:6-18`.
- `bank_transaction(character, amount_gp, description)` — row lock, owner-or-referee deposits, referee-only payouts, balance checks, ledger insert + purse update atomically — `20260612000022:20-94`.
- `get_campaign_schedule` / `set_session_rsvp` — sole access path to `session_rsvps` — `20260621000023:64-136`.
- `get_campaign_proposals` — final `20260624000028:128-179` (availability scoped to current participants).
- `set_proposal_availability` — final `20260624000028:41-125`; upserts availability, auto-confirms when all participants approve (race-safe status claim), creates `campaign_sessions` row, fans out one `notifications` row per participant, sets GUC `app.confirming_proposal` to pass the guard trigger.
- `set_admin_on_signup()` — neutered to no-op `20260512000014:24-34` (trigger still attached).

### Triggers
- `on_auth_user_created` AFTER INSERT on `auth.users` → `handle_new_user()` — `20260425000001:395-397`. **The only auth.users↔accounts link mechanism.**
- `set_updated_at` BEFORE UPDATE on `characters` (`20260425000001:374`), `campaign_sessions` (`20260621000023:18`), `session_rsvps` (`:57`), `date_proposals` (`20260624000024:19`), `proposal_availability` (`20260624000025:14`).
- `tr_set_admin_on_signup` BEFORE INSERT on `accounts` — `20260511000013:16-18` (no-op body).
- `guard_date_proposal_update` BEFORE UPDATE on `date_proposals` — `20260624000028:15-37`; blocks client changes to `status`/`confirmed_session_id` unless GUC `app.confirming_proposal='on'`; unconditionally blocks `campaign_id`/`created_by` changes.

## Q3: RLS authorization

RLS enabled on all 21 public tables (locations in Q2 agent inventory; e.g. `20260425000001:17,42,61,125,165,204,237,285,323,351`). Three access patterns:

**1. Direct policies** (predicate → dependency):
- `accounts`: own-row select/update/insert on `auth.uid() = id` (`20260425000001:19-29`); update `with check` pins `is_admin` to its prior value to block self-escalation (`20260512000014:9-18`); cross-visibility via `is_account_in_my_campaign[_as_referee]()` (`20260503000007:39-48`).
- `campaigns`: referee ALL on `auth.uid() = referee_id` (`20260425000001:44-46`); member SELECT via `is_campaign_member(id)` (`20260425000005:51-53`).
- `campaign_members`: own-row select/insert/delete on `account_id = auth.uid()` (`20260425000001:63-83`); referee SELECT via `is_campaign_referee` (`20260425000005:56-58`).
- `characters`: owner ALL (`20260425000001:127-129`); campaign-member and referee SELECT via helper-fn subqueries over `campaign_members` (`20260425000005:61-79`).
- `retainers`, `spell_slots`, `spell_preparations`, `character_inventory`, `character_campaign_data`, `level_up_logs`: owner-of-linked-character ALL via `exists(select from characters where owner_id = auth.uid())`; referee SELECT policies added in `20260512000017:31-97` and `20260510000010:51-63`. `level_up_logs` INSERT additionally enforces `to_level = from_level + 1` (`20260508000008:65-76`).
- `mounts`: character-owned ALL; party mounts member-managed via `is_campaign_member(campaign_id)` (`20260425000005:82-91`); referee SELECT (`20260512000017:9-28`).
- `bank_ledger`: owner SELECT + positive-amount owner INSERT; referee SELECT/INSERT gated on `accounts.role = 'referee'` (global role, not campaign-scoped) (`20260503000006:28-72`).
- `catalog_items`: `to authenticated using (true)` (`20260425000002:21-24`).
- `campaign_sessions`, `date_proposals`: participant SELECT/INSERT (`member or referee` + `created_by = auth.uid()`), creator-or-referee UPDATE/DELETE (`20260621000023:25-45`, `20260624000024:25-42`).
- `notifications`: own-row SELECT/UPDATE on `account_id = auth.uid()` (`20260624000027:20-26`).
- `storage.objects` (portraits bucket): authenticated SELECT; insert/update/delete require first path segment = `auth.uid()` (`20260512000018:15-42`).

**2. RLS-on-zero-policies tables** — `session_rsvps`, `proposal_availability`, `notification_deliveries`: no client access at all; SECURITY DEFINER RPCs (or service-role client) are the only path.

**3. RPC-embedded authorization** — `award_xp`, `bank_transaction`, `level_up`, `get_admin_data`, `get_campaign_party_data`, `join_campaign`, `delete_my_account` re-implement auth checks procedurally (referee-of-campaign, is_admin, ownership). All RPCs have `revoke from public / grant to authenticated` (`20260512000014:194-197`).

**Helper functions** exist specifically to break RLS recursion (`campaigns`↔`campaign_members` policy loop, documented at `20260425000005:1-11`): `is_campaign_member`, `is_campaign_referee` (`:14-41`), `is_account_in_my_campaign[_as_referee]` (`20260503000007:7-36`) — all `security definer, stable`.

## Q4: Authentication and identity flow

- **Middleware** `apps/web/src/middleware.ts:1-47`: runs on all non-static routes; inline `createServerClient` with request/response cookie adapters (9-28); `auth.getUser()` at line 30 refreshes tokens; unauthenticated → `/sign-in`, authenticated on public route → `/characters`. `PUBLIC_ROUTES = ['/sign-in','/sign-up','/auth/callback','/forgot-password']` (line 4). **Note: matcher excludes `api/`**, so API routes rely on their own checks.
- **Email/password**: client-side pages call `supabase.auth.signInWithPassword` (`app/(auth)/sign-in/page.tsx:20`) and `signUp` with `options.data = { role, display_name }` (`sign-up/page.tsx:30-37`). Password reset: `resetPasswordForEmail` (`forgot-password/page.tsx:18-20`, `settings/components/ProfileSection.tsx:45-51`).
- **OAuth**: `signInWithGoogle` exists in the `'use server'` file `app/(auth)/actions.ts:51-67`, and Google is configured in `supabase/config.toml:45-48`, but **no page imports any of the four server actions** — the whole `actions.ts` file is dead code; no Google button exists in the UI.
- **Callback**: `app/auth/callback/route.ts:15` — `exchangeCodeForSession(code)`; `type=recovery` → `/reset-password`; sanitizes `next` against `//`.
- **auth.users → accounts**: DB trigger `on_auth_user_created` → `handle_new_user()` inserts `accounts` row with `id = new.id` (shared PK/FK, `accounts.id = auth.uid()`), role/display_name from `raw_user_meta_data`, generated invite code (`20260425000001:381-397`, final `20260425000004:53-66`). No application code creates accounts.
- **Current-user resolution**: no React context/provider exists (zero matches for AccountProvider/useAccount). Server pattern: `await createClient()` then `auth.getUser()` (`app/(app)/layout.tsx:8-18`, `admin/page.tsx:108-114`). Client pattern: `useMemo(() => createClient(), [])` + `auth.getUser()` in `useEffect`, then pass `user.id` into `lib/data` functions (`settings/page.tsx:20-38` and ~15 other files, e.g. `campaign/page.tsx:20`, `characters/[id]/view/page.tsx:36`, `use-retainers.ts:57`, `use-portrait-upload.ts:41`). Account row is prop-drilled, not shared state. There is also a `stores/auth-store.ts:2-5` holding a Supabase `User | null`.

## Q5: Supabase platform features beyond the database

- **Storage**: single public bucket `portraits` (`20260512000016:5-7`); path-owned RLS (`20260512000018:15-42`). Only consumer: `lib/data/portraits.ts:20-39` — upload to `${userId}/${characterId}/${ts}.${ext}`, `getPublicUrl`, then write URL to `characters.portrait_url` (fire-and-forget). No other storage usage in the app.
- **Realtime**: exactly one subscription — `hooks/use-characters.ts:32-41`, `postgres_changes` on `characters` (all events) → refetch; purpose per comment: live HP updates during play.
- **Edge Functions**: none (no `supabase/functions/` dir, no `.invoke()` calls anywhere).
- **Auth emails**: Supabase-hosted; `config.toml:40-43` — signup confirmations disabled (`enable_confirmations = false`), `double_confirm_changes = true`; no custom SMTP. Local dev uses Inbucket (`config.toml:20-22`). Password-reset emails flow through Supabase auth.
- **Outbound notification email is NOT Supabase**: Resend via `lib/notifications/channels/email.ts:1-12` (`RESEND_API_KEY`/`RESEND_FROM`); outbox pattern in `lib/notifications/dispatch.ts:28-88` (enqueue from `notifications` → `notification_deliveries`, send pending, only email channel implemented); triggered by `/api/notifications/drain` route guarded by `x-drain-secret` (`route.ts:14-21`); scheduled by GitHub Actions cron every 5 min (`.github/workflows/notifications-drain.yml:15-29`), documented as the pre-Cosmos trigger mechanism (lines 7-9).
- **No** pg_cron, vault, database webhooks, or pg_net anywhere in config.toml or migrations.

## Q6: Schema/migration/seed lifecycle and export tooling

- **Mechanism**: Supabase CLI file-based migrations, `supabase/migrations/YYYYMMDDHHMMSS_desc.sql`, 30 files (2026-04-25 → 2026-07-09). `docs/database.md:9-30` is the up-to-date migration index (`supabase/README.md:12-17` is stale). Rule: never edit an applied migration, add a new one (`docs/development.md:159`).
- **Local**: `npx supabase start` + `npx supabase db reset` (replays migrations + seed) (`docs/development.md:26-34`). New migration: `npx supabase migration new <name>` (`docs/development.md:152-154`). Type gen documented as `supabase gen types typescript --local > packages/types/src/supabase.ts` (`docs/database.md:358`) but **that file does not exist** — types are hand-written (Q8).
- **Seed**: `supabase/seed.sql` seeds only the `catalog_items` equipment catalog (~90 rows, lines 8-145); applied implicitly by `db reset` (no `[db.seed]` in config.toml).
- **docker-compose path**: `docker-compose.yml:38-53` runs plain `postgres:15-alpine` (not the Supabase stack), mounting `supabase/migrations` into `/docker-entrypoint-initdb.d` (line 48) — first-boot-only application, seed.sql not mounted.
- **CI**: `ci.yml` never touches a DB. Production migrations run only in `deploy-azure.yml`'s `run-migrations` job (`:144-160`): `supabase db push --db-url "${{ secrets.SUPABASE_DB_URL }}"` (Supavisor IPv4 session-mode pooler URL per `docs/deployment.md:73-76`), in parallel with the image build; `deploy-app` waits on both (`:162-165`).
- **Bulk export tooling: none exists.** No pg_dump/db dump/COPY/export scripts anywhere (`scripts/` has only `screenshot.mjs`). The closest thing is a user-facing export query `fetchCharactersForExport` (`lib/data/account.ts:67-75`) selecting `characters` with nested `character_inventory`, `spell_slots`, `spell_preparations`.

## Q7: Build, deploy, configuration

- **Pipeline** (`.github/workflows/deploy-azure.yml`): push to main → `ci` (reusable `ci.yml`: lint/typecheck/test/build) → `deploy-infra` (Bicep deploy of `infra/azure/main.bicep`) → `build-and-push` (Docker buildx → ACR `dolmenwoodprodacr`, tags sha+latest, build-args = the two public Supabase vars, `:101-142`) ∥ `run-migrations` → `deploy-app` (`az webapp config container set`, managed-identity ACR pull, restart, health-check loop on `/api/health`, `:162-205`). PRs touching `infra/**` get a Bicep what-if (`:39-63`).
- **Docker**: `apps/web/Dockerfile` multi-stage (deps → builder → runner), node:22-alpine, Next standalone output (`BUILD_STANDALONE=true` → `next.config.ts:6`), non-root, dumb-init. Only the two `NEXT_PUBLIC_*` vars are baked at build; all server secrets are runtime-injected. `docker-compose.yml:4-34` runs the `builder` stage with `pnpm dev` + bind mounts for local dev.
- **Azure resources** (`infra/azure/main.bicep` + modules): Log Analytics + App Insights (`modules/monitoring.bicep`), ACR (admin disabled, RBAC pull), Linux App Service Plan B2 + Web App for Containers with system-assigned identity (`modules/app-service.bicep:49-131`), Key Vault (RBAC, soft-delete) with `Key Vault Secrets User` granted to the web app (`modules/key-vault.bicep:36-44`). OIDC federated credentials for GitHub Actions set up by `infra/azure/scripts/setup-oidc.sh`.
- **Secrets threading**: local `.env.local` (from `apps/web/.env.local.example`) → GitHub secrets/vars (documented in `GITHUB_SECRETS.md`) → CI (public vars as build-args; `SUPABASE_DB_URL`/`SUPABASE_ACCESS_TOKEN` used directly by the migrations job, bypassing Azure) → App Service app settings, where 8 settings are Key Vault references (`app-service.bicep:84-115`: `supabase-anon-key`, `supabase-service-role-key`, `wordpress-*` ×3, `resend-api-key`, `resend-from`, `notifications-drain-secret`) populated out-of-band via `az keyvault secret set` (`infra/azure/README.md:61-72`), resolved at runtime by managed identity.
- **App env-var inventory**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_WORDPRESS_URL`, `NEXT_PUBLIC_APP_URL`, `RESEND_API_KEY`, `RESEND_FROM`, `NOTIFICATIONS_DRAIN_SECRET`, `BUILD_STANDALONE`, `NODE_ENV` (usage locations: `middleware.ts:10-11`, `lib/supabase/*.ts`, `lib/wordpress.ts:1`, `(auth)/actions.ts:56`, `channels/email.ts:4-5`, `drain/route.ts:14`, `next.config.ts:6,15`).
- **Discrepancies noted**: `GITHUB_SECRETS.md:46-49` lists `SUPABASE_DB_URL` as a variable but the workflow reads `secrets.SUPABASE_DB_URL` (`deploy-azure.yml:158`); compiled `modules/app-service.json` lags the .bicep (missing RESEND/drain settings); `WORDPRESS_API_URL/USERNAME/APP_PASSWORD` are provisioned in Key Vault but never read by current app code.

## Q8: Domain types and Supabase coupling

- **`packages/types`** (`@dolmenwood/types`): one hand-written file, `packages/types/src/index.ts` — unions (`Role`, `Kindred`, `CharacterClass`, `Alignment`, `SpellRank`, …, lines 3-21) and camelCase domain interfaces (`Account` :40-45, `Campaign`/`CampaignMember` :47-59, `Character` :61-84, `Retainer` :106-124, `Mount` :126-140, `InventoryItem` :142-157, `SpellSlot` :159-165, `LevelUpLog` :167-182, `DerivedStats` :185-224, `CharacterWithNotes` :231-235). **No generated Supabase `Database` type exists anywhere** — the codegen command is documented (`docs/database.md:358`) but never ran/committed.
- **Web app consumption**: 33 files `import type` from `@dolmenwood/types` (wizard, character sheet, character pages, `lib/data/characters.ts:2-8`). Supabase clients are untyped, so query results are cast: `data as CharacterRow` (`characters.ts:105`), `data as Account` (`account.ts:32`), `as unknown as EnqueueRow[]` (`dispatch.ts:34`).
- **Parallel row-shaped local types**: several `lib/data` modules define their own snake_case interfaces mirroring tables instead of using `@dolmenwood/types` — notably a second, differently-shaped `Account` in `lib/data/account.ts:12-21`, `LedgerRow` (`bank.ts:13-20`), campaign shapes (`campaigns.ts:11-55`), `AppNotification` (`notifications.ts:3-10`), `EnqueueRow`/`PendingRow` (`dispatch.ts:15-25`).
- **Rules engine** (`packages/rules-engine`): declares `@dolmenwood/types` as a dependency (`package.json:12-14`) but **imports nothing from it** — it defines its own vocabulary (`ClassName`, `ACInputs`, `KindredName`, `SpellSlotRow`, …) and takes plain `string`/`number` args. Zero Supabase references; fully persistence-agnostic.
- **Coupling points to Supabase**: (1) `SupabaseClient` parameter type in all 13 `lib/data` modules + ~12 components/hooks (e.g. `characters.ts:1`, `NotificationsSection.tsx:4`, `use-retainers.ts:3`); (2) Supabase `User` type in `stores/auth-store.ts:2-5`; (3) `{ data, error }` result-shape reliance everywhere (no `PostgrestError` imports); (4) named RPC strings embedded in app code (`account.ts:62`, `bank.ts:51`, `campaigns.ts:194-210`, `proposals.ts:25-52`); (5) the three client factories hard-coding Supabase constructors/env vars; (6) PostgREST embedded-join select strings (`account.ts:70-72`, `campaigns.ts:95`, `dispatch.ts:32,59`).

## Cross-Cutting Observations

- **Business logic is split three ways**: RLS policies (read visibility), SECURITY DEFINER RPCs (all multi-step/invariant-bearing writes: XP, level-up, banking, join, proposal confirm + notification fan-out), and app code (notification dispatch). The proposal-confirm flow is the deepest Postgres-embedded logic: RPC + GUC-gated trigger + notification inserts (`20260624000026`–`028`).
- **Recent code already anticipates the migration**: `notification_deliveries` is deliberately trigger-free with dispatch in portable app code (`20260709000031:8-9`); the drain cron workflow self-describes as "the pre-Cosmos trigger mechanism" (`notifications-drain.yml:7-9`).
- **The dependency-injection pattern (`SupabaseClient` as first arg) is uniform** across `lib/data`, making the data layer's call sites consistent, but callers are overwhelmingly client components issuing queries directly from the browser — authorization depends on RLS, not on a server boundary.
- **Three tables are invisible to clients** (`session_rsvps`, `proposal_availability`, `notification_deliveries`) — reachable only through RPCs/service role.
- **Polymorphic FKs**: `mounts.owner_id`, `inventory_items.owner_id`, `*.catalog_item_id` have no FK constraints; integrity enforced only by RLS subqueries/app code.
- **Two inventory systems coexist** (`inventory_items` polymorphic vs `character_inventory` character-scoped); both have live RLS policies.
- **Dead/vestigial pieces**: `app/(auth)/actions.ts` server actions (incl. Google OAuth) unused by any page; `tr_set_admin_on_signup` trigger attached to a no-op function; `WORDPRESS_*` Key Vault secrets unread by app code; `supabase/README.md` migration list stale.

## Open Areas

- **Production data volume/row counts** cannot be determined from the codebase (relevant to any bulk-export answer for Q6 — no tooling exists and nothing indicates scale).
- **Whether Supabase auth password-reset emails are actively delivered in production** (custom SMTP vs Supabase default) is not visible in the repo; `config.toml` governs local only (`docs/deployment.md:65` notes cloud auth settings are set manually in the dashboard).
- **The exact set of GitHub repo secrets/vars actually configured** can't be verified from the repo; `GITHUB_SECRETS.md` has at least one documented-vs-actual mismatch (`SUPABASE_DB_URL` var vs secret).
