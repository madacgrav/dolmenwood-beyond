# Design Discussion

## Current State

- **The only notification event is DB-internal.** `set_proposal_availability` (a Postgres SECURITY DEFINER RPC, final version `supabase/migrations/20260624000028_proposal_guards.sql:41-125`) fans out one `notifications` row per participant (`kind='date_confirmed'`) when a proposal flips `open → confirmed` (`:114-121`). It is called from the browser via `setAvailability` (`apps/web/src/lib/data/proposals.ts:52-59`). **No server-side code observes this event.**
- **No outbound infrastructure exists** — no SendGrid/Resend/Twilio/SMTP dependency; the only emails today are Supabase Auth's own hosted messages (research Q5).
- **No server-side execution surface fires on DB changes** — two route handlers (health, auth callback), one auth server-actions file, middleware; **no cron, queue, edge function, webhook, or Realtime** (research Q2). Every Supabase client uses the anon key; **the service-role key is provisioned via Key Vault but read by nothing** (research Q2/Q4).
- **Contact data:** `accounts.email` only; **no `phone` column** in schema or UI (research Q3). Email is view-only in settings; `updateDisplayName` is the only account writer (`apps/web/src/lib/data/account.ts:31-41`).
- **No DB-backed preferences.** All settings (rules, theme, offline) are per-browser `localStorage` (research Q6) — unusable by server-side send code.
- **`notifications` table** (`supabase/migrations/20260624000027_notifications.sql:5-14`) is a plain table (portable to a Cosmos container); RLS scopes reads to `account_id = auth.uid()`.
- **Constraint:** the project will migrate off Supabase to Azure Cosmos DB (`task.md`, [[supabase-to-cosmos-migration-planned]]). No new Postgres triggers / SECURITY DEFINER RPCs / Supabase Edge Functions / Database Webhooks / Realtime as load-bearing mechanisms.
- **Provider decision (task.md):** Resend for email; Twilio for WhatsApp + SMS.

## Desired End State

When a proposal is confirmed, participants who have opted in receive an **outbound** notification (email now; WhatsApp/SMS later) in addition to the in-app bell. Delivery is queued to a portable outbox and sent by app-level code with no dependency on Supabase-specific features.

**Verify:** confirm a proposal → a `notification_deliveries` row is created per opted-in recipient/channel → the drainer sends via Resend → recipient receives the email → the delivery row shows `sent`. A recipient with email opt-in off receives nothing. Re-running the drainer does not double-send.

## Patterns to Follow

- **Secret delivery:** Key Vault → App Service app-setting reference → managed identity → `process.env` (server-only, non-`NEXT_PUBLIC_`). Established for `SUPABASE_SERVICE_ROLE_KEY` at `infra/azure/modules/app-service.bicep:88-91`; `RESEND_API_KEY` / `TWILIO_*` follow the same path.
- **`lib/data` module shape** — thin typed functions taking a Supabase client (`apps/web/src/lib/data/account.ts`, `notifications.ts:13-27`). New data access (deliveries, contact/prefs) follows this.
- **Settings section component** — self-contained section like `OptionalRulesSection.tsx` / `ProfileSection.tsx`, added to `apps/web/src/app/(app)/settings/page.tsx:45-58`. New `NotificationsSection` follows this for phone + opt-in toggles.
- **Scheduled workflow** — GitHub Actions cron already used by `blog-session.yml`; the drainer schedule mirrors it.
- **Migration file convention** — `YYYYMMDD` + 5-digit sequence (next after `...029_campaign_roster.sql`).

