# Design Discussion

## Current State

**Role naming** — "Referee" is the app's term for the GM. Two decoupled representations (research Q1):
- `AccountDoc.role: 'player'|'referee'` — persisted, self-declared at sign-up, **UI-gating only** (no authz reads it). Canonical type `packages/types/src/index.ts:3`.
- `CampaignDoc.refereeId` (account id) — what **every** authz check keys off (`authz.ts:56-57,73-81,98-105`). Not a label.
- Derived/display: `is_referee` (`campaigns.ts:248`), `isReferee` client state (`campaign/page.tsx:22`), UI strings (`sign-up`, `ProfileSection`, `admin/page.tsx:239`, `PlayerView.tsx:40,71`), component names `RefereeView.tsx`.

**Notifications** — outbox pipeline already built (research Q2, prior cycle). `NotificationDoc.deliveries[]` + `dispatch.ts` `enqueue()`→`sendPending()`→`drainNotifications()`. `Channel='email'|'sms'|'whatsapp'`, `IMPLEMENTED_CHANNELS=['email']` (`channels.ts:4`). Only `email` has a `sendPending` branch (`dispatch.ts:83-87`); others throw "not implemented". Only `kind:'date_confirmed'` is ever written, at proposal confirm (`proposals.ts:178-203`). **Proposal *created* writes nothing** (`createProposal` `proposals.ts:64-92`).

**Contact/consent** — `AccountDoc`: `phone`, `emailOptIn`(on), `smsOptIn`/`whatsappOptIn`(off), `whatsappConsentAt` (stamped on WhatsApp opt-in, `account.ts:162`, **read by nothing today**). `normalizePhone` (`NotificationsSection.tsx:13-15`) strips separators, **no E.164 validation**. SMS/WhatsApp toggles labeled "(coming soon)".

**Integration + secrets** — per-call client + `throw` on missing env is the `lib/*` norm (Resend `email.ts:9`, Blob `portraits.ts:26-30`). Secrets: Key Vault → bicep appSettings `@Microsoft.KeyVault(...)` → `process.env` (`app-service.bicep:66-144`) + `.env.local.example`. Drain trigger = GH Actions cron */5 → secret-gated `POST /api/notifications/drain`.

## Desired End State

1. **DM everywhere referee is user- or dev-visible.** All UI copy and code identifiers renamed to "Dungeon Master"/"DM". Persisted `role` value stays `'referee'` and field `refereeId` unchanged — **no data migration**.
2. **WhatsApp is a real delivery channel** via Twilio, alongside email. Opted-in + consented recipients get a WhatsApp message.
3. **Two scheduling events notify**: proposal *created* (`date_suggested`, new) and proposal *confirmed* (`date_confirmed`, exists). Suggested fans to all participants **except the proposer**.

**Verify:**
- Grep finds no user-facing "Referee"/"referee" string; code identifiers read DM/dm; `AccountDoc.role` docs still store `'referee'` (unchanged).
- Create a proposal → each other participant gets a `date_suggested` NotificationDoc; opted-in channels (email + WhatsApp) deliver on drain.
- Confirm a proposal → `date_confirmed` as today, now also via WhatsApp for opted-in/consented recipients.
- WhatsApp opt-in with no consent, or malformed phone → no send / delivery marked `failed`, other recipients unaffected.
- Settings rejects a non-E.164 phone at save.

## Patterns to Follow

- **New channel = 4 touchpoints** (research Q2): extend nothing structurally. Add `whatsapp` sender `channels/whatsapp.ts` matching `sendEmail(to, subject, body): Promise<void>` throw-on-fail shape (`email.ts:3`); add `'whatsapp'` to `IMPLEMENTED_CHANNELS` (`channels.ts:4`); add a branch in `sendPending` (`dispatch.ts:83-87`).
- **New event = one NotificationDoc write** (research cross-cutting): dispatch is generic over `kind`. Add a `date_suggested` fan-out in `createProposal` mirroring `fanOutConfirmationNotifications` (`proposals.ts:178-203`), best-effort per-recipient try/catch.
- **Twilio client**: per-call instantiation + `throw` on missing env, matching Resend/Blob (`email.ts:4-11`, `portraits.ts:26-30`).
- **Secret plumbing**: `TWILIO_*` as Key Vault refs in `app-service.bicep` + `.env.local.example`, matching `resend-api-key` (`app-service.bicep:107+`).
- **Fan-out recipient helper**: reuse `participantIdsOf(doc)` (`proposals.ts:29-31`) then filter out the proposer.
- **Test scaffolding**: extend `proposals-notifications.test.ts` (mock the channel sender, drive create/confirm, assert counts + idempotency + failure isolation). Cosmos fake doesn't model `EXISTS`/date SQL — rely on JS-side filtering (research Q6).

