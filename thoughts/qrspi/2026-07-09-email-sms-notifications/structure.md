# Structure Outline

## Approach

Build the outbound-notification pipeline as three vertical slices that converge on the design's "outbox + decoupled dispatch, trigger-swappable" shape. Phase 1 delivers user-facing contact/preference capture (schema → data layer → settings UI) — independently valuable with no sending. Phase 2 delivers the core send pipeline (deliveries outbox → dispatch module → Resend email → secret-protected drain route), testable by calling the route directly. Phase 3 automates it with a scheduled drainer and wires the production secrets. All send logic lives in a trigger-agnostic dispatch module so the cron trigger can later be replaced by a Cosmos Change Feed + Azure Function without touching provider code.

Verification commands (repo root): `supabase db reset`; `pnpm --filter @dolmenwood/web typecheck|test|lint`; dev server + `curl` for the drain route.

---

## Phase 1: Contact info + notification preferences

User can set a phone number and per-channel opt-ins in settings, persisted to the DB (server-readable, unlike existing localStorage prefs). No sending yet.

**Files**:
- `supabase/migrations/20260709000030_notification_contact_prefs.sql` — new
- `apps/web/src/lib/data/account.ts` — extend `Account`, add prefs writer
- `apps/web/src/app/(app)/settings/components/NotificationsSection.tsx` — new
- `apps/web/src/app/(app)/settings/page.tsx` — mount the section

**Key changes**:
- SQL: `alter table public.accounts add column phone text, email_opt_in boolean not null default true, sms_opt_in boolean not null default false, whatsapp_opt_in boolean not null default false, whatsapp_consent_at timestamptz;` — relies on the existing "users update their own account" RLS policy (verify it permits these columns).
- `Account` gains `phone: string | null; email_opt_in: boolean; sms_opt_in: boolean; whatsapp_opt_in: boolean` (`account.ts:12-17`); `fetchAccount` select extended.
- `updateNotificationPrefs(supabase, userId, prefs: { phone?: string | null; email_opt_in?: boolean; sms_opt_in?: boolean; whatsapp_opt_in?: boolean }): Promise<{ error }>` — new; sets `whatsapp_consent_at = now()` when whatsapp_opt_in flips true.
- `NotificationsSection` — phone `<input>` + three toggle switches (matching `OptionalRulesSection.tsx` styling); SMS/WhatsApp toggles labelled "coming soon" but persist. E.164 normalization/validation on phone.

**Verify**: `supabase db reset` applies; `pnpm --filter @dolmenwood/web typecheck|test|lint` pass. Manual: set phone + toggle opt-ins in settings, reload → values persisted; a second account cannot read/write the first's prefs (RLS).

---

## Phase 2: Deliveries outbox + dispatch module + Resend email (manually triggered)

The core pipeline: a portable outbox, a trigger-agnostic dispatch module that enqueues from the `notifications` table and sends email via Resend, a first service-role client, and a secret-protected drain route. Triggered manually (curl) in this phase.

**Files**:
- `supabase/migrations/20260709000031_notification_deliveries.sql` — new
- `apps/web/src/lib/supabase/service.ts` — new (first service-role client)
- `apps/web/src/lib/notifications/dispatch.ts` — new (orchestration)
- `apps/web/src/lib/notifications/channels/email.ts` — new (Resend)
- `apps/web/src/lib/notifications/channels.ts` — new (pure channel-selection helper, unit-tested)
- `apps/web/src/app/api/notifications/drain/route.ts` — new
- `apps/web/src/test/__tests__/notification-channels.test.ts` — new
- `apps/web/package.json` — add `resend`
- `apps/web/.env.local.example` — add `RESEND_API_KEY`, `RESEND_FROM`, `NOTIFICATIONS_DRAIN_SECRET`

