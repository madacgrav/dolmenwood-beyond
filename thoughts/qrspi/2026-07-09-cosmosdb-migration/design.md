# Design Discussion — Supabase → Azure Cosmos DB Migration

## Current State

Persistence, identity, authorization, storage, and one realtime feature all run on Supabase (research Q1–Q5):

- **Data access**: 3 Supabase client factories (`lib/supabase/{client,server,service}.ts`) feed 13 `lib/data/*` modules that take an injected `SupabaseClient` (research Q1). ~56 files consume them; **most are `'use client'` components querying the browser client directly**, plus ~10 direct `.from()`/`.rpc()` sites outside `lib/data` (research Q1). This is only safe because RLS scopes every row.
- **Schema**: 21 relational tables, ~20 SECURITY DEFINER RPC functions, 8 triggers (research Q2). Real logic lives in Postgres: `award_xp`, `level_up`, `bank_transaction`, and the proposal auto-confirm + notification fan-out chain (`20260624000026`–`028`).
- **Authorization**: RLS on all tables, three patterns — direct policies, RPC-only tables (`session_rsvps`, `proposal_availability`, `notification_deliveries`), and auth checks embedded in RPCs; recursion-breaking helpers `is_campaign_member`/`is_campaign_referee` (research Q3).
- **Auth/identity**: Supabase Auth, email/password only (Google OAuth in `actions.ts` is dead code). `accounts.id = auth.uid()`; account rows created by trigger `handle_new_user()` (research Q4). No React auth context — every component calls `auth.getUser()` itself.
- **Platform extras**: one `portraits` storage bucket (`lib/data/portraits.ts`); one realtime subscription for live HP (`hooks/use-characters.ts:32-41`); notification email already Supabase-independent (Resend outbox + GitHub Actions cron, research Q5).
- **Types**: hand-written `@dolmenwood/types` (no generated `Database` type); rules engine is fully persistence-agnostic (research Q8).
- **Infra/CI**: Docker → Azure App Service, ACR, Key Vault; `deploy-azure.yml` runs `supabase db push` for migrations (research Q6/Q7).

## Desired End State

Zero Supabase dependency. Verify by:
- `grep -r "@supabase"` returns nothing in `apps/web/src`; no `NEXT_PUBLIC_SUPABASE_*`/`SUPABASE_SERVICE_ROLE_KEY` reads remain.
- All flows work end-to-end: signup/login/password-reset, character CRUD + inventory + banking + level-up, campaign join, scheduling/proposals + notifications, portrait upload, admin dashboard, live HP during play.
- A one-time Node/TS script exports prod Supabase data and imports it into Cosmos; row/document counts reconcile per entity.
- Bicep provisions Cosmos (NoSQL), Blob Storage, Azure SignalR, and a change-feed Function; `deploy-azure.yml` no longer runs `supabase db push`.

## Target Architecture

- **Cosmos DB for NoSQL (Core)**, account-partitioned aggregates:
  - `accounts` (pk `/id`): profile, notification prefs, invite code, `isAdmin`, credential hash.
  - `characters` (pk `/ownerId`): the character aggregate — embeds inventory, spell slots + preparations, level-up logs, coins, notes/session-notes/people-of-note, owned retainers, character-owned mounts, and the bank ledger as a sub-array. Keeps `level_up`/`bank_transaction`/character edits **single-partition** (fits app-layer transactions).
  - `campaigns` (pk `/id`): members, party mounts, sessions, date proposals + availability.
  - `notifications` (pk `/accountId`): notifications with delivery rows embedded (replaces `notifications` + `notification_deliveries`).
  - `catalog_items` (pk `/itemType`): reference data, seeded once.
- **Auth.js (NextAuth)** with a Credentials provider + Cosmos-backed users; JWT session cookies. Middleware validates the Auth.js session (replaces `middleware.ts:30` Supabase check). Account provisioning (invite code, default role) moves from the DB trigger into the Auth.js sign-up path.
- **Server-side data tier**: `lib/data/*` rewritten to run server-only against a Cosmos container client, each function enforcing ownership/membership in code (the app-level port of RLS predicates + RPC auth checks). Client components call these via API routes / Server Actions — never the DB directly.
- **App-layer transactions**: each RPC becomes a server function using Cosmos transactional batch (single logical partition) or ETag optimistic concurrency. Cross-account fan-out (proposal-confirm notifications) is best-effort + idempotent, not atomic.
- **Blob Storage** for portraits (`{accountId}/{characterId}/...` path, upload via server route). **Change feed → Azure SignalR** for live HP.

