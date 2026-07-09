# Task

Add outbound email, SMS, and WhatsApp notifications from the app.

**Provider decision (made 2026-07-09, see `provider-research.md`): Resend for email; Twilio for WhatsApp and SMS.** SendGrid is ruled out (free tier retired July 2025; no SMS). Twilio was chosen because it is the single vendor covering both WhatsApp and SMS with one SDK/account, and its WhatsApp sandbox allows prototyping before Meta business verification. Notifications should be wired to existing in-app notification events (e.g., a scheduling proposal being confirmed). Scope includes provider evaluation/integration, delivery triggering, and whatever user contact info and preference plumbing is needed (note: no phone number field exists today, and SMS delivery would need a provider beyond SendGrid/Resend, which are email-focused).

**Constraint: the project plans to migrate off Supabase (to Azure Cosmos DB — see `thoughts/qrspi/2026-07-09-cosmosdb-migration/`).** The notification design must not deepen Supabase coupling: avoid Postgres triggers/SECURITY DEFINER functions, Supabase Edge Functions, Database Webhooks, or Realtime as the delivery trigger mechanism. Prefer app-level (Next.js server-side) code paths and provider integrations that survive a database swap.