**Key changes**:
- SQL: `notification_deliveries { id uuid pk, notification_id uuid not null references notifications(id) on delete cascade, channel text not null check (channel in ('email','sms','whatsapp')), status text not null default 'pending' check (status in ('pending','sent','failed')), sent_at timestamptz, error text, attempts int not null default 0, created_at timestamptz default now() }`; `unique (notification_id, channel)` (idempotency); index on `status`; RLS enabled with **no user policies** (service-role only, mirroring `proposal_availability` `20260624000025:4-5`).
- `createServiceClient(): SupabaseClient` — server-only, uses `SUPABASE_SERVICE_ROLE_KEY`; throws if unset.
- `channelsFor(account: { email_opt_in; sms_opt_in; whatsapp_opt_in }): Channel[]` — pure; returns only **implemented + opted-in** channels (email only for now). Unit-tested.
- `drainNotifications(admin): Promise<{ enqueued: number; sent: number; failed: number }>` — enqueue (diff `notifications` against `notification_deliveries` per recipient/opted-in channel, insert `pending` via upsert on the unique key) then send (read `pending`, dispatch per channel, mark `sent`/`failed` + `attempts++`).
- `sendEmail(to: string, subject: string, body: string): Promise<void>` — Resend SDK; reads `RESEND_API_KEY`/`RESEND_FROM`. SMS/WhatsApp channel branches throw "not implemented" (never reached, since `channelsFor` excludes them).
- `POST /api/notifications/drain` — `runtime='nodejs'`; checks `x-drain-secret` header against `NOTIFICATIONS_DRAIN_SECRET` (401 otherwise); calls `drainNotifications(createServiceClient())`; returns counts JSON. Under `/api/` so already excluded from middleware (`middleware.ts:45-47`).

**Verify**: `supabase db reset`; `typecheck|test|lint` pass (channel-selection unit test green). Manual (dev server, seeded confirmed proposal so a `date_confirmed` notification exists): `curl -XPOST localhost:3000/api/notifications/drain -H "x-drain-secret: <secret>"` → returns `{enqueued>0, sent>0}`; `notification_deliveries` rows are `sent`; **re-run → enqueued/sent 0 (idempotent)**; a recipient with `email_opt_in=false` gets no email delivery row; wrong/missing secret → 401. (Actual email receipt needs a Resend key + verified domain — note as setup, not a blocker for the row-level checks.)

---

## Phase 3: Scheduled drainer + production secrets

Automate the drain via a GitHub Actions cron and wire the provider/drain secrets into Azure so it works in production. Only the trigger is added — the dispatch module is unchanged.

**Files**:
- `.github/workflows/notifications-drain.yml` — new (cron + `workflow_dispatch`)
- `infra/azure/modules/app-service.bicep` — add Key Vault–referenced app settings
- `docs/deployment.md` (+ `infra/azure/README.md`) — document new secrets
- `docs/database.md` — document the new tables/columns

**Key changes**:
- Workflow: `schedule: cron every ~5 min` + manual dispatch; `curl -XPOST ${{ vars.APP_URL }}/api/notifications/drain -H "x-drain-secret: ${{ secrets.NOTIFICATIONS_DRAIN_SECRET }}"`. Mirrors the `blog-session.yml` cron pattern.
- `app-service.bicep:66-116` — add `RESEND_API_KEY`, `RESEND_FROM`, `NOTIFICATIONS_DRAIN_SECRET` as `@Microsoft.KeyVault(...)` app-settings, following the `SUPABASE_SERVICE_ROLE_KEY` reference at `:88-91`. Secret values set out-of-band via `az keyvault secret set` (documented).
- Note in the workflow/docs: this cron trigger is the pre-Cosmos mechanism; post-migration it is replaced by an Azure Function bound to the Cosmos change feed calling the same `drainNotifications`.

**Verify**: `workflow_dispatch` run hits the deployed route and returns counts; `az deployment` (or `bicep build`) validates the added settings. Manual: trigger the workflow, confirm a real email is delivered end-to-end in the deployed environment.

---

## Testing Checkpoints

- **After Phase 1**: `accounts` has phone + opt-in columns; settings UI reads/writes them per-user under RLS; web checks green. Users can manage contact/prefs — independently valuable even if nothing sends yet.
- **After Phase 2**: calling the drain route sends opted-in email via Resend, records per-channel delivery status, and is idempotent; no-opt-in recipients are skipped; unauthenticated calls rejected. The full send pipeline works end-to-end on manual trigger. Independently valuable (a human/cron can run it).
- **After Phase 3**: the drainer runs on a schedule and the production environment has the secrets to send real emails. Feature complete for the email channel; WhatsApp/SMS remain a future effort (columns/flags in place).

## Notes on slicing
- Phase 1 is a self-contained user-facing slice; Phases 2–3 build the send pipeline. The one piece of pure logic worth an automated unit test is `channelsFor` (opt-in × implemented-channel selection); the rest is DB/provider behavior verified via `supabase db reset` + a manual drain-route call.
- WhatsApp/SMS are intentionally not vertical slices here — their columns/flags ship in Phases 1–2 but the dispatch branches and provider onboarding are deferred (design "What We're NOT Doing").
- The dispatch module's trigger-agnostic boundary is the seam for the future Cosmos Change Feed swap; no phase depends on Supabase-specific event mechanisms.