## Patterns to Follow

- **Dependency-injection shape of `lib/data`** (research Q1): keep one function per operation, but inject a Cosmos container/client instead of `SupabaseClient`, and make the modules server-only.
- **Single-source-of-truth mapper** — `lib/data/characters.ts:21-80` centralizes row↔domain mapping. Replicate as document↔domain mappers so snake_case/persistence shape never leaks into `@dolmenwood/types`.
- **Persistence-agnostic domain types + rules engine** (research Q8): `@dolmenwood/types` and `packages/rules-engine` stay untouched and must not import Cosmos SDK types.
- **Ported authz helpers**: reproduce `is_campaign_member`/`is_campaign_referee` (research Q3) as shared TS predicates the data tier calls, mirroring the RPC checks in `award_xp`/`bank_transaction`.
- **Outbox + idempotent delivery** (research Q5): the Resend dispatch (`lib/notifications/dispatch.ts`) is already Supabase-independent — keep it, repoint reads/writes to the Cosmos `notifications` container, preserve the `(notification_id, channel)` idempotency as a unique delivery key.

### Patterns to NOT follow
- **Direct browser DB access** (research Q1, ~56 client callers + direct `.from()` sites): must not survive — Cosmos keys can't reach the browser. All access goes server-side.
- **Silent error-swallowing** returning `null`/`[]`/`0` (research Q1, e.g. `account.ts:23-33`, `campaigns.ts:246-251`): the server tier should surface failures, not hide them.
- **Two parallel inventory systems** (`inventory_items` vs `character_inventory`, research Q2): collapse to the single embedded inventory in the character aggregate.
- **Dead/vestigial code**: don't port `actions.ts` Google OAuth, the no-op `set_admin_on_signup` trigger, or the unread `WORDPRESS_*` settings (research Q4/Q7).

## Design Decisions

1. **Cosmos DB for NoSQL (Core)** — flagship document API; accept full data-model redesign over preserving SQL/RLS/RPCs.
2. **Auth.js self-hosted (Credentials)** — keep email/password UX in-app, no new managed identity service; reset emails via existing Resend.
3. **Server-side data tier with per-request authz** — the app becomes the authorization boundary that RLS used to be; touches all client call sites but keeps logic in testable TS.
4. **App-layer transactions** — Cosmos transactional batch / ETags in the data tier; no JS-in-DB stored procedures.
5. **Account-partitioned aggregates** — `/ownerId` on characters keeps per-character transactions single-partition; party/referee views accept cross-partition point-read fan-out.
6. **Blob Storage for portraits; change feed → Azure SignalR for live HP** — Azure-native replacements preserving both features.
7. **One-time Node/TS migration script** in `scripts/` — reads Supabase via `pg`/service client, writes via `@azure/cosmos`, idempotent upserts by id.
8. **Forced password reset at cutover** — password hashes are NOT migrated from `auth.users`; migrated accounts carry a `requiresPasswordReset` flag and set a new password via the Resend reset flow. Avoids any dependency on Supabase's hash format.

## What We're NOT Doing

- Not keeping Supabase for anything (auth, storage, data) — full cutover.
- Not preserving RLS, PostgREST auto-API, or Postgres RPC functions.
- Not building a reusable migration framework — a single throwaway script.
- Not changing `@dolmenwood/types`, the rules engine, UI/UX, or the Resend notification model.
- Not adding Google OAuth or any auth method beyond current email/password.
- Not configuring Cosmos multi-region/global distribution — single region to match today.

## Open Risks

- **Cross-partition fan-out**: proposal-confirm writes notifications to multiple accounts (different partitions) — not atomic. Rely on idempotent delivery keys and best-effort retry (matches current outbox spirit).
- **Unknown data volume** (research Open Areas): RU sizing and migration batching are unsized; no existing export tooling to lean on.
- **Cost**: Cosmos + SignalR + Blob + Function add Azure spend versus the current low-cost Supabase tier.
- **Session cutover**: existing Supabase sessions invalidate at switch; all users re-authenticate.
- **Provisioning parity**: invite-code generation and admin bootstrap previously lived in DB triggers/RPCs — must be reproduced in app code without regression.
- **Change-feed → SignalR** is net-new infrastructure supporting a single feature; weigh its failure modes.
