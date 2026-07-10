# Research Findings

## Q1: How the two user roles are represented end to end

### Findings
Two independent, non-interchangeable representations of "role":
1. **Explicit self-declared label** — `AccountDoc.role: 'player' | 'referee'`, picked at sign-up, used **only for UI gating** (tab visibility, badges, admin table). Grants no permission by itself.
2. **Implicit campaign-scoped relationship** — `CampaignDoc.refereeId` (an account id, not a role string). **Every server-side authz check uses this**, never `role`.

**(a) Type/enum declarations**
- `packages/types/src/index.ts:3` — `export type Role = 'player' | 'referee';` (canonical)
- `packages/types/src/index.ts:40-45` — `Account.role: Role`
- `apps/web/src/lib/cosmos/types.ts:13` — `AccountDoc.role: 'player' | 'referee'` (inline literal, does NOT import shared `Role`)
- `apps/web/src/lib/data/account.ts:20` — `Account` (snake_case UI type) `role: string` (widened)
- `apps/web/src/lib/data/account.ts:31` — `SignUpInput.role: 'player' | 'referee'`
- `apps/web/src/app/(auth)/sign-up/page.tsx:8` — local re-declared `type Role = 'player' | 'referee'` (not imported)
- `apps/web/src/stores/auth-store.ts:11,14` — `role: 'player'|'referee'|null` (**store is never imported anywhere — dead declaration**)
- `apps/web/src/app/(app)/admin/page.tsx:10`, `campaign/page.tsx:20` — inline `role: string` response types
- `CampaignDoc` / `Campaign` have **no role field** (`cosmos/types.ts:195-207`, `packages/types/src/index.ts:47-53`) — referee status derived from `refereeId`.

**(b) Persisted role fields (require data migration to change the VALUE)**
- `AccountDoc.role` string `"player"`/`"referee"` — written `account.ts:106-122`, esp. `:109` `role: input.role === 'referee' ? 'referee' : 'player'`. **Stored verbatim on every account doc.** Changing the literal → migration + every `=== 'referee'` read site.
- `CampaignDoc.refereeId` — account id, written `campaigns.ts:83` `refereeId: me`. It's an id, not a label; renaming the *field* (not value) touches many queries.
- `AccountDoc.isAdmin` boolean — `account.ts:112`; separate axis, gates `admin.ts:34`.

**Computed at read time (NO migration):**
- `is_referee` roster field — `campaigns.ts:248` `is_referee: id === doc.refereeId` (API type `lib/api/roster.ts:10`)
- `isReferee` client state — `campaign/page.tsx:22` `setIsReferee(account.role === 'referee')`

**(c) Authz helpers (`lib/authz.ts`) — none read `role`**
- `isCampaignReferee(doc, accountId) = doc.refereeId === accountId` (`authz.ts:56-57`)
- `assertCampaignParticipant` (`authz.ts:63-71`), `listCampaignsRefereedBy` (`authz.ts:73-81`, `WHERE c.refereeId = @id`), `isRefereeOfAccount` (`authz.ts:98-105`) → `canReadCharacter` (`:108-111`)
- Callers: `campaigns.ts:238,262,291,306`, `schedule.ts:74` (`doc.refereeId !== meId`), `proposals.ts:103` (`doc.refereeId !== me`), `admin.ts:34` (uses `isAdmin`).
- Confirmed: no `.role ===` comparison anywhere outside UI files + sign-up/account-create path.

**(d) User-facing role strings (display-only, NO migration)**
- `sign-up/page.tsx:132,139` — RoleCard `title="Player"` / `title="Referee"` + descriptions (`:133,140`)
- `settings/components/ProfileSection.tsx:96-97` — `{account.role}` badge, capitalized
- `campaign/page.tsx:58` — `"Referee view"`
- `admin/page.tsx:188` `{acc.role}` cell; `:239` `"Referee"` column header
- `components/campaign/overview/PlayerView.tsx:40,71` — prose "...Check with your referee." / "Ask your referee..."
- Component/file names `RefereeView.tsx`, `PlayerView.tsx` — identifiers, not data.

## Q2: Notification pipeline creation → delivery; channel contract

### Findings
**Doc shapes** (`cosmos/types.ts`): `DeliveryDoc` (`:210-216`) `{channel:'email'|'sms'|'whatsapp', status:'pending'|'sent'|'failed', sentAt, error, attempts}`; `NotificationDoc` (`:219-230`) `{id, accountId, campaignId, kind, body, relatedSessionId, read, deliveries: DeliveryDoc[], createdAt}` in container `notifications`, partition key `/accountId`.

