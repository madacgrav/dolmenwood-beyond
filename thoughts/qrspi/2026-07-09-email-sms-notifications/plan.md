# Implementation Plan

## Overview
When a proposal is confirmed, participants who opted in receive an outbound email (WhatsApp/SMS deferred) via a portable outbox drained by app-level code — no Supabase-specific trigger. Contact info + per-channel opt-ins are stored on `accounts`; deliveries are tracked in a `notification_deliveries` outbox; a trigger-agnostic dispatch module sends via Resend and is invoked by a secret-protected drain route (cron now, Cosmos Change Feed later).

## Phase 1: Contact info + notification preferences

### Changes

#### 1. Migration — accounts contact/preference columns
**File**: `supabase/migrations/20260709000030_notification_contact_prefs.sql`
**Action**: create

```sql
-- Contact number + per-channel notification opt-ins for outbound notifications.
alter table public.accounts
  add column phone text,
  add column email_opt_in boolean not null default true,
  add column sms_opt_in boolean not null default false,
  add column whatsapp_opt_in boolean not null default false,
  add column whatsapp_consent_at timestamptz;

-- No new RLS policy: the existing "Users can update their own account" policy
-- (20260512000014_review_fixes.sql:11-18, using auth.uid()=id with a check that
-- only blocks changing is_admin) already permits self-updates to these columns.
```

#### 2. Account data layer
**File**: `apps/web/src/lib/data/account.ts`
**Action**: modify

- Extend `Account` (`:12-17`) with `phone: string | null; email_opt_in: boolean; sms_opt_in: boolean; whatsapp_opt_in: boolean`.
- Extend `fetchAccount` select (`:25`) to `'display_name, email, role, invite_code, phone, email_opt_in, sms_opt_in, whatsapp_opt_in'`.
- Add:
```ts
export async function updateNotificationPrefs(
  supabase: SupabaseClient,
  userId: string,
  prefs: { phone?: string | null; email_opt_in?: boolean; sms_opt_in?: boolean; whatsapp_opt_in?: boolean },
): Promise<string | null> {
  const patch: Record<string, unknown> = { ...prefs };
  if (prefs.whatsapp_opt_in === true) patch.whatsapp_consent_at = new Date().toISOString();
  const { error } = await supabase.from('accounts').update(patch).eq('id', userId);
  return error ? error.message : null;
}
```

#### 3. Settings section
**File**: `apps/web/src/app/(app)/settings/components/NotificationsSection.tsx`
**Action**: create

Props mirror `ProfileSection` (`supabase`, `account: Account | null`, `onAccountChange`). Local state seeded from `account` via `useEffect`. A phone `<input>` (uses `inputStyle`), three toggle switches reusing the exact toggle markup from `OptionalRulesSection.tsx:22-28`, and a Save button reusing `ProfileSection.tsx:74-85`. SMS/WhatsApp rows show a muted "coming soon" note but their toggles still persist the opt-in flag.

```tsx
'use client';
import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { updateNotificationPrefs, type Account } from '@/lib/data/account';
import { sectionStyle, sectionHeaderStyle, inputStyle } from './styles';

interface Props {
  supabase: SupabaseClient;
  account: Account | null;
  onAccountChange: (updater: (prev: Account | null) => Account | null) => void;
}
// state: phone, emailOptIn, smsOptIn, whatsappOptIn (seed from account in useEffect on [account])
// handleSave(): updateNotificationPrefs(supabase, user.id, {...}); on success onAccountChange(prev => ({...prev, ...}))
// toggles: email (label "Email"), sms + whatsapp (label + "coming soon" desc). E.164-normalize phone on save.
```
Phone normalization: strip spaces/dashes; if non-empty and not starting with `+`, keep as entered (validation is best-effort — a hard requirement only matters once Twilio ships). Store empty string as `null`.

