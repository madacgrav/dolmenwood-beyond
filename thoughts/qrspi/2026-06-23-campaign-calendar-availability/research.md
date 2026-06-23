# Research Findings

## Q1: How does the scheduling feature model data and flow end to end?

### Findings — Database (`supabase/migrations/20260621000023_campaign_scheduling.sql`)
- `campaign_sessions` table (lines 5–14): `id uuid PK`, `campaign_id → campaigns(id) ON DELETE CASCADE`, `title text`, `scheduled_at timestamptz`, `notes text default ''`, `created_by → accounts(id)`, `created_at`, `updated_at`. Composite index `idx_campaign_sessions_campaign` on `(campaign_id, scheduled_at)` (line 16). `updated_at` maintained by shared `handle_updated_at()` trigger (lines 18–20).
- `session_rsvps` table (lines 49–55): composite PK `(session_id, account_id)` (line 54), `status text CHECK IN ('yes','no','maybe')`, `updated_at`. RLS enabled (line 61) with **zero policies** — comment at line 47 states all access flows through SECURITY DEFINER RPCs.
- `campaign_sessions` RLS (lines 25–45): SELECT = `is_campaign_member OR is_campaign_referee`; INSERT additionally requires `created_by = auth.uid()`; UPDATE/DELETE = `created_by = auth.uid() OR is_campaign_referee`.
- `get_campaign_schedule(p_campaign_id)` (lines 64–101): SECURITY DEFINER, returns `json`. Membership guard at line 71. Returns `json_agg` of sessions ordered by `scheduled_at`, each with a nested `rsvps` array joined to `accounts` for `display_name` (lines 86–94). `COALESCE` to `'[]'` when empty.
- `set_session_rsvp(p_session_id, p_status)` (lines 107–139): SECURITY DEFINER, returns void. Validates status (line 116), looks up `campaign_id` from session, member/referee guard (line 127), then `INSERT … ON CONFLICT (session_id, account_id) DO UPDATE` writing `auth.uid()` as `account_id` (lines 131–134) — caller cannot forge another's RSVP.

### Findings — Data layer (`apps/web/src/lib/data/schedule.ts`)
- Types: `RsvpStatus` union (line 3); `SessionRsvp { account_id, display_name, status }` (5–9); `Session { id, campaign_id, title, scheduled_at: string, notes, created_by, rsvps: SessionRsvp[] }` (11–18). **Exported type is `Session`, not `CampaignSession`.**
- `loadSchedule` (22–29): `.rpc('get_campaign_schedule')`, returns `[]` on error/null.
- `createSession` (31–43): direct `.from('campaign_sessions').insert(...)`. `updateSession` (54–63): direct `.update({title, scheduled_at, notes}).eq('id')`. `deleteSession` (65–71): direct `.delete().eq('id')` (RLS enforces creator/referee).
- `setRsvp` (45–52): `.rpc('set_session_rsvp')` — must be RPC because `session_rsvps` has no RLS policies.

### Findings — Components
- `ScheduleTab.tsx` (props `{userId, isReferee}`, line 22): owns ALL state. Loads campaigns directly from `campaigns` table (49–59), loads sessions via `loadSchedule` on `campaignId` change (66–78). `refetch` callback (61–64). Every mutation path (`handleSubmit` 104–132, `handleRsvp` 134–137, `handleConfirmDelete` 139–152) ends with `await refetch()` — **full re-fetch, no optimistic updates anywhere**. Converts `datetime-local` → ISO via `new Date(formWhen).toISOString()` (line 110).
- `SessionCalendar.tsx`: month grid; per-cell `count = sessions.filter(sameDay(...)).length` (55) rendered as a dot; clicking calls `onSelectDay` (61); filtering happens in parent (ScheduleTab line 250). No state, no mutations.
- `SessionList.tsx`: sorts upcoming-asc / past-desc (17–26); `tally()` reduces `rsvps` into yes/no/maybe counts (28–33); `myStatus = rsvps.find(r => r.account_id === userId)?.status ?? null` (53); `canManage = created_by === userId || isReferee` (54); renders `RsvpControl` (109).
- `SessionForm.tsx`: fully controlled by parent props (no local state). `RsvpControl.tsx`: pure presentational, 3 buttons, `active = status === opt.value` (19–20), click → `onSet(value)` (22), no optimistic flip. `DeleteSessionModal.tsx`: fixed overlay confirm modal.

