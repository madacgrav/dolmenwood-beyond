# Research Questions

## Context
Focus on three areas of the `apps/web` codebase (a Next.js app on Azure Cosmos DB, Auth.js, Blob, SignalR): (1) how the two user roles are named and threaded through shared types, Cosmos doc shapes, authorization helpers, database/field names, and UI copy; (2) the notification dispatch pipeline — how notification documents are created, enqueued, and delivered across channels; (3) the campaign scheduling flow — sessions and date proposals — and the events within it. Also look at how the app integrates third-party server-side services and manages contact info and opt-in consent.

## Questions
1. Trace how the two user roles are represented end to end: where the role type/enum is declared, every field and value that encodes a role, the authorization helpers that gate behavior by role, and every user-facing string that names a role. Which of these are persisted values in stored documents versus display-only labels?

2. How does the notification pipeline work from creation to delivery? Trace a notification document from the point it is written, through enqueueing into per-channel deliveries, to the code that actually sends each channel. What channels exist, which are implemented, and what is the contract a new channel must satisfy to be added?

3. In the scheduling flow, what discrete events occur between a date first being proposed and a session becoming confirmed? For each event, identify where the state transition happens and whether any notification document is currently created as a side effect.

4. How is user contact information (email, phone) and per-channel opt-in/consent stored, updated, and surfaced in settings? What validation or consent-timestamping exists, and how are opt-ins read at delivery time?

5. What is the established pattern for integrating an external third-party service that requires credentials — how are API keys/config read from environment, where is the client instantiated, how are failures handled, and how is it invoked from server code? Give concrete existing examples.

6. How is background/scheduled processing currently triggered (e.g. draining the notification outbox), how is that endpoint authenticated, and what environment configuration and test scaffolding surround it?