#### 4. Mount the section
**File**: `apps/web/src/app/(app)/settings/page.tsx`
**Action**: modify — import `NotificationsSection`, render after `<ProfileSection .../>` (`:45-51`):
```tsx
<NotificationsSection supabase={supabase} account={account} onAccountChange={setAccount} />
```

### Verification
#### Automated
- [x] `supabase db reset` applies `...030` with no error
- [x] `pnpm --filter @dolmenwood/web typecheck` passes
- [x] `pnpm --filter @dolmenwood/web lint` passes
- [x] `pnpm --filter @dolmenwood/web test` passes (38/38)

#### Manual
- [ ] Dev server → Settings: set a phone number, toggle email off, sms/whatsapp on; Save; reload → values persisted
- [ ] Via psql as a second account: confirm RLS prevents reading/writing the first account's `phone`/opt-ins
- [ ] `whatsapp_consent_at` is set when whatsapp_opt_in flips true (check row in psql)

---

## Phase 2: Deliveries outbox + dispatch module + Resend email (manually triggered)

### Changes

#### 1. Migration — deliveries outbox
**File**: `supabase/migrations/20260709000031_notification_deliveries.sql`
**Action**: create

```sql
create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  channel text not null check (channel in ('email','sms','whatsapp')),
  status text not null default 'pending' check (status in ('pending','sent','failed')),
  sent_at timestamptz,
  error text,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  unique (notification_id, channel)   -- idempotency: one row per recipient-notification per channel
);
create index idx_notification_deliveries_status on public.notification_deliveries(status);

-- Service-role-only: all reads/writes go through the dispatch path (no user policies),
-- mirroring proposal_availability (20260624000025_proposal_availability.sql:4-5).
alter table public.notification_deliveries enable row level security;
```

#### 2. Service-role Supabase client (first usage)
**File**: `apps/web/src/lib/supabase/service.ts`
**Action**: create

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Server-only elevated client for the notification dispatch path. Bypasses RLS. */
export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('createServiceClient requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
```

#### 3. Channel selection (pure, unit-tested)
**File**: `apps/web/src/lib/notifications/channels.ts`
**Action**: create

```ts
export type Channel = 'email' | 'sms' | 'whatsapp';
export const IMPLEMENTED_CHANNELS: Channel[] = ['email'];   // WhatsApp/SMS added later

export interface ChannelPrefs { email_opt_in: boolean; sms_opt_in: boolean; whatsapp_opt_in: boolean; }

/** Channels that are both implemented AND opted-in for this account. */
export function channelsFor(prefs: ChannelPrefs): Channel[] {
  const opted: Record<Channel, boolean> = {
    email: prefs.email_opt_in, sms: prefs.sms_opt_in, whatsapp: prefs.whatsapp_opt_in,
  };
  return IMPLEMENTED_CHANNELS.filter(c => opted[c]);
}
```

#### 4. Email channel (Resend)
**File**: `apps/web/src/lib/notifications/channels/email.ts`
**Action**: create

```ts
import { Resend } from 'resend';

export async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) throw new Error('Email channel requires RESEND_API_KEY and RESEND_FROM');
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({ from, to, subject, text: body });
  if (error) throw new Error(error.message);
}
```

#### 5. Dispatch module (trigger-agnostic)
**File**: `apps/web/src/lib/notifications/dispatch.ts`
**Action**: create

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { channelsFor, type Channel } from './channels';
import { sendEmail } from './channels/email';

const ENQUEUE_WINDOW_HOURS = 24;   // guard: never blast historical notifications (e.g. on first deploy) or spam late opt-ins

/** Create a pending delivery row per opted-in channel for recent notifications. Idempotent via the unique key. */
async function enqueue(admin: SupabaseClient): Promise<number> {
  const since = new Date(Date.now() - ENQUEUE_WINDOW_HOURS * 3600_000).toISOString();
  const { data: notes } = await admin
    .from('notifications')
    .select('id, accounts:account_id(email_opt_in, sms_opt_in, whatsapp_opt_in)')
    .gte('created_at', since);
  const rows: { notification_id: string; channel: Channel }[] = [];
  for (const n of notes ?? []) {
    const prefs = (n as any).accounts;
    if (!prefs) continue;
    for (const channel of channelsFor(prefs)) rows.push({ notification_id: (n as any).id, channel });
  }
  if (rows.length === 0) return 0;
  await admin.from('notification_deliveries').upsert(rows, { onConflict: 'notification_id,channel', ignoreDuplicates: true });
  return rows.length;
}

function subjectFor(_kind: string, body: string): string { return body; }   // date_confirmed body is already a full sentence

/** Send all pending deliveries, marking sent/failed. Failed rows are terminal this iteration (attempts tracked). */
async function sendPending(admin: SupabaseClient): Promise<{ sent: number; failed: number }> {
  const { data: pending } = await admin
    .from('notification_deliveries')
    .select('id, channel, attempts, notifications:notification_id(kind, body, accounts:account_id(email))')
    .eq('status', 'pending');
  let sent = 0, failed = 0;
  for (const d of pending ?? []) {
    const row = d as any;
    try {
      const note = row.notifications;
      if (row.channel === 'email') await sendEmail(note.accounts.email, subjectFor(note.kind, note.body), note.body);
      else throw new Error(`channel ${row.channel} not implemented`);
      await admin.from('notification_deliveries').update({ status: 'sent', sent_at: new Date().toISOString(), attempts: (row.attempts ?? 0) + 1 }).eq('id', row.id);
      sent++;
    } catch (e) {
      await admin.from('notification_deliveries').update({ status: 'failed', error: String(e), attempts: (row.attempts ?? 0) + 1 }).eq('id', row.id);
      failed++;
    }
  }
  return { sent, failed };
}

export async function drainNotifications(admin: SupabaseClient): Promise<{ enqueued: number; sent: number; failed: number }> {
  const enqueued = await enqueue(admin);
  const { sent, failed } = await sendPending(admin);
  return { enqueued, sent, failed };
}
```

