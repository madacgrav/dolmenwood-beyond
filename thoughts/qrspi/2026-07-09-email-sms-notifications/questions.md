# Research Questions

## Context
Focus on the in-app notification mechanism (the `notifications` table, its generating triggers in `supabase/migrations/`, and the `NotificationBell` UI), user account/contact data, the settings area, and the app's server-side execution surfaces (API routes, server actions, middleware) plus environment/secret configuration across local dev, Docker, CI, and Azure. Trace how events become notification records and where server-side code could run in response to them.

## Questions

1. What is the existing in-app notification mechanism: how are notification records generated (which events, which functions/triggers), what shape do they have, how are they scoped per user, and how are they surfaced and marked read in the UI?

2. What server-side execution surfaces exist in the app — API route handlers, server actions, middleware, or any background/scheduled mechanisms — and what patterns do they follow for auth and database access?

3. Where is user contact information stored and accessed — what does the `accounts` table hold (email, display name), how is it populated from the auth system, and what does the settings/profile area currently let users view or edit?

4. How are third-party service credentials and environment variables configured and threaded through local development, docker-compose, GitHub Actions CI, and the Azure Bicep deployment — including how secrets reach the running app?

5. What email capability exists today via Supabase Auth (confirmation, password reset) — how is it configured, and what URL/site settings does it rely on?

6. What patterns exist in the codebase for user-level preferences or per-user settings, and how are they stored and edited — is there anything a notification opt-in/opt-out preference could follow?
