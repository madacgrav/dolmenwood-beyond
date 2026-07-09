# Provider / Channel Research (web, 2026-07-09)

Landscape for outbound notifications from a hobby-scale app (few users, Azure App Service, Next.js server-side). Sources listed at bottom; per-message rates are volatile — re-verify before budgeting.

## WhatsApp — viable, cheapest per message, highest one-time setup friction

**Access paths:** Meta WhatsApp Business Cloud API directly (no platform fee, Meta per-message rates), or a BSP wrapper — Twilio (most mature Node SDK + free dev **sandbox** requiring no Meta verification), Bird, Vonage (less self-serve).

**One-time setup (production):** Meta Business Manager (unverified caps at 2 phone numbers — may suffice for one sender; verify in the flow), business verification (10 min–14 business days), a phone number not active on personal WhatsApp, display-name approval (1–3 days), and pre-approval of message templates. Realistically ~a week of review queues for a hobbyist; Twilio's sandbox lets you prototype immediately with join-code opt-in test numbers.

**Message rules:** proactive messages (user hasn't messaged you in 24h) MUST use a pre-approved template. "Session confirmed for Saturday" = **Utility** template (transactional, no promo language). Free-form messages allowed only inside the 24-hour service window.

**Pricing (post-July 2025 per-message model):** free-form and within-window utility messages are **free**; out-of-window US utility templates ~$0.0034–$0.006 each (sources conflict; NA rates revised again Jan 1 2026) + ~$0.005/msg BSP markup if via Twilio/Bird. Hobby-scale total: cents to a few dollars/month.

**Opt-in:** explicit user consent to receive WhatsApp messages is a hard Meta policy requirement — capture at phone-number entry.

**Integration:** official Meta Node SDK (`whatsapp` npm, TypeScript), plain Graph-API REST via fetch (simple bearer-token POST), or the `twilio` SDK (one SDK covers WhatsApp + SMS).

**Verdict:** Start in the Twilio sandbox for a working demo; go direct-Meta later only if the BSP markup ever matters (it won't at this scale). Requires the same phone-number collection + consent plumbing as SMS.

## SMS — trivial per-message cost, real US regulatory friction

- **Confirmed: SendGrid and Resend do NOT do SMS** (both are email-only APIs).
- **Twilio Programmable SMS:** ~$0.008/segment US + ~$1.15/mo number; **A2P 10DLC registration required** even for hobbyists (Sole Proprietor path exists, no EIN needed; campaign review ~10–15 days; from June 30 2026 requires published privacy-policy + ToS URLs). Toll-free alternative: own verification process, days–weeks.
- **Azure Communication Services SMS:** essentially identical all-in pricing ($2/mo toll-free + ~$0.01/segment all-in) and the **same** US carrier compliance (The Campaign Registry) — Azure doesn't avoid the registration burden, but avoids a new vendor.
- **Verdict:** feasible but budget 1–3 weeks of registration lead time and a privacy-policy page. WhatsApp reaches phones with less recurring regulatory overhead once its one-time setup is done.

## Email — solved problem, near-zero cost

- **SendGrid killed its permanent free tier (July 26, 2025)** — new accounts get a 60-day trial (100/day), then paid from $19.95/mo. This materially weakens SendGrid for a hobby app.
- **Resend:** permanent free tier **3,000 emails/mo (100/day)**; modern API, first-class Next.js/React Email (JSX templates) DX; Pro $20/mo at 50k if ever needed. SPF/DKIM domain verification like everyone else.
- **Azure Communication Services Email:** no free tier but ~$0.00025/email (≈$1.11/mo for 3k emails incl. data); can send from a free `*.azurecomm.net` subdomain without a custom domain; keeps billing inside the existing Azure subscription.
- **Verdict:** **Resend** is the default recommendation (free at this scale, best Next.js DX). **ACS Email** is the Azure-consolidation alternative. SendGrid is now the weakest of the three for this project.

## Cross-channel implications for design
- Twilio is the only single vendor covering **both** WhatsApp and SMS (one SDK, one account); email would still be Resend/ACS.
- WhatsApp and SMS both require: a `phone` field on accounts (none exists today), explicit opt-in consent capture, and E.164 normalization.
- All three channels are plain server-side REST/SDK calls — fully compatible with the "app-level only, no Supabase-coupled mechanisms" constraint in `task.md`.

## Uncertainties
- Exact current WhatsApp US utility rate ($0.0034 vs ~$0.006 across sources); check Meta's live rate card.
- Whether an *unverified* Meta Business Manager (2-number cap) is sufficient for low-volume production sending, or full business verification is forced — confirm in the onboarding flow.
- ACS SMS compliance timelines assumed similar to Twilio's (same registry) but not independently confirmed.

## Key sources
- Meta: WhatsApp pricing — developers.facebook.com/documentation/business-messaging/whatsapp/pricing
- Meta: template categorization — developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-categorization
- Twilio: WhatsApp sandbox — twilio.com/docs/whatsapp/sandbox; WhatsApp pricing — twilio.com/en-us/whatsapp/pricing
- Twilio: A2P 10DLC quickstart — twilio.com/docs/messaging/compliance/a2p-10dlc/quickstart
- Twilio changelog: SendGrid free plan retirement — twilio.com/en-us/changelog/sendgrid-free-plan
- Microsoft Learn: ACS SMS pricing / ACS Email pricing — learn.microsoft.com/en-us/azure/communication-services/concepts/
- Official Meta Node SDK — github.com/WhatsApp/WhatsApp-Nodejs-SDK
