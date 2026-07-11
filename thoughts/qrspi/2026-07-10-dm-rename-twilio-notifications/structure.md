# Structure Outline

## Approach
Three independent vertical slices. **P1** renames referee→DM (copy + code identifiers, stored `'referee'` value/`refereeId` field kept, commented). **P2** adds the `date_suggested` event — proves a new notification event end-to-end on the already-implemented email channel. **P3** adds the Twilio WhatsApp channel + consent gate + E.164 validation, which both events then deliver over. Order lets each phase land and be valuable even if a later one slips.

---

## Phase 1: Referee → Dungeon Master rename
Rename every user-facing string and code identifier from referee to Dungeon Master / DM. Keep persisted `AccountDoc.role` value `'referee'`, the `Role` union member, and `CampaignDoc.refereeId` field — comment each surviving literal. No data migration.

**Files**: `packages/types/src/index.ts`, `apps/web/src/lib/cosmos/types.ts`, `lib/authz.ts`, `lib/data/{campaigns,account,admin,bank}.ts`, `lib/api/{campaigns,roster,bank}.ts`, `components/campaign/**` (incl. rename `overview/RefereeView.tsx` → `DungeonMasterView.tsx`, `overview/PlayerView.tsx` copy), `app/(app)/campaign/page.tsx`, `app/(app)/admin/page.tsx`, `app/(auth)/sign-up/page.tsx`, `app/(app)/settings/components/ProfileSection.tsx`, affected `test/__tests__/*.ts`.

**Key changes** (identifiers: `Referee`→`DungeonMaster`, `referee`→`dungeonMaster`, `is_referee`→`is_dm`; UI: "Dungeon Master" in prose/titles, "DM" in tight spaces):
- `isCampaignReferee` → `isCampaignDM(doc, accountId)` (still reads `doc.refereeId`), `listCampaignsRefereedBy` → `listCampaignsRunByDM`, `isRefereeOfAccount` → `isDMOfAccount` (`authz.ts`)
- `is_referee: boolean` → `is_dm: boolean` on `RosterMember` (`lib/api/roster.ts`) + producer `campaigns.ts:248` + consumers
- `isReferee` prop/state → `isDM` across `ScheduleTab`, `SessionList`, `ProposalList`, `ProposalsSection`, `campaign/page.tsx`
- UI: sign-up RoleCard `title="Dungeon Master"`; `campaign/page.tsx` `"DM view"`; `admin/page.tsx` `"DM"` header; PlayerView prose "…ask your DM…"
- **Comments** at `packages/types/src/index.ts:3`, `cosmos/types.ts:13` (`AccountDoc.role`), `cosmos/types.ts:198` (`refereeId`): `'referee'`/`refereeId` = stored identifier for the DM role, kept for storage compatibility; UI + identifiers say DM.
- **Not touched**: `AccountDoc.role` value, `SignUpInput.role` value strings, `refereeId` field, dead `stores/auth-store.ts`.

**Verify**: `pnpm --filter @dolmenwood/web typecheck && lint && test` pass. Grep `-i referee` on `apps/web/src` returns only the 3 storage comments + `'referee'`/`refereeId` literals — no user-facing copy. Dev server: sign-up shows "Dungeon Master" card; campaign page shows "DM view"; admin table header "DM".

---

## Phase 2: `date_suggested` notification event
When a proposal is created, fan out a new notification to all participants except the proposer. Delivered via the existing email channel (WhatsApp lands in P3).

**Files**: `lib/data/proposals.ts`, `lib/cosmos/types.ts` (kind doc/comment), `test/__tests__/proposals-notifications.test.ts`.

**Key changes**:
- Add `fanOutSuggestionNotifications(campaignId, proposalTitle, sessionRelatedId|null, recipientIds: string[])` in `proposals.ts`, mirroring `fanOutConfirmationNotifications` (`:178-203`) — per-recipient best-effort try/catch, `kind: 'date_suggested'`, `body: "New session date suggested: ${title}"`, `deliveries: []`.
- In `createProposal` (`:64-92`), after the successful `replaceCampaignWithRetry`, compute `recipients = participantIdsOf(doc).filter(id => id !== me)` and call the fan-out.
- Document `kind` values (`date_confirmed` | `date_suggested`) at `NotificationDoc` (`cosmos/types.ts:219-230`).