**Do NOT follow / avoid:**
- Do **not** hang outbound sending off the Postgres RPC, a new DB trigger, a Supabase Edge Function, Database Webhook, or Realtime (migration constraint).
- Do **not** store notification preferences in `localStorage` (server-side send code can't read it) — unlike existing settings.

## Design Decisions

1. **Trigger = outbox + decoupled dispatch, scheduled-drained now, Cosmos-Change-Feed later.** A `notification_deliveries` outbox row is enqueued per recipient/channel. A **dispatch module** (`apps/web/src/lib/notifications/dispatch.ts`) reads pending rows, calls the provider, marks `sent`/`failed` — it holds all send logic and is trigger-agnostic. Invoked now by a **GitHub Actions cron** hitting a secret-protected route `POST /api/notifications/drain`. After the Cosmos migration, an **Azure Function bound to the Cosmos change feed** on the deliveries container calls the same module — only the trigger swaps. Chosen because Change Feed is the Azure-native, migration-safe equivalent of a webhook, and decoupling trigger from send logic lets it swap without touching provider code.
2. **Separate `notification_deliveries` table**, keyed by `(notification_id, channel)`, with `status` (`pending`/`sent`/`failed`), `sent_at`, `error`, `attempts`. Models per-channel status independently and migrates/replaces cleanly.
3. **Contact + preferences as columns on `accounts`:** `phone text`, `email_opt_in boolean`, `sms_opt_in boolean`, `whatsapp_opt_in boolean`, `whatsapp_consent_at timestamptz`. Matches the flat account-fields pattern; simplest to migrate.
4. **Channels: Resend email wired end-to-end now; Twilio WhatsApp/SMS deferred.** Build the full contact/prefs + outbox + dispatch infra now; implement only the email channel in the dispatch module. WhatsApp/SMS are a follow-up (Meta/Twilio onboarding lead time per `provider-research.md`); their opt-in flags and columns exist but the dispatch branches are stubbed.
5. **First service-role server client, for the dispatch path only.** The drain route reads other participants' contact info + opt-ins and writes delivery status, which RLS (`account_id = auth.uid()`) forbids for a normal session client. Introduce a server-only service-role client used solely by dispatch. This is plain data access (portable to Cosmos), not a Supabase-coupled trigger. The drain route is authenticated by a shared secret header (Key Vault), not a user session.
6. **Opt-in defaults:** `email_opt_in` defaults **on** for existing/new users (they provided email at signup; transactional to your own users). `sms_opt_in` / `whatsapp_opt_in` default **off** — WhatsApp/SMS require explicit consent (`whatsapp_consent_at` recorded when enabled).
7. **Enqueue at the app layer, not the RPC.** Because the confirm currently happens inside the RPC, the app enqueues deliveries by reading the `notifications` table (the portable record of what happened): the drainer finds `notifications` rows lacking a corresponding `notification_deliveries` row for each opted-in recipient/channel and creates + sends them. This keeps enqueue logic out of Postgres and reuses the existing (migration-bound) notifications table as the source of truth.

## What We're NOT Doing

- No Twilio WhatsApp/SMS sending in this effort (columns/flags only); no Meta/Twilio onboarding.
- No changes to the in-app `notifications` insert, the RPC, or the auto-confirm logic.
- No new notification *events* — only `kind='date_confirmed'` is dispatched; the dispatch module is generic over `kind` for future events.
- No realtime/live UI for delivery status; no per-notification user-facing send log.
- No Azure Function yet — the Cosmos change-feed trigger is designed for but implemented only after the migration.
- No migration of existing data; no phone backfill.

## Open Risks

- **Enqueue idempotency.** The "notifications without a delivery row" query plus a unique `(notification_id, channel)` constraint must prevent double-send if the drainer overlaps or retries. Needs careful transaction/upsert handling.
- **Drainer auth + exposure.** `/api/notifications/drain` is a new unauthenticated-by-session endpoint; the shared-secret check and Key Vault storage must be correct, and the route excluded appropriately from middleware (`api/` is already excluded, `middleware.ts:45-47`).
- **Resend domain verification.** Sending requires SPF/DKIM on a real domain; until verified, only test addresses work. First-run setup step, not code.
- **Cron latency vs. reliability.** A few minutes' delay is acceptable; a failed cron run silently delays sends — the drainer should be safe to run frequently and log outcomes.
- **`NEXT_PUBLIC_APP_URL` ambiguity** (research open area) — email links need a correct absolute base URL in production; confirm the prod value before relying on it.
- **Cosmos data model** for `notification_deliveries` when the migration happens (partition key choice) is out of scope here but should be anticipated so the table shape ports cleanly.
