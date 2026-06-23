# Research Questions

## Context
Focus on the campaign Schedule feature under `apps/web/src/components/campaign/schedule/`, its data layer (`apps/web/src/lib/data/schedule.ts`), and its migration (`supabase/migrations/20260621000023_campaign_scheduling.sql`). Also examine campaign membership (`campaign_members`), the Supabase RPC + Row-Level-Security conventions used across migrations, and any existing email or notification capability in the app and its Supabase configuration.

## Questions
1. How does the campaign scheduling feature currently model data and flow end to end — trace `campaign_sessions` and `session_rsvps` from the migration's tables and RPCs (`get_campaign_schedule`, `set_session_rsvp`) through `lib/data/schedule.ts` to the Schedule tab components (`SessionCalendar`, `SessionList`, `SessionForm`, `RsvpControl`)?

2. What conventions do the Supabase migrations follow for new tables, RPCs, and Row-Level Security — how are membership-guarded reads and per-user upserts written, and how do existing RPCs determine the calling user's identity and authorize access?

3. How is campaign membership represented and queried — how does `campaign_members` relate to `accounts` and `campaigns`, and how does existing code enumerate all members of a campaign or check whether a user belongs to one?

4. What email or notification capability exists today — how is Supabase Auth's built-in email configured (`supabase/config.toml`, password reset / confirmation flows), and is there any application-level mechanism to send arbitrary email or trigger server-side actions (API routes, Server Actions, Supabase Edge Functions, queues)?

5. What patterns does the data-access layer in `apps/web/src/lib/data/` follow — how are typed interfaces defined, how are RPCs vs. direct table queries chosen, and how do components load, mutate, and refresh data (including any optimistic update or re-fetch patterns)?

6. How do the calendar and RSVP UI components manage and display per-user state — how does `RsvpControl` read and write the current user's status, and how do `SessionCalendar` / `SessionList` aggregate and render per-member status (e.g. tallies) across a campaign's members?
