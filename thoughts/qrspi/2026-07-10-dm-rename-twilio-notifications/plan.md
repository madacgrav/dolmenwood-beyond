# Implementation Plan

## Overview
Rename the "Referee" role to "Dungeon Master"/"DM" across copy and code identifiers (keeping the stored `role` value `'referee'` and `refereeId` field), add a `date_suggested` notification when a proposal is created, and implement WhatsApp as a real Twilio delivery channel gated on stored consent with E.164 phone validation.

**Commands** (run from repo root): `pnpm --filter @dolmenwood/web typecheck`, `… lint`, `… test`. Dev server: `pnpm --filter @dolmenwood/web dev`.

---

## Phase 1: Referee → Dungeon Master rename

Mechanical identifier + copy rename. **Storage untouched**: `AccountDoc.role` value `'referee'`, `SignUpInput.role`/sign-up submit value `'referee'`, `CampaignDoc.refereeId` field. Because two UI spots render the raw stored `role`, add a display mapping — do **not** show the raw value.

### Changes

#### 1. Comment the surviving storage literals
**Files**: `packages/types/src/index.ts`, `apps/web/src/lib/cosmos/types.ts`
**Action**: modify — add a one-line comment at each:
- `packages/types/src/index.ts:3` above `export type Role = 'player' | 'referee';`
- `apps/web/src/lib/cosmos/types.ts:13` above `role: 'player' | 'referee';`
- `apps/web/src/lib/cosmos/types.ts:198` above `refereeId: string;`

```ts
// 'referee' is the stored value for the Dungeon Master (DM) role — kept for
// storage compatibility (no data migration). UI and identifiers say "DM".
```

#### 2. Rename code identifiers (Referee→DungeonMaster, referee→dungeonMaster, is_referee→is_dm, isReferee→isDM)
Driven by the research file:line map. Rename these identifiers everywhere they appear (definitions + all references + test references). Keep every `'referee'` string **value** and the `refereeId`/`c.refereeId`/`doc.refereeId` field accesses unchanged.

**`apps/web/src/lib/authz.ts`**: `isCampaignReferee`→`isCampaignDM` (body still `doc.refereeId === accountId`), `listCampaignsRefereedBy`→`listCampaignsRunByDM` (SQL still `c.refereeId`), `isRefereeOfAccount`→`isDMOfAccount` (param `refereeId`→`dmId`). Update the section comment `:40` and doc comments `:95-97,:107` to say DM.

**`apps/web/src/lib/data/campaigns.ts`**: update imports of the three renamed authz fns; `loadRefereeCampaigns`→`loadDMCampaigns`; type `RefereeCampaignsData`→`DMCampaignsData`; local `refereed`→`dmCampaigns`; roster field `is_referee: id === doc.refereeId` → `is_dm: id === doc.refereeId` (`:248`).

**`apps/web/src/lib/data/bank.ts`**: `RefereeBankEntry`→`DMBankEntry`, `refereeBankOverview`→`dmBankOverview`, local `isReferee`→`isDM`, update imports.

**`apps/web/src/lib/data/admin.ts`**: type fields `referee_display_name`→`dm_display_name`, `referee_email`→`dm_email` (`:24`) + their population (`:79-80`).

**`apps/web/src/lib/api/campaigns.ts`**: `RefereeCampaignsData`→`DMCampaignsData`, `loadRefereeCampaigns`→`loadDMCampaigns`. **Leave the wire query param `?as=referee` as-is** (not user-facing; renaming it means touching route parsing for zero benefit).

**`apps/web/src/lib/api/roster.ts`**: `RosterMember.is_referee`→`is_dm` (`:10`); update the "members ∪ referee" comment.

**`apps/web/src/lib/api/bank.ts`**: `RefereeBankEntry`→`DMBankEntry`, `refereeBankOverview`→`dmBankOverview`.

**Schedule components** — `apps/web/src/components/campaign/ScheduleTab.tsx`, `schedule/SessionList.tsx`, `schedule/ProposalList.tsx`, `schedule/ProposalsSection.tsx`: prop `isReferee`→`isDM` (declaration + passthrough + `canManage` checks).

**`apps/web/src/components/campaign/overview/RefereeView.tsx`**: rename file → `DungeonMasterView.tsx`, component `RefereeView`→`DungeonMasterView`, `loadRefereeCampaigns`→`loadDMCampaigns`; update its import site (OverviewTab / overview index).

**`apps/web/src/components/campaign/BankingTab.tsx`**: update imports `refereeBankOverview`→`dmBankOverview`, `RefereeBankEntry`→`DMBankEntry`.

