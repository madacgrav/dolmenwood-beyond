# Research Questions

## Context
Focus on the campaign scheduling area of the `apps/web` Next.js application: the date-proposal and availability-response flow, campaign membership, and the schedule tab UI. Trace how data moves from the Supabase tables and RPC functions through `apps/web/src/lib/data` to the components under `apps/web/src/components/campaign/schedule/`.

## Questions

1. Trace the full date-proposal / availability flow: how are proposals and per-person availability responses stored, what does the `get_campaign_proposals` RPC return (including how names are attached to responses), and how does that shape reach the client?

2. How does the UI currently render availability responses on a proposal — which components consume the proposal data, what do they display per response, and how do referee and player views differ?

3. How is campaign membership determined — what defines the complete roster of people in a campaign, and where (if anywhere) is that roster with display names currently loaded in the scheduling area or elsewhere in the app?

4. How does the UI refresh after a user casts or changes an availability response — what is the update/reload pattern, and do other users see changes without a manual refresh?

5. What conventions exist in the schedule components (and nearby UI) for rendering lists of people, statuses, or badges — including how RSVP responses on confirmed sessions are displayed, since that's an analogous feature?