#### 6. Drain route
**File**: `apps/web/src/app/api/notifications/drain/route.ts`
**Action**: create

```ts
import { createServiceClient } from '@/lib/supabase/service';
import { drainNotifications } from '@/lib/notifications/dispatch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const secret = process.env.NOTIFICATIONS_DRAIN_SECRET;
  if (!secret) return Response.json({ error: 'not configured' }, { status: 500 });
  if (request.headers.get('x-drain-secret') !== secret) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const result = await drainNotifications(createServiceClient());
  return Response.json(result);
}
```
Route is under `/api/`, already excluded from middleware (`middleware.ts:45-47`).

#### 7. Unit test
**File**: `apps/web/src/test/__tests__/notification-channels.test.ts`
**Action**: create — cover `channelsFor`: email opted → `['email']`; email off → `[]`; sms+whatsapp opted (not implemented) → `[]`; all opted → `['email']`.

#### 8. Dependency + env
**File**: `apps/web/package.json` — add `"resend": "^4.0.0"` to dependencies (run `pnpm --filter @dolmenwood/web add resend`).
**File**: `apps/web/.env.local.example` — add:
```
RESEND_API_KEY=your-resend-api-key
RESEND_FROM=onboarding@resend.dev
NOTIFICATIONS_DRAIN_SECRET=some-long-random-string
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Verification
#### Automated
- [x] `supabase db reset` applies `...031`
- [x] `pnpm --filter @dolmenwood/web test` passes (42/42, channel-selection test green)
- [x] `pnpm --filter @dolmenwood/web typecheck` passes
- [x] `pnpm --filter @dolmenwood/web lint` passes

#### Manual (dev server + psql fixtures)
- [x] Insert a test account (email_opt_in=true) + a `notifications` row via psql — done (opt-in + opt-out fixtures)
- [x] Drain curl → `{enqueued:1, failed:1}`; exactly one `email` row in `notification_deliveries` (failed with "requires RESEND_API_KEY" since no key configured — pipeline + status recording proven)
- [x] **Re-run → still exactly 1 delivery row, nothing re-sent (idempotent via unique key; failed is terminal)**
- [x] Account with `email_opt_in=false` produced no delivery row
- [x] Missing/wrong `x-drain-secret` → 401 (unset-env 500 not separately exercised)
- [ ] With a real free-tier `RESEND_API_KEY` + `RESEND_FROM=onboarding@resend.dev`, the delivery row transitions to `sent` and the email arrives — requires user's Resend account
> Local-env note: this local Supabase stack's default ACLs give API roles no table privileges (anon/authenticated/service_role had only TRUNCATE/REFERENCES/TRIGGER — a local CLI anomaly; production works). Fixed locally with `grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;`. No migration change made — no existing migration grants table privileges and prod relies on standard Supabase default ACLs.

---

## Phase 3: Scheduled drainer + production secrets

### Changes

#### 1. Cron workflow
**File**: `.github/workflows/notifications-drain.yml`
**Action**: create — `on: schedule (cron: '*/5 * * * *')` + `workflow_dispatch`; single job curls the deployed route:
```yaml
- name: Drain notifications
  run: |
    curl -fsS -X POST "${{ vars.APP_URL }}/api/notifications/drain" \
      -H "x-drain-secret: ${{ secrets.NOTIFICATIONS_DRAIN_SECRET }}"