**Creation** — `proposals.ts:178-203` `fanOutConfirmationNotifications` writes one NotificationDoc per participant with `deliveries: []` (empty; enqueue deferred). Best-effort per-recipient try/catch.

**Dispatch** — `lib/notifications/dispatch.ts`:
- `enqueue()` (`:22-59`): SQL `SELECT * FROM c WHERE c.createdAt >= @since`, since = now − `ENQUEUE_WINDOW_HOURS(24)` (`:17,23`). Per note: `fetchAccountDoc` (`:33`), `channelsFor({email_opt_in,sms_opt_in,whatsapp_opt_in})` (`:35-39`), `existing = Set(note.deliveries[].channel)` (`:40`), `missing = wanted.filter(!existing.has)` (`:41`) — **this set-diff against embedded deliveries IS the idempotency** (no unique-key table; comment `:11-12`). Appends pending DeliveryDocs (`:43-54`), `notifications().item(id, accountId).replace(note)` (`:55`).
- `sendPending()` (`:67-105`): SQL `WHERE EXISTS(SELECT VALUE d FROM d IN c.deliveries WHERE d.status='pending')` (`:70-71`). Per pending delivery — **channel switch** (`:83-87`): `if (channel === 'email') await sendEmail(account.email, subjectFor(kind, body), body); else throw new Error(\`channel ${channel} not implemented\`)`. Success → `sent`, `sentAt`, `attempts++` (`:88-91`); throw → `failed`, `error: String(e)`, `attempts++` (`:92-96`). Failed is **terminal** (no retry loop; comment `:66`). `subjectFor` (`:62-64`) returns `body` unchanged.
- `drainNotifications()` (`:107-115`) = `enqueue()` then `sendPending()`, returns `{enqueued, sent, failed}`.

**Channels** — `lib/notifications/channels.ts`: `Channel='email'|'sms'|'whatsapp'` (`:1`); `IMPLEMENTED_CHANNELS=['email']` (`:4`, comment "SMS/WhatsApp (Twilio) land later"); `channelsFor(prefs)` (`:13-20`) = `IMPLEMENTED_CHANNELS ∩ opted-in`. sms/whatsapp opt-ins never selected today (excluded from IMPLEMENTED_CHANNELS).
**Email** — `channels/email.ts:3` `sendEmail(to, subject, body): Promise<void>`; reads `RESEND_API_KEY`/`RESEND_FROM`, throws if missing (`:6-8`); `new Resend(apiKey).emails.send({from,to,subject,text:body})`, throws on SDK error (`:11`).

**Contract for a NEW channel (by existing wiring, no formal interface):**
1. Add name to `Channel` union + `IMPLEMENTED_CHANNELS` (`channels.ts:1,4`) so `channelsFor` selects it.
2. Export async sender matching `sendEmail` shape — called positionally `(recipientAddress, subject, body)`, return ignored, success/throw only.
3. Add a branch to `sendPending`'s if/else (`dispatch.ts:83-87`) — hardcoded per-channel, no registry.
4. Signal failure via `throw` (sendPending try/catch flips status to `failed`).

## Q3: Scheduling events proposed → confirmed; which write notifications

### Findings
All availability + confirm happens inside **one** `replaceCampaignWithRetry` (ETag-guarded) call.

| Event | Location | Transition | NotificationDoc? |
|---|---|---|---|
| Proposal created | `proposals.ts:64-92` `createProposal` | new `ProposalEntryDoc` `status:'open'`, `availability:[]` | **No** |
| Proposal deleted | `proposals.ts:94-107` | removed (creator or referee only, `:102-104`) | **No** |
| Availability set (not all in) | `proposals.ts:116-153` `setProposalAvailability` (early return `:148,153`) | upsert caller `availability[]` | **No** |
| **Proposal confirmed + session created** | `proposals.ts:154-168` (same call, all approved) | `status:'open'→'confirmed'`, `confirmedSessionId` set, `SessionEntryDoc` pushed (`createdBy: proposal.createdBy` — original proposer) | **Yes** |
| Session created directly | `schedule.ts:44-70` `createSession` | new SessionEntryDoc `createdBy: me` | **No** |
| Session updated | `schedule.ts:77-95` | patch title/scheduledAt/notes (creator/referee) | **No** |
| Session deleted | `schedule.ts:97-109` | removed | **No** |
| RSVP set | `schedule.ts:111-135` `setSessionRsvp` | upsert `rsvps[]` (`yes|no|maybe`) | **No** |