## Q2: Migration / RPC / RLS conventions

### Findings
- **Tables**: `id uuid primary key default gen_random_uuid()` for entities; `accounts.id` instead `references auth.users(id)` (initial_schema line 9). Pure join tables use composite PKs and no `id` (`campaign_members` PK `(campaign_id, account_id)` line 58; `session_rsvps` line 54). FKs almost always `on delete cascade`. `created_at` everywhere; `updated_at` only on frequently-mutated tables, maintained by `handle_updated_at()` trigger (initial_schema 366–376).
- **RLS**: enabled on every table immediately after creation. No table ships with RLS off.
- **Identity in RPCs**: every RPC uses `auth.uid()` — even under SECURITY DEFINER, `auth.uid()` reads the *original caller's* JWT, so definer bypasses table RLS while identity stays per-user.
- **All RPCs are `SECURITY DEFINER`** with `set search_path = public` — there is not a single SECURITY INVOKER function. Each pairs `REVOKE EXECUTE … FROM PUBLIC; GRANT EXECUTE … TO authenticated;` (pattern since migration 8).
- **Membership-guarded read example** — `get_campaign_party_data` (`20260512000014_review_fixes.sql:143–191`): inline `if not exists (select 1 from campaign_members where campaign_id = p_campaign_id and account_id = auth.uid()) then raise exception`.
- **Per-user upsert example** — `set_session_rsvp` (migration 23): `account_id` hardcoded to `auth.uid()`, `ON CONFLICT DO UPDATE`. Same shape in `join_campaign` and `bank_transaction`.
- **Recursion fix pattern** (`20260425000005_fix_rls_recursion.sql`): inline membership subqueries caused recursion, so helpers `is_campaign_member()` (14–26) and `is_campaign_referee()` (29–41) were created as SECURITY DEFINER STABLE; RLS policies call these instead of inlining.

## Q3: Campaign membership representation

### Findings
- `accounts` (`initial_schema:8–15`): `id → auth.users(id)`, `email`, `role CHECK ('player','referee')`, `display_name`, `invite_code UNIQUE` (migration 4), `is_admin` (migration 13).
- `campaigns` (`initial_schema:34–40`): `id`, `name`, `referee_id → accounts(id)`, `invite_code UNIQUE`. **The referee is stored in `campaigns.referee_id`, NOT as a `campaign_members` row.**
- `campaign_members` (`initial_schema:54–59`): `campaign_id`, `account_id`, `joined_at`, PK `(campaign_id, account_id)`. Pure join table, no extra columns.
- **Membership check** canonical form: `exists (select 1 from campaign_members where campaign_id = X and account_id = auth.uid())`, wrapped in `is_campaign_member()`.
- **Enumerating all members**: `from campaign_members cm join accounts acc on acc.id = cm.account_id where cm.campaign_id = p_campaign_id order by acc.display_name` (`get_campaign_party_data`, review_fixes 160–178). Note: to get the *full participant set* including the referee, code must union `campaign_members` with `campaigns.referee_id`.
- **App side** (`campaigns.ts`): referee path queries `campaigns` by `referee_id` then `campaign_members` with PostgREST FK join (66–133); player path queries `campaign_members` by `account_id` then calls `get_campaign_party_data` RPC per campaign (140–192).

## Q4: Email / notification / server-side execution capability

### Findings — Email
- `supabase/config.toml:40–43`: `[auth.email]` with `enable_signup = true`, `double_confirm_changes = true`, `enable_confirmations = false`. **No `[auth.smtp]` block** — local dev uses Inbucket mail catcher (config 20–22, port 54324).
- Password reset is browser-side `supabase.auth.resetPasswordForEmail(...)` (`forgot-password/page.tsx:18–19`) — fully delegated to Supabase Auth.
- **No application-level email exists.** Repo-wide search for nodemailer/resend/sendgrid/postmark/@react-email/mailgun/SES/smtp = zero matches. `apps/web/package.json` deps are only `@supabase/ssr`, `@supabase/supabase-js`, `clsx`, `next`, `next-pwa`, `react`, `react-dom`, `tailwind-merge`, `zustand`.