**Do NOT follow / avoid:**
- Do **not** change the persisted `role` value or `refereeId` field — decoupled from the label, renaming them buys nothing user-facing and forces a migration.
- Do **not** implement SMS — out of scope (A2P 10DLC friction).
- Do **not** build a channel registry/abstraction — the hardcoded if/else is the established pattern; one more branch.
- Do **not** rename the `date_confirmed` kind — only add `date_suggested`.

## Design Decisions

1. **Rename depth = UI copy + code identifiers; keep stored value.** Rename visible strings and identifiers (`isReferee`, `RefereeView.tsx`, `is_referee`, authz fn names like `isCampaignReferee`/`listCampaignsRefereedBy`/`isRefereeOfAccount`, the `Role` type's `'referee'` member label stays but variable/UI naming updates). `AccountDoc.role` value `'referee'` and `CampaignDoc.refereeId` field unchanged → **zero migration**. *(Note: keeping the `Role` union value `'referee'` means the type literal and sign-up value strings stay `'referee'`; only human-readable naming changes.)* Add a code comment at each surviving `'referee'` storage literal — `packages/types/src/index.ts:3` (the `Role` union), `apps/web/src/lib/cosmos/types.ts:13` (`AccountDoc.role`), and `CampaignDoc.refereeId` (`cosmos/types.ts:198`) — stating: `'referee'` is the stored value for the Dungeon Master (DM) role, kept for storage compatibility; UI and identifiers say DM.
2. **Terminology: "Dungeon Master" in prose/titles, "DM" in tight spaces** (badges, column headers, `DM view` tab).
3. **WhatsApp send = free-form `body` via Twilio**, `messages.create({from: TWILIO_WHATSAPP_FROM, to: 'whatsapp:'+phone, body})`. Sandbox- and within-window-compatible. Content-template (`contentSid`) deferred to a follow-up once a Meta Utility template is approved.
4. **New `date_suggested` event fans to all participants except the proposer.** Reuse `participantIdsOf` minus `createProposal`'s caller. Body e.g. `"New session date suggested: ${title}"`.
5. **WhatsApp gated on consent.** `channelsFor` (or the whatsapp branch) requires `whatsappOptIn && whatsappConsentAt` — a stored consent timestamp, not just the boolean. Makes `whatsappConsentAt` load-bearing (Meta requirement).
6. **E.164 validation at save.** Add a minimal check in `NotificationsSection`/account PATCH: normalized phone must match `^\+[1-9]\d{7,14}$` when non-empty, else reject. Prevents malformed numbers persisting and failing opaquely at Twilio.
7. **Twilio secrets**: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` (the `whatsapp:+…` sender). Per-call `new Twilio(sid, token)`; throw if any missing.

## What We're NOT Doing

- No SMS channel (opt-in flag stays, sender stubbed/absent).
- No persisted-`role`-value or `refereeId`-field migration.
- No Twilio Content Template / Meta template plumbing this cycle.
- No delivery retry policy (failed stays terminal, `attempts` tracked).
- No Azure Function change-feed trigger (GH Actions cron stays).
- No new notification events beyond `date_suggested` (not editing/deleting/RSVP).
- No rewrite of the dispatch/enqueue idempotency mechanism.
- No touch to the dead `auth-store.ts`.

## Open Risks

- **Twilio sandbox opt-in**: sandbox requires each recipient to join via a code before it can receive messages. Dev/demo needs the tester's number joined; a real production number needs Meta onboarding (out of scope, flagged in prior-cycle-notes).
- **`date_suggested` volume**: every proposal now pings N−1 participants across email+WhatsApp. At hobby scale fine; the 24h enqueue window bounds blast radius.
- **Idempotency across two kinds**: `enqueue` set-diffs deliveries per NotificationDoc, so distinct kinds get distinct docs — no cross-contamination, but confirm the create-then-confirm sequence produces two separate docs (it does; different `kind`).
- **E.164 rejection UX**: tightening validation could reject numbers a user previously saved loosely; only enforced on next save, acceptable.
- **Rename churn vs. tests**: many test fixtures reference `isReferee`/`is_referee`; renaming identifiers ripples into `*.test.ts`. Value strings (`'referee'`) staying put limits the blast radius.
- **`whatsapp:` prefix + consent gate** must both be right or WhatsApp silently no-ops; covered by tests.