#### 3. UI copy + display mapping
**`apps/web/src/app/(app)/campaign/page.tsx`**: `isReferee`→`isDM` (state `:12`, setter, `account.role === 'referee'` keeps the value `:22`), tab flag `refereeOnly`→`dmOnly` (`:29,31,35`), prop passes `:97,115`; copy `Referee view`→`DM view` (`:58`).

**`apps/web/src/app/(auth)/sign-up/page.tsx`**: RoleCard `title="Referee"`→`title="Dungeon Master"` (`:139`); keep `selected={role === 'referee'}` and `setRole('referee')` (`:137-138`) — value unchanged. Optionally reword the description.

**`apps/web/src/app/(app)/settings/components/ProfileSection.tsx`** (`:95-98`): render a label, not the raw value:
```tsx
{account.role === 'referee' ? 'Dungeon Master' : 'Player'}
```
Drop `textTransform: 'capitalize'` on that span (value no longer shown).

**`apps/web/src/app/(app)/admin/page.tsx`**: role cell `{acc.role}` (`:188`) → `{acc.role === 'referee' ? 'Dungeon Master' : 'Player'}`; column header `Referee`→`DM` (`:239`); type fields + cell `referee_display_name`→`dm_display_name` (`:33-34`, cell ~`:246`).

**`apps/web/src/components/campaign/overview/PlayerView.tsx`**: prose `Check with your referee.`→`Check with your Dungeon Master.` (`:40`); `Ask your referee for the invite code…`→`Ask your Dungeon Master…` (`:71`).

#### 4. Update test identifier references
**Files**: `apps/web/src/test/__tests__/campaigns.test.ts`, `bank-levelup.test.ts`, `roster-grouping.test.ts`. Rename the renamed identifiers (`loadRefereeCampaigns`→`loadDMCampaigns`, `isCampaignReferee`→`isCampaignDM`, `refereeBankOverview`→`dmBankOverview`, `RefereeBankEntry`→`DMBankEntry`, `is_referee`→`is_dm`). **Do not** change `role: 'referee'` fixture values or `REFEREE` fixture var names (cosmetic; leaving them limits churn) — but you may keep them as-is. `account.test.ts` and `migration-transform.test.ts` keep `role: 'referee'` values → no change.

### Verification
#### Automated
- [x] `pnpm --filter @dolmenwood/web typecheck` passes
- [x] `pnpm --filter @dolmenwood/web lint` passes
- [x] `pnpm --filter @dolmenwood/web test` passes (all existing tests green — 97/97)
- [x] `grep -rni "referee" apps/web/src` returns only: the 3 storage comments, the `'referee'` value literals, `refereeId`/`c.refereeId`/`doc.refereeId` field accesses, and the `?as=referee` wire param — **no user-facing copy, no un-renamed identifiers** (plus historical prose comments in files outside P1 scope: mounts/retainers/characters/schedule/InventoryTab/view page, and test fixtures — accepted)

#### Manual
- [ ] Sign-up shows a "Dungeon Master" role card; submitting still creates an account (stored `role` = `'referee'`)
- [ ] Campaign page (as a DM) shows "DM view" and the Bank tab
- [ ] Settings profile badge shows "Dungeon Master"; admin campaigns table header reads "DM", role cell shows "Dungeon Master"

---

## Phase 2: `date_suggested` notification event

Fan out a new notification to all participants except the proposer when a proposal is created. Delivered via the existing email channel.

### Changes

#### 1. Generalize the fan-out and add the create-time call
**File**: `apps/web/src/lib/data/proposals.ts`
**Action**: modify

Replace `fanOutConfirmationNotifications` (`:177-203`) with a generic helper:
```ts
/** Cross-partition, best-effort: a failed insert only costs that recipient. */
async function fanOutNotifications(
  campaignId: string,
  recipientIds: string[],
  kind: string,
  body: string,
  relatedSessionId: string | null,
): Promise<void> {
  const notifications = getContainer('notifications');
  await Promise.all(
    recipientIds.map(async (accountId) => {
      const doc: NotificationDoc = {
        id: crypto.randomUUID(),
        accountId,
        campaignId,
        kind,
        body,
        relatedSessionId,
        read: false,
        deliveries: [],
        createdAt: new Date().toISOString(),
      };
      try {
        await notifications.items.create(doc);
      } catch (e) {
        console.error(`notification fan-out failed for ${accountId}:`, e);
      }
    }),
  );
}
```

