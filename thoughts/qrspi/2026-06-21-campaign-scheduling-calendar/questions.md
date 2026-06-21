# Research Questions

## Context
Focus on the Dolmenwood Beyond monorepo: the Next.js 15 App Router web app under `apps/web/src/`, the Supabase migrations under `supabase/migrations/`, and shared types under `packages/types/`. Areas of interest are the campaign/party domain, the Supabase data-access and RLS layer, Realtime usage, App Router routing/navigation, and shared UI primitives.

## Questions
1. How is campaign membership modeled and enforced? Trace the `campaigns`, `campaign_members`, and `accounts` tables, the `referee_id` / role distinction, and the RLS helper functions (`is_campaign_member`, `is_campaign_referee`) — including how RLS policies on campaign-scoped tables are written and how the earlier RLS-recursion fix shaped that pattern.

2. What is the established pattern for adding a new Supabase migration? Examine the migration file naming/ordering convention, how tables, RLS policies, triggers, and `updated_at` handling are defined, and how recent migrations add new campaign-scoped tables (e.g. `bank_ledger`).

3. How are server-side RPC functions defined and invoked? Trace examples such as `create_campaign`, `join_campaign`, `award_xp`, `bank_transaction`, and `get_campaign_party_data` — how they are written in SQL (SECURITY DEFINER, grants/revokes) and how the frontend calls them through `src/lib/data/` modules.

4. How does data flow from Supabase into the UI for a campaign-scoped feature? Follow `src/lib/data/campaigns.ts` and a representative feature tab (e.g. `BankingTab`, `OverviewTab`) through their data modules, Zustand stores, and the referee-vs-player view switching in `OverviewTab` / `campaign/page.tsx`.

5. How is Supabase Realtime currently used, and what date/time handling exists? Examine the `use-characters.ts` channel subscription pattern, any timestamp/`updated_at` conventions in the schema, and existing date-formatting utilities (e.g. `formatWPDate` in `wordpress.ts`).

6. What are the routing, navigation, and shared-UI conventions for adding a feature surface? Map the `(app)` route group structure, how `BottomNav` registers tabs, the existing `/campaign` tabbed page and `/party` stub, and the reusable form/modal/card components used by existing features.
