# Research Findings

## Q1: The existing in-app notification mechanism

### Findings
- **Table** `public.notifications` — `supabase/migrations/20260624000027_notifications.sql:5-14`: `id`, `account_id` (FK accounts, cascade), `campaign_id` (FK campaigns), `kind text`, `body text`, `related_session_id` (FK campaign_sessions, set null), `read boolean default false`, `created_at`. Index `(account_id, read, created_at)` at `:16`.
- **RLS** (`:18-26`): only `select` and `update` policies, both `using (account_id = auth.uid())`. No `insert`/`delete` policy for users — rows are created only by the SECURITY DEFINER RPC below (which bypasses RLS).
- **Sole insert site / event:** `set_proposal_availability(p_proposal_id, p_available)`. Final version `supabase/migrations/20260624000028_proposal_guards.sql:41-125`. When the last participant marks available and the proposal flips `open → confirmed`, it fans out one row per participant (`:114-121`):
  ```sql
  insert into public.notifications (account_id, campaign_id, kind, body, related_session_id)
  select parts.account_id, v_campaign_id, 'date_confirmed', 'Session confirmed: ' || v_title, v_session_id
  from ( select account_id from campaign_members where campaign_id = v_campaign_id
         union select referee_id from campaigns where id = v_campaign_id ) parts;
  ```
  The insert block is byte-identical to the original `20260624000027_notifications.sql:98-105`. **This `kind='date_confirmed'` event is the only notification generator in the codebase.**
- **Data layer** `apps/web/src/lib/data/notifications.ts`: `AppNotification { id, kind, body, related_session_id, read, created_at }` (`:3-10`); `loadNotifications(supabase)` (`:13-20`) selects all columns ordered `created_at desc` with **no `account_id` filter** (RLS scopes it); `markNotificationRead(supabase, id)` (`:22-27`) does `update({read:true}).eq('id', id)`.
- **UI** `apps/web/src/components/notifications/NotificationBell.tsx`: fetches **once on mount** via a single `useEffect([supabase])` (`:26-33`) — no polling interval, no Realtime subscription. Unread count computed client-side `notifications.filter(n => !n.read).length` (`:35`). Click marks read then `refetch()` (`:37-42`). Mounted in `apps/web/src/app/(app)/layout.tsx:29`, inside a header rendered only when `user` is present.

## Q2: Server-side execution surfaces

### Findings
- **Route handlers (only two):**
  - `apps/web/src/app/api/health/route.ts` — `GET` only (`:6`), `runtime='nodejs'`, `dynamic='force-dynamic'`; returns static JSON, no auth, no DB. Excluded from middleware via the `api/` matcher exclusion.
  - `apps/web/src/app/auth/callback/route.ts` — `GET` only (`:4`); `createClient()` (server, anon) then `exchangeCodeForSession(code)` (`:14-15`); open-redirect guard on `next`.
- **Server actions (one file):** `apps/web/src/app/(auth)/actions.ts:1` (`'use server'`). Exports `signIn`, `signUp`, `signOut`, `signInWithGoogle`; all use `createClient()` from `lib/supabase/server.ts` (cookie-bound, anon key). These are pre-auth entry points; no per-user authorization gate.
- **Middleware** `apps/web/src/middleware.ts:6-42`: builds inline `createServerClient` (anon key, `:9-28`), calls `supabase.auth.getUser()` (`:30`) on every non-excluded request, redirects unauthenticated→`/sign-in` and authenticated-on-public→`/characters`. Matcher (`:45-47`) excludes `_next/*`, `favicon.ico`, `icons`, `manifest.json`, and **everything under `/api/`**.
- **Supabase client construction** `apps/web/src/lib/supabase/server.ts:1-27` and `client.ts:1-8`: both **always use `NEXT_PUBLIC_SUPABASE_ANON_KEY`**. **No service-role client is constructed anywhere in `apps/web/src`** — `SUPABASE_SERVICE_ROLE_KEY` appears only in docs/infra/env-example, never read by `process.env` in source.
- **Background/scheduled work: none.** No `supabase/functions/`, no `[functions]`/cron in `config.toml`, no `pg_cron` in any migration, no `schedule:`/`cron:` trigger in any `.github/workflows/*.yml`. Confirmed absent repo-wide.