Update the confirm caller (`:172-174`):
```ts
if (confirmed) {
  await fanOutNotifications(
    campaignId,
    confirmed.participantIds,
    'date_confirmed',
    `Session confirmed: ${confirmed.title}`,
    confirmed.sessionId,
  );
}
```

In `createProposal` (`:64-92`), capture recipients during mutate and fan out after the successful replace:
```ts
export async function createProposal(
  campaignId: string,
  input: { title: string; scheduledAt: string; notes: string },
): Promise<void> {
  const me = await requireAccountId();
  const title = String(input.title ?? '').trim();
  if (!title) throw badRequest('title is required');
  if (!input.scheduledAt) throw badRequest('scheduled_at is required');
  let recipients: string[] = [];
  await replaceCampaignWithRetry(
    campaignId,
    (doc, meId) => {
      if (!isCampaignParticipant(doc, meId)) throw forbidden();
    },
    (doc) => {
      const proposal: ProposalEntryDoc = { /* unchanged */ };
      doc.proposals = [...(doc.proposals ?? []), proposal];
      recipients = participantIdsOf(doc).filter((id) => id !== me);
    },
  );
  if (recipients.length > 0) {
    await fanOutNotifications(
      campaignId,
      recipients,
      'date_suggested',
      `New session date suggested: ${title}`,
      null,
    );
  }
}
```

#### 2. Document the kind values
**File**: `apps/web/src/lib/cosmos/types.ts`
**Action**: modify — comment `NotificationDoc.kind` (`:223`): `kind: string; // 'date_confirmed' | 'date_suggested'`

#### 3. Update `proposals-notifications.test.ts` for the new event
**File**: `apps/web/src/test/__tests__/proposals-notifications.test.ts`
**Action**: modify. Alice is the proposer in every case → `date_suggested` fans to REFEREE + BOB (2) at creation. Update:

- **"confirms only when ALL…"** (`:94-134`): after Alice creates + Alice/Bob approve (before referee), assert 2 `date_suggested` and 0 `date_confirmed` instead of `size 0` (`:107`):
  ```ts
  const kinds = () => [...store('notifications').values()].map((n) => (n as unknown as NotificationDoc).kind);
  expect(kinds().filter((k) => k === 'date_confirmed')).toHaveLength(0);
  expect(kinds().filter((k) => k === 'date_suggested')).toHaveLength(2);
  ```
  After confirm, the "one per participant" block (`:123-127`) must filter to `date_confirmed`:
  ```ts
  const confirmedNotes = [...store('notifications').values()]
    .filter((n) => (n as unknown as NotificationDoc).kind === 'date_confirmed') as unknown as NotificationDoc[];
  expect(confirmedNotes).toHaveLength(3);
  expect(new Set(confirmedNotes.map((n) => n.accountId))).toEqual(new Set([REFEREE.id, ALICE.id, BOB.id]));
  expect(confirmedNotes[0]!.body).toBe('Session confirmed: Next Friday?');
  ```
  The "declined vote" tail (`:132`): total is now 2 suggested + 3 confirmed = 5 → `expect(store('notifications').size).toBe(5)`.

- **"drain enqueues…"** (`:156-181`): Bob opts out of email. Notes created: ref{suggested,confirmed}, bob{suggested,confirmed}, alice{confirmed}. Email deliveries (opted-in only): ref 2 + alice 1 = 3 (bob 0). Update:
  ```ts
  expect(first.enqueued).toBe(3);
  expect(first.sent).toBe(3);
  expect(first.failed).toBe(0);
  expect(sentEmails.map((e) => e.to).sort())
    .toEqual(['alice-1@example.com', 'ref-1@example.com', 'ref-1@example.com']);
  // second drain unchanged: { enqueued: 0, sent: 0, failed: 0 }; sentEmails length 3
  ```

- **"a failing send…"** (`:183-206`): Alice email = bounce. Notes: ref{suggested,confirmed}, bob{suggested,confirmed}, alice{confirmed=bounce}. Deliveries: ref 2 + bob 2 + alice 1 = 5; alice's 1 fails. Update `expect(result.failed).toBe(1)` (unchanged) and `expect(result.sent).toBe(4)`. The `aliceNote` lookup + `deliveries[0]` failed assertion still holds (Alice has one note).

### Verification
#### Automated
- [ ] `pnpm --filter @dolmenwood/web test` passes (updated proposals-notifications suite green)
- [ ] `pnpm --filter @dolmenwood/web typecheck && … lint` pass