- Confirm gate: `participantIds = participantIdsOf(doc)` = dedup of `doc.members[].accountId` **+ `doc.refereeId`** (`proposals.ts:29-31`). Only fires when every participant has `available:true` (`:150-153`).
- Fan-out (`proposals.ts:178-203`): only when `confirmed` non-null (`:172-174`); one NotificationDoc per participant, `kind:'date_confirmed'` (`:189`), `body:"Session confirmed: ${title}"` (`:190`), `relatedSessionId` (`:191`).
- **`'date_confirmed'` is the ONLY kind value used anywhere.** Proposal-created writes nothing.

## Q4: Contact info + opt-in/consent storage, update, surfacing, read-at-delivery

### Findings
**AccountDoc** (`cosmos/types.ts:10-27`): `email` (`:12`), `phone: string|null` (`:17`), `emailOptIn` (`:18`), `smsOptIn` (`:19`), `whatsappOptIn` (`:20`), `whatsappConsentAt: string|null` (`:21`). Container `accounts`, PK `/id`.
**`account.ts`**:
- `docToAccount` (`:37-49`) maps to snake_case `phone/email_opt_in/sms_opt_in/whatsapp_opt_in`. **`whatsappConsentAt` NOT surfaced** in `Account` UI type (`:16-26`).
- `createAccount` defaults (`:113-117`): `phone:null, emailOptIn:true, smsOptIn:false, whatsappOptIn:false, whatsappConsentAt:null`.
- `updateNotificationPrefs` (`:151-165`): conditionally assigns present keys (`:157-160`); **`if (prefs.whatsapp_opt_in === true) doc.whatsappConsentAt = new Date().toISOString()`** (`:162`). Only ever set on enable — no code path clears it.

**PATCH route** (`api/account/route.ts:28-49`): `prefKeys=['phone','email_opt_in','sms_opt_in','whatsapp_opt_in']` (`:36`); if any present, calls `updateNotificationPrefs` with all four (unsent → undefined → skipped). `email` has **no update path** (set only at creation).

**Settings UI** (`settings/components/NotificationsSection.tsx`): state seeded from account (`:18-31`); `normalizePhone` (`:13-15`) `raw.replace(/[\s\-().]/g,'')` keeps leading `+` — **no length/format/E.164 validation**; `handleSave` (`:33-58`) empty→null (`:39`), PATCH `/api/account`. Toggle labels (`:61-63`): Email "Session confirmations by email"; SMS/WhatsApp both "**(coming soon)**" but toggles still persist.

**Read at delivery**: `channelsFor` (`channels.ts:13-20`) reads the three booleans via `enqueue`'s `fetchAccountDoc` (`dispatch.ts:33-39`). **`whatsappConsentAt` is stored but read by nothing** — only the `whatsappOptIn` boolean gates selection.

## Q5: Third-party integration pattern (credentials, client, failures)

### Findings
| Integration | File | Client instantiation | Missing-config style | Env vars |
|---|---|---|---|---|
| Cosmos DB | `lib/cosmos/client.ts:8-20` | **module singleton** (lazy `let client`) | `throw` | `COSMOS_ENDPOINT`, `COSMOS_KEY` |
| Resend email | `notifications/channels/email.ts:9` | **per-call** `new Resend(apiKey)` | `throw` | `RESEND_API_KEY`, `RESEND_FROM` |
| Blob | `lib/data/portraits.ts:26-30` | **per-call** `BlobServiceClient.fromConnectionString` | `throw` | `BLOB_CONNECTION_STRING` |
| SignalR negotiate | `api/signalr/negotiate/route.ts:18-26` | per-request, no SDK — regex-parse conn string, hand-sign JWT with `jose` | **return JSON 500** | `SIGNALR_CONNECTION_STRING` |
| Auth.js | `lib/auth/config.ts`, `shared.ts` | module singleton `NextAuth({...})` | library-internal (no check); `reset-token.ts:11-15` throws on missing `AUTH_SECRET` | `AUTH_SECRET` |
| WordPress | `lib/wordpress.ts:1,22` | no client, raw `fetch` | **degrade → `[]`** | `NEXT_PUBLIC_WORDPRESS_URL` |