## Q3: User contact info — storage and access

### Findings
- **`accounts` columns** (full current set): `id`, `email text not null`, `role` (`player`|`referee`), `display_name text`, `created_at`, `updated_at` — `supabase/migrations/20260425000001_initial_schema.sql:8-15`; plus `invite_code text unique` (`20260425000004_accounts_invite_code.sql:32-33,49-50`) and `is_admin boolean default false` (`20260511000013_admin_role.sql:2`). **No `phone` column anywhere.**
- **Populated from auth** by `handle_new_user()` (active version `20260425000004_accounts_invite_code.sql:53-66`, fires `after insert on auth.users`): copies `email` from `auth.users.email`; `role`/`display_name` from `raw_user_meta_data` with fallbacks. A second trigger force-sets `is_admin` for `madacgrav@gmail.com` (`20260511000013_admin_role.sql:15-18`).
- **Data layer** `apps/web/src/lib/data/account.ts`: `Account { display_name, email, role, invite_code }` (`:12-17`); `fetchAccount` selects those four (`:19-29`); `updateDisplayName` updates **only** `display_name` (`:31-41`); `deleteAccount` → RPC `delete_my_account` (`:43-48`).
- **Settings UI** `apps/web/src/app/(app)/settings/components/ProfileSection.tsx`: display name is the only editable field (`:65-69`, saved via `updateDisplayName`); `email` and `role` are view-only (`:88-97`); "Change Password" calls `resetPasswordForEmail(account.email)` (`:48`). No phone field rendered.

## Q4: Secrets / env threading (local, Docker, CI, Azure)

### Findings
- **`.env.local.example`** (`apps/web/.env.local.example:1-13`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_WORDPRESS_URL`, `WORDPRESS_API_URL`, `WORDPRESS_APP_PASSWORD`, `WORDPRESS_USERNAME`, `NEXT_PUBLIC_SITE_URL`. **No email/SMS provider vars (no SendGrid/Resend/Twilio) documented.**
- **docker-compose.yml**: build args `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` (`:9-11`); container env adds `SUPABASE_SERVICE_ROLE_KEY` (`${...:-}`, from host shell) (`:20-25`).
- **CI `ci.yml`**: build job sets `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` from `vars.*` (public) (`:85-87`). No service-role key.
- **Deploy `deploy-azure.yml`**: Azure OIDC via `secrets.AZURE_*`; Docker build-args are the two public Supabase vars (`:138-140`); `run-migrations` uses `secrets.SUPABASE_DB_URL` + `secrets.SUPABASE_ACCESS_TOKEN` (`:144-160`). Service-role key never passed through CI.
- **Azure infra** `infra/azure/modules/app-service.bicep:66-116`: App Service has a **system-assigned managed identity** (`:54-56`). App settings — `NEXT_PUBLIC_SUPABASE_URL` plain; `NEXT_PUBLIC_SUPABASE_ANON_KEY`, **`SUPABASE_SERVICE_ROLE_KEY`** (`:88-91`), and the three WordPress secrets are **Key Vault references** `@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/<name>/)`. `key-vault.bicep:36-44` grants the identity "Key Vault Secrets User". Secret *values* are set manually via `az keyvault secret set` (`infra/azure/README.md:57-65`), not by Bicep.
- **Full secret path (the reusable pattern for a new provider key):** Key Vault secret (set manually) → App Service app-setting Key Vault reference in `app-service.bicep` → managed identity resolves it at runtime → injected into container `process.env` → read server-side (non-`NEXT_PUBLIC_` = never in client bundle). `SUPABASE_SERVICE_ROLE_KEY` follows exactly this path but is currently unused by app code.

## Q5: Supabase Auth email capability

### Findings
- **`supabase/config.toml`** — `[auth]` (`:28-38`): `site_url="http://localhost:3000"`, `additional_redirect_urls=["https://localhost:3000","https://dolmenwood-prod-web.azurewebsites.net/**"]`, `enable_signup=true`. `[auth.email]` (`:40-43`): `enable_signup=true`, `double_confirm_changes=true`, **`enable_confirmations=false`** (new signups do NOT require email verification). `[inbucket]` local mail-capture UI on port 54324 (`:20-22`); **no production SMTP / `local_smtp` section** — Supabase's own hosted mailer sends auth emails.
- **`[auth.external.google]`** (`:45-48`): enabled, `client_id`/`secret` from `env(GOOGLE_CLIENT_ID)`/`env(GOOGLE_CLIENT_SECRET)` (not in `.env.local.example`).
- **Trigger sites in `apps/web/src/app/(auth)/`:** `sign-up/page.tsx:30-37` `signUp` with `emailRedirectTo` from `window.location.origin`; `actions.ts:20-43` server-action `signUp` with **no** `emailRedirectTo`; `forgot-password/page.tsx:18-20` `resetPasswordForEmail` with `redirectTo` from `window.location.origin`; `ProfileSection.tsx:48` `resetPasswordForEmail` with no redirect; `actions.ts:51-58` Google OAuth uses `process.env.NEXT_PUBLIC_APP_URL` (fallback `http://localhost:3000`).
- **URL settings** the emails rely on: Supabase server uses `site_url` + `additional_redirect_urls` (config.toml for local; Supabase Dashboard for prod). Note `NEXT_PUBLIC_SITE_URL` is documented in `.env.local.example:13` but **read nowhere** in `apps/web/src`; the actual code var is `NEXT_PUBLIC_APP_URL` (only in `actions.ts:56`), which is itself absent from `.env.local.example` and the Azure app settings.