#### Manual
- [ ] Create a proposal in a 3-person campaign as one member → the other 2 get a `date_suggested` bell notification; proposer gets none
- [ ] With `RESEND_API_KEY`/`RESEND_FROM` set, run the drain (`POST /api/notifications/drain` with `x-drain-secret`) → the 2 recipients receive an email; `date_confirmed` on confirm still works

---

## Phase 3: Twilio WhatsApp channel + consent gate + E.164 validation

### Changes

#### 1. Shared E.164 helper
**File**: `apps/web/src/lib/phone.ts`
**Action**: create
```ts
/** E.164: leading +, first digit 1-9, total 8–15 digits. */
const E164 = /^\+[1-9]\d{7,14}$/;
export function isValidE164(phone: string): boolean {
  return E164.test(phone);
}
```

#### 2. WhatsApp channel sender
**File**: `apps/web/src/lib/notifications/channels/whatsapp.ts`
**Action**: create — per-call client, throw-on-fail (mirrors `email.ts`):
```ts
import twilio from 'twilio';

export async function sendWhatsApp(to: string, _subject: string, body: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM; // includes the "whatsapp:" prefix
  if (!sid || !token || !from) {
    throw new Error('WhatsApp channel requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_WHATSAPP_FROM');
  }
  if (!to) throw new Error('WhatsApp channel requires a recipient phone number');
  const client = twilio(sid, token);
  await client.messages.create({ from, to: `whatsapp:${to}`, body });
}
```

#### 3. Channel selection with consent gate
**File**: `apps/web/src/lib/notifications/channels.ts`
**Action**: modify
```ts
export const IMPLEMENTED_CHANNELS: Channel[] = ['email', 'whatsapp']; // SMS still deferred

export interface ChannelPrefs {
  email_opt_in: boolean;
  sms_opt_in: boolean;
  whatsapp_opt_in: boolean;
  whatsapp_consent_at: string | null;
}

export function channelsFor(prefs: ChannelPrefs): Channel[] {
  const opted: Record<Channel, boolean> = {
    email: prefs.email_opt_in,
    sms: prefs.sms_opt_in,
    whatsapp: prefs.whatsapp_opt_in && prefs.whatsapp_consent_at != null,
  };
  return IMPLEMENTED_CHANNELS.filter((c) => opted[c]);
}
```

#### 4. Dispatch: pass consent, add send branch
**File**: `apps/web/src/lib/notifications/dispatch.ts`
**Action**: modify
- Import: `import { sendWhatsApp } from './channels/whatsapp';`
- `enqueue` `channelsFor({...})` (`:35-39`): add `whatsapp_consent_at: account.whatsappConsentAt`.
- `sendPending` branch (`:83-87`):
```ts
if (delivery.channel === 'email') {
  await sendEmail(account.email, subjectFor(note.kind, note.body), note.body);
} else if (delivery.channel === 'whatsapp') {
  await sendWhatsApp(account.phone ?? '', '', note.body);
} else {
  throw new Error(`channel ${delivery.channel satisfies Channel} not implemented`);
}
```

#### 5. Settings UI: validation + drop WhatsApp "coming soon"
**File**: `apps/web/src/app/(app)/settings/components/NotificationsSection.tsx`
**Action**: modify
- Import `isValidE164` from `@/lib/phone`.
- In `handleSave`, after computing `normalizedPhone`, before the fetch:
```ts
if (normalizedPhone !== '' && !isValidE164(normalizedPhone)) {
  setSaving(false);
  setSaveMsg('Enter a valid number, e.g. +15551234567');
  return;
}
```
- WhatsApp toggle desc (`:63`): drop "(coming soon)" → `'WhatsApp notifications'`. SMS keeps its "(coming soon)".

#### 6. Account PATCH: authoritative server-side validation
**File**: `apps/web/src/app/api/account/route.ts`
**Action**: modify — import `isValidE164`; in `PATCH`, before the pref update (`:36`):
```ts
if (typeof body.phone === 'string' && body.phone !== '' && !isValidE164(body.phone)) {
  return NextResponse.json({ error: 'invalid phone number' }, { status: 400 });
}
```

#### 7. Dependency + env + secrets
**File**: `apps/web/package.json` — add `twilio` (`pnpm --filter @dolmenwood/web add twilio`).
**File**: `apps/web/.env.local.example` — under the notifications block (after `:17`):
```
# WhatsApp via Twilio (from must include the whatsapp: prefix; sandbox sender shown)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```
**File**: `infra/azure/modules/app-service.bicep` — in `appSettings` (after the `resend-from` entry, ~`:107+`), three Key Vault refs mirroring `resend-api-key`:
```bicep
{ name: 'TWILIO_ACCOUNT_SID',   value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/twilio-account-sid/)' }
{ name: 'TWILIO_AUTH_TOKEN',    value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/twilio-auth-token/)' }
{ name: 'TWILIO_WHATSAPP_FROM', value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/twilio-whatsapp-from/)' }
```
(The KV secrets `twilio-account-sid`/`twilio-auth-token`/`twilio-whatsapp-from` are provisioned out-of-band via `az keyvault secret set` — deployment step, not code.)