- **Two error styles**: `lib/*` modules `throw new Error(...)`; route handlers `return Response.json({error}, {status})`.
- **Secrets in prod** (`infra/azure/modules/app-service.bicep:66-144`): each secret app-setting = `@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/<kebab-name>/)`, pulled via system-assigned managed identity (`:54-56`). Existing KV-backed: `cosmos-key`, `auth-secret`, `blob-connection-string`, `signalr-connection-string`, `resend-api-key`, `resend-from`, `notifications-drain-secret`. **Adding a new secret = add a KV secret + an appSettings entry in this array + list it in `.env.local.example`.**
- `.env.local.example:1-19` = full local env var list.

## Q6: Background/scheduled processing trigger

### Findings
- **Drain route** `api/notifications/drain/route.ts`: `runtime='nodejs'` (`:3`), `dynamic='force-dynamic'` (`:4`). POST (`:12-22`): reads `NOTIFICATIONS_DRAIN_SECRET` (`:13`), 500 if unset (`:14-16`), compares header `x-drain-secret` (`:17`), 401 on mismatch (`:18`), else `drainNotifications()` → JSON (`:20-21`). Not session-authed (`/api/` bypasses auth middleware; shared secret is sole gate, comment `:9-10`).
- **Cron** `.github/workflows/notifications-drain.yml`: `schedule cron '*/5 * * * *'` + `workflow_dispatch` (`:16-18`); job curls `POST ${{vars.APP_URL}}/api/notifications/drain -H "x-drain-secret: ${{secrets.NOTIFICATIONS_DRAIN_SECRET}}"` (`:27-28`), appends JSON to step summary. Header comment (`:6-9`): "pre-Cosmos trigger", intended future replacement = Azure Function on Cosmos change feed calling same `drainNotifications` (not built).
- **Env**: `.env.local.example:15-19` — `RESEND_API_KEY`, `RESEND_FROM`, `NOTIFICATIONS_DRAIN_SECRET`, `NEXT_PUBLIC_APP_URL`.
- **Tests**: `notification-channels.test.ts` (unit-tests `channelsFor` only, 4 cases). E2E in `proposals-notifications.test.ts` — mocks `sendEmail` (`:18-23`, throws for `'bounce'` addresses), drives `createProposal`→`setProposalAvailability`→`drainNotifications`, asserts counts + idempotency (2nd drain no-op, `:156-181`) + failure isolation (`:183+`). Fake `test/cosmos-fake.ts`: `getContainer` (`:88-135`), `partitionKeyOf` maps `notifications`→`accountId` (`:38`), `replace` enforces 412/ETag (`:102-110`); `runQuery` (`:45-86`) substring-matches SQL — does not implement `EXISTS(...)`/`createdAt >= @since`, relies on dispatch's JS-side filtering.

## Cross-Cutting Observations
- **`refereeId` (id) and `role` (label) are decoupled.** Authz keys entirely off `refereeId`/`ownerId`/`isAdmin`; `role` is UI-only. Renaming the label "referee"→"DM" in copy is migration-free; changing the persisted `role` value `'referee'`→`'dm'` needs a migration + all `=== 'referee'` sites; renaming the `refereeId` field is a broad but value-agnostic rename.
- **Notification infra is generic over `kind`.** Only `date_confirmed` exists; adding a new event = write a NotificationDoc with a new `kind` at the transition point — enqueue/dispatch pick it up automatically for opted-in channels.
- **Adding a channel is 4 hardcoded touchpoints** (union, IMPLEMENTED_CHANNELS, sender fn, sendPending branch) — no plugin registry.
- **Secret convention is uniform**: KV secret + bicep appSettings + `.env.local.example`; `lib/*` throws on missing, routes return JSON.
- **Cosmos fake** doesn't model `EXISTS`/date predicates — new SQL using those won't be filtered by the fake (tests must account for JS-side filtering).

## Open Areas
- **`whatsappConsentAt` is write-only** — stored on enable, read by nothing. Whether it must be checked before sending is a policy question, not answerable from code.
- **`normalizePhone` does no real validation** — no E.164 enforcement; a malformed number persists as-is.
- **`auth-store.ts` appears dead** (never imported) — role field there is inert.
- **`NEXT_PUBLIC_APP_URL`** exists in env but its production value / usage for absolute links wasn't traced here.
- **No Azure Function on the Cosmos change feed exists** for notifications (only `infra/functions/character-feed` for the characters hub).