**Verify**: `pnpm … test` passes with a new case: `createProposal` in a campaign of N participants → drain → exactly N−1 `date_suggested` NotificationDocs, each with one `sent` email delivery; proposer gets none; second drain is a no-op (idempotent). Manual: create a proposal → other members' bell shows it + email arrives.

---

## Phase 3: Twilio WhatsApp channel + consent gate + phone validation
Implement WhatsApp as a real delivery channel via Twilio, gated on stored consent; enforce E.164 at phone save. Both `date_suggested` and `date_confirmed` then deliver over WhatsApp for opted-in/consented recipients.

**Files**: `lib/notifications/channels/whatsapp.ts` (new), `lib/notifications/channels.ts`, `lib/notifications/dispatch.ts`, `app/(app)/settings/components/NotificationsSection.tsx`, `app/api/account/route.ts`, `lib/data/account.ts` (validation), `apps/web/package.json` (+`twilio`), `apps/web/.env.local.example`, `infra/azure/modules/app-service.bicep`, `test/__tests__/notification-channels.test.ts` (+ `proposals-notifications.test.ts`).

**Key changes**:
- `sendWhatsApp(to: string, _subject: string, body: string): Promise<void>` — per-call `new Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)`; `messages.create({ from: TWILIO_WHATSAPP_FROM, to: 'whatsapp:'+to, body })`; throw if any env missing or `to` empty (matches `sendEmail` throw-on-fail shape).
- `channels.ts`: `IMPLEMENTED_CHANNELS = ['email', 'whatsapp']`; extend `ChannelPrefs` with `whatsapp_consent_at: string | null`; `channelsFor` includes `whatsapp` only when `whatsapp_opt_in && whatsapp_consent_at` (consent gate).
- `dispatch.ts`: `enqueue` passes `whatsapp_consent_at: account.whatsappConsentAt` into `channelsFor` (`:35-39`); `sendPending` branch (`:83-87`) — `else if (channel === 'whatsapp') await sendWhatsApp(account.phone ?? '', '', note.body)`.
- E.164 validation: shared `isValidE164(phone): boolean` (`^\+[1-9]\d{7,14}$`) used in `NotificationsSection` save (block + inline error) **and** authoritatively in `updateNotificationPrefs`/PATCH route (reject non-empty invalid phone with 400). Drop WhatsApp's "(coming soon)" label; SMS keeps it.
- Secrets: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` in `.env.local.example` + Key Vault refs in `app-service.bicep` (mirror `resend-api-key`).

**Verify**: `pnpm … test` passes: `channelsFor` returns `['email','whatsapp']` when both opted+consented, `['email']` when WhatsApp opted but no consent, `[]` when neither; a `date_confirmed`/`date_suggested` drive delivers a `whatsapp` delivery (mocked `sendWhatsApp`), malformed/empty phone → that delivery `failed`, others unaffected; PATCH rejects a bad phone (400). Manual: join Twilio sandbox with a test number, set phone + WhatsApp opt-in in settings, confirm a proposal → WhatsApp message received; enter `123` as phone → save rejected.

---

## Testing Checkpoints
- **After P1**: typecheck/lint/test green; no user-facing "referee" text; stored `role`/`refereeId` unchanged (grep + comments present); UI reads "Dungeon Master"/"DM".
- **After P2**: creating a proposal notifies N−1 participants by email; idempotent drain; `date_confirmed` behavior unchanged.
- **After P3**: WhatsApp delivered for opted-in+consented recipients on both events; consent-less opt-in sends email only; invalid phone rejected at save and marked `failed` if it slips through; SMS still inert.
- **Independence**: P1 is pure rename (no notification coupling). P2 works with only the email channel. P3 adds WhatsApp without touching event-creation logic. A slip in P3 leaves P1+P2 fully valuable.