## Q6: Per-user preferences / settings patterns

### Findings
- **No database-backed preferences table exists.** Repo-wide search of migrations for `preference|settings|opt_in|opt_out|notify_|phone` → zero matches. No `notifications_enabled`-style column on `accounts` or elsewhere.
- **All existing preferences are `localStorage`-based (per-browser, not per-account):**
  1. Optional game rules — `apps/web/src/hooks/use-optional-rules.ts`: `OptionalRules { subParReroll, hpRerollLowRolls, coinWeightEnabled }` (`:4-8`), key `'dolmenwood-rules'`, JSON merged over defaults; `useOptionalRules()` returns `[rules, setRules]` writing back on change (`:29-43`). UI: `settings/components/OptionalRulesSection.tsx` toggle switches. **This is the closest existing per-user opt-in/opt-out boolean pattern** (booleans in a JSON blob in localStorage).
  2. Theme — `AppearanceSection.tsx:7-22`, key `'dolmenwood-theme'`.
  3. Offline mode — `OfflineModeSection.tsx:7-25`, key `'dolmenwood-offline'`.
- The `notifications.read` flag (`20260624000027_notifications.sql:12`) is per-notification delivery state, **not** a user preference.

## Cross-Cutting Observations
- **No outbound email/SMS infrastructure of any kind** in app code — no SendGrid/Resend/Twilio/nodemailer/SMTP dependency or client. The only emails sent today are Supabase Auth's own hosted confirmation/reset messages (and signup confirmation is disabled).
- **The only notification event is a DB-internal insert** inside `set_proposal_availability` (a Postgres SECURITY DEFINER function). Notification rows are created inside Postgres, not by any Node/server-side code path — so no application code currently observes "a notification was created."
- **No place currently runs privileged server-side code on a schedule or in response to DB events.** No cron, no queue, no edge function, no service-role client. The service-role key is fully provisioned through Key Vault/managed-identity but read by nothing.
- **The Key Vault → App Service app-setting → managed-identity path is an established, working pattern** for delivering a server-only secret to the running container (used for the anon key, service-role key, and WordPress creds).
- **Contact data available today:** `accounts.email` only; no phone number in schema or UI. Email is not user-editable.

## Open Areas
- Whether Supabase project-level SMTP is customized in the hosted (prod) dashboard cannot be determined from the repo — `config.toml` governs local dev only; prod auth-email/SMTP settings live in the Supabase Dashboard, outside version control.
- The exact runtime value/target of `NEXT_PUBLIC_APP_URL` in production is unknown — the var is referenced in `actions.ts:56` but not set in `.env.local.example` or the Azure app settings inspected.
- Whether any Realtime/webhook (e.g. Supabase Database Webhooks) is configured server-side to react to `notifications` inserts cannot be confirmed from the repo — no such config exists in `supabase/` (Database Webhooks are dashboard-configured and not captured in migrations).