#### 8. Tests
**File**: `apps/web/src/test/__tests__/notification-channels.test.ts`
**Action**: modify — every `channelsFor({...})` now needs `whatsapp_consent_at`. New/updated expectations:
```ts
// email only (no consent)
channelsFor({ email_opt_in: true, sms_opt_in: false, whatsapp_opt_in: false, whatsapp_consent_at: null }) → ['email']
// all off
channelsFor({ email_opt_in: false, sms_opt_in: false, whatsapp_opt_in: false, whatsapp_consent_at: null }) → []
// whatsapp opted but NOT consented → excluded
channelsFor({ email_opt_in: false, sms_opt_in: true, whatsapp_opt_in: true, whatsapp_consent_at: null }) → []
// whatsapp opted + consented, email off → ['whatsapp']
channelsFor({ email_opt_in: false, sms_opt_in: false, whatsapp_opt_in: true, whatsapp_consent_at: '2026-07-10T00:00:00Z' }) → ['whatsapp']
// all opted + consented (sms still unimplemented) → ['email','whatsapp']
channelsFor({ email_opt_in: true, sms_opt_in: true, whatsapp_opt_in: true, whatsapp_consent_at: '2026-07-10T00:00:00Z' }) → ['email','whatsapp']
```

**File**: `apps/web/src/test/__tests__/notification-whatsapp.test.ts`
**Action**: create — mirror `proposals-notifications.test.ts` setup (mock `@/lib/auth/session`, `@/lib/cosmos/client`→cosmos-fake, and `@/lib/notifications/channels/whatsapp` capturing sends; also mock `channels/email` to a no-op). Seed one account with `phone: '+15551230000'`, `whatsappOptIn: true`, `whatsappConsentAt: '2026-07-01T00:00:00Z'`, `emailOptIn: false`. Confirm a proposal → `drainNotifications()` → assert a `whatsapp` delivery is `sent` and `sendWhatsApp` was called with that phone. Second account: same but `phone: null` → its whatsapp delivery is `failed` (empty recipient), others unaffected. (Existing suites are unaffected: their seeded accounts keep `whatsappOptIn: false`, so no whatsapp deliveries appear.)

### Verification
#### Automated
- [ ] `pnpm --filter @dolmenwood/web typecheck && … lint && … test` all pass (channels + whatsapp suites green)
- [ ] `channelsFor` returns `['email','whatsapp']` only with opt-in **and** consent; `['email']` when WhatsApp opted but not consented

#### Manual
- [ ] Join the Twilio WhatsApp sandbox with a test number; in Settings set that number + enable WhatsApp (stamps consent) → confirm/suggest a session → WhatsApp message received
- [ ] Enter `123` as the phone in Settings → save rejected inline; PATCH `/api/account` with `{"phone":"123"}` → 400
- [ ] A recipient with WhatsApp opted-in but a null `phone` → their WhatsApp delivery is `failed`, email (if opted) still sent

---

## Testing Checkpoints
- **After P1**: typecheck/lint/test green; grep shows no user-facing "referee" and no un-renamed identifiers; stored `role`/`refereeId` unchanged; UI reads Dungeon Master/DM.
- **After P2**: creating a proposal notifies N−1 participants (email); `date_confirmed` unchanged; updated test counts (2 suggested + 3 confirmed) green; idempotent drain.
- **After P3**: WhatsApp delivered only for opted-in **and** consented recipients with a valid phone; invalid phone rejected at save (client) and PATCH (server 400); SMS still inert; existing suites unaffected.

## Deviations from structure.md
- **Generalized `fanOutConfirmationNotifications` → `fanOutNotifications`** (one helper, two callers) rather than a second parallel function — smaller surface, same behavior.
- **E.164 validation placed in a shared `lib/phone.ts`** used by both the client component and the PATCH route (route is authoritative, returns 400) — the route check replaces threading a throw through `updateNotificationPrefs`/`handleError`.
- **Flagged the `proposals-notifications.test.ts` count updates explicitly** (structure said "extend"); the new event shifts existing assertions, so exact new numbers are specified.