### Findings — Server-side execution
- **No `supabase/functions/` directory** — no Edge Functions exist.
- **API routes — exactly 2**: `api/health/route.ts` (GET status) and `auth/callback/route.ts` (OAuth code exchange).
- **Server Actions — exactly 1 file**: `(auth)/actions.ts` (`'use server'`) exporting `signIn`, `signUp`, `signOut`, `signInWithGoogle`. This is the only `'use server'` file in the repo.
- **No cron, queues, background jobs, or webhook receivers** anywhere.
- **No external-calling Postgres triggers**: searches for `pg_net`, `net.http`, `http_post` = zero. Existing triggers (`set_updated_at`, `on_auth_user_created`, `tr_set_admin_on_signup`) are purely internal.

## Q5: Data-access layer patterns

### Findings
- Types defined/exported inline at top of each file; `type` for unions/simple shapes, `interface` for composable objects. No barrel files.
- **Signature convention**: `supabase: SupabaseClient` is always the first param (documented `account.ts:8–9`); multi-field inputs grouped into one typed object as second arg.
- **RPC vs direct query**: direct `.from()` CRUD when table RLS suffices (createSession/updateSession/deleteSession, account/bank reads); `.rpc()` when needing SECURITY DEFINER elevation, cross-user reads, atomic multi-step writes, or membership-guarded reads (`get_campaign_party_data`, `bank_transaction`, `get_campaign_schedule`, `set_session_rsvp`).
- **Error handling** — three conventions, no `throw` anywhere: (a) return `string | null` message for simple writes (`account.ts`, `bank.ts`); (b) return passthrough `{ error }` / `{ data, error }` (most of `schedule.ts`, `campaigns.ts`); (c) return domain object or `null`/`[]` silently for reads (`loadSchedule` → `[]`, `fetchAccount` → null).

## Q6: Calendar / RSVP UI per-user state

### Findings
- `userId`/`isReferee` resolved at page level (`campaign/page.tsx:17–31` via `supabase.auth.getUser()` + accounts role query) and **prop-drilled** down to tabs and sub-components.
- All campaign tabs are `'use client'`, using `useCallback`-wrapped `loadX` + `useEffect`, reused for both initial load and post-mutation re-fetch. (`BankingTab`, `RefereeView`, `PlayerView`, `ScheduleTab` all identical shape.)
- **Refresh = full re-fetch** is the dominant pattern across all tabs. The *only* local-state mutations in the codebase are pack-animal add/delete in `RefereeView.tsx:134–155` (optimistic, fire-and-forget, no rollback).
- Current user's RSVP read: `myStatus = session.rsvps.find(r => r.account_id === userId)?.status ?? null` (`SessionList.tsx:53`).
- RSVP write flow: `RsvpControl.onSet` → `SessionList.onRsvp` → `ScheduleTab.handleRsvp` → `setRsvp` RPC → `refetch()`.
- Tallies computed client-side: `tally()` reduces `session.rsvps` into yes/no/maybe (`SessionList.tsx:28–33`), rendered as `✅ {yes} · ❔ {maybe} · ❌ {no}` (106–108). `SessionCalendar` only renders a dot for total session count per day, no per-member aggregation.

## Cross-Cutting Observations
- **Two-tier auth model**: table RLS via `is_campaign_member()` / `is_campaign_referee()` helpers for direct queries; SECURITY DEFINER RPCs with inline `auth.uid()` guards for anything needing elevation or cross-user reads. New per-user write surfaces follow the `set_session_rsvp` template (RPC, hardcoded `auth.uid()`, `ON CONFLICT DO UPDATE`, table with RLS-on/no-policies).
- **Referee is not a member row** — any "everyone in the campaign" set must union `campaign_members.account_id` with `campaigns.referee_id`. The existing schedule RPCs guard with `member OR referee` precisely because the referee is outside `campaign_members`.
- **No server-side send path exists** — there is no Edge Function, no outbound-email library, no webhook/trigger that calls external services, and no queue. Any server-initiated email would require introducing one of these (the codebase currently has none).
- **Consistent client architecture**: orchestrator component owns state, presentational children receive props + callbacks, full re-fetch after every mutation.

## Open Areas
- **`buildMonthGrid` / `sameDay` / date utilities** (used by `SessionCalendar`) live outside the schedule files (referenced but not traced here — likely `lib/format.ts` or a calendar util).
- **How "all participants" would be enumerated for a notification** is not implemented anywhere; only per-session RSVP tallies exist. No code currently computes "did every member approve a date."
- **Email transport/credentials**: no SMTP/API-key configuration exists in `config.toml`, env examples, or Azure Key Vault references traced here — so the actual delivery channel for any outbound email is undetermined by the current codebase.