```
Add a comment: pre-Cosmos trigger; replaced post-migration by an Azure Function bound to the Cosmos change feed calling the same `drainNotifications`.

#### 2. Azure app settings
**File**: `infra/azure/modules/app-service.bicep`
**Action**: modify — add three app settings in the `appSettings` array (`:66-116`) as Key Vault references, following `SUPABASE_SERVICE_ROLE_KEY` (`:88-91`):
```bicep
{ name: 'RESEND_API_KEY',            value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/resend-api-key/)' }
{ name: 'RESEND_FROM',               value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/resend-from/)' }
{ name: 'NOTIFICATIONS_DRAIN_SECRET', value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/notifications-drain-secret/)' }
```

#### 3. Docs
**File**: `docs/deployment.md` (+ `infra/azure/README.md`) — document the three new Key Vault secrets and the `az keyvault secret set` step; note the GH `secrets.NOTIFICATIONS_DRAIN_SECRET` + `vars.APP_URL` needed by the workflow.
**File**: `docs/database.md` — add `notification_deliveries` to the table reference and the new `accounts` columns.

### Verification
#### Automated
- [x] `pnpm --filter @dolmenwood/web typecheck|lint|test` still pass (42/42)
- [x] Bicep validates (`az bicep build --file infra/azure/main.bicep` — OK)

#### Manual
- [ ] Set the three Key Vault secrets + GH repo secret/var; run the workflow via `workflow_dispatch` → route returns counts; a real email is delivered end-to-end in the deployed environment
- [ ] Confirm the cron schedule appears in the Actions tab

---

## Notes / Deviations from structure.md
- **Added a 24h enqueue window** (`ENQUEUE_WINDOW_HOURS`) not called out in structure/design: prevents the first drain from emailing about pre-existing/historical `date_confirmed` notifications and prevents a late opt-in from receiving stale confirmations. Combined with the unique `(notification_id, channel)` constraint for idempotency.
- **Failed deliveries are terminal** this iteration (no auto-retry loop); `attempts` is tracked so a retry policy can be added later without schema change.
- **`updateNotificationPrefs` auto-stamps `whatsapp_consent_at`** when whatsapp_opt_in flips true (consent capture), per design decision 6.
- No schema-version test assertions exist to update; `docs/database.md` is the only doc reflecting schema (updated Phase 3).
- Migration filenames `...030` / `...031` follow the `YYYYMMDD` + sequence convention after `...029_campaign_roster.sql`.
