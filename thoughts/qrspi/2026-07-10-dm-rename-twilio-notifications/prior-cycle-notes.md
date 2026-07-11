# Carryover Notes from thoughts/qrspi/2026-07-09-email-sms-notifications/

Prior qrspi cycle built the notification infrastructure and shipped the email channel. This cycle picks up its deliberately deferred work (Twilio WhatsApp) and adds a new event (proposal created). These notes are for the Design/Plan phases — NOT for Research (researchers read questions.md only).

## What the prior cycle already built (Supabase-era, since ported to Cosmos)

- **Outbox + dispatch pipeline**: `apps/web/src/lib/notifications/dispatch.ts` — `enqueue()` (24h window, idempotent per `(notification, channel)`), `sendPending()`, `drainNotifications()`. Trigger-agnostic by design so the trigger can swap from cron to Cosmos Change Feed without touching send logic.
- **Channel abstraction**: `apps/web/src/lib/notifications/channels.ts` — `Channel = 'email'|'sms'|'whatsapp'`, `IMPLEMENTED_CHANNELS = ['email']`, `channelsFor(prefs)` = implemented ∩ opted-in. Adding WhatsApp = implement the channel sender + add to `IMPLEMENTED_CHANNELS`.
- **Email channel**: `apps/web/src/lib/notifications/channels/email.ts` via Resend (`RESEND_API_KEY`, `RESEND_FROM`).
- **Contact/prefs on account**: `phone`, `emailOptIn` (default on), `smsOptIn`/`whatsappOptIn` (default off), `whatsappConsentAt` stamped when WhatsApp opt-in flips true (Meta hard requirement — consent capture already done). Settings UI (`NotificationsSection.tsx`) has phone input + toggles; SMS/WhatsApp labeled "coming soon".
- **Drain trigger**: GitHub Actions cron (`.github/workflows/notifications-drain.yml`, */5 min) hitting secret-gated `POST /api/notifications/drain` (`x-drain-secret` vs `NOTIFICATIONS_DRAIN_SECRET`). Explicitly documented as pre-Cosmos stopgap; intended replacement is an Azure Function on the Cosmos change feed calling the same `drainNotifications`.
- **Secrets path**: Key Vault → App Service app-setting reference → managed identity → `process.env`. `TWILIO_*` should follow the same path (bicep: `infra/azure/modules/app-service.bicep`).
- **Only event dispatched**: `kind='date_confirmed'` (proposal confirmed → session created). Dispatch module is generic over `kind` — new events only need a new NotificationDoc write.

## Prior design decisions still in force

1. Enqueue at app layer from the notifications container (source of truth), not inline in the mutation path.
2. Failed deliveries terminal per run; `attempts` tracked for a future retry policy.
3. Phone normalization is best-effort (`normalizePhone` strips spaces/dashes/parens, keeps `+`); prior plan noted hard E.164 validation "only matters once Twilio ships" — that's now.
4. Opt-in defaults: email on, SMS/WhatsApp off with explicit consent timestamp.

## Provider research verdicts (provider-research.md, 2026-07-09)

- **Twilio = only single vendor covering WhatsApp + SMS** (one SDK, one account). Email stays Resend.
- **WhatsApp via Twilio sandbox first**: prototype immediately with join-code opt-in test numbers, no Meta business verification. Production path: Meta Business Manager, business verification (10 min–14 business days), dedicated phone number, display-name approval, **pre-approved message templates**.
- **Template rules**: proactive messages outside the 24h service window MUST use a pre-approved template. "Session confirmed for Saturday" = Utility template (transactional, no promo language). Same applies to "new date suggested".
- **Cost at hobby scale**: cents to a few dollars/month (US utility ~$0.0034–$0.006 + ~$0.005 Twilio markup; rates volatile, re-verify).
- **SMS deferred rationale**: A2P 10DLC registration (10–15 day review, privacy-policy/ToS URLs required from June 30 2026) — friction the user hasn't asked to take on. This cycle = WhatsApp + email only, matching the request.
- **Uncertainties flagged**: exact current WhatsApp US utility rate; whether unverified Meta Business Manager (2-number cap) suffices for low-volume production.

## Explicitly deferred by prior cycle → now in scope

- Twilio WhatsApp channel implementation (opt-in flags/columns exist, dispatch branch throws "not implemented").
- New notification events beyond `date_confirmed` — this cycle adds "new proposal suggested".

## Still out of scope / unresolved from prior cycle

- SMS sending (A2P 10DLC onboarding).
- Azure Function change-feed trigger to replace the GH Actions cron (designed for, not built).
- Delivery retry policy.
- Resend domain verification (SPF/DKIM) — deployment step, not code.
