# Research Questions

## Context
Focus on the XP (experience points) subsystem of the web app: the character data
model and the embedded XP log, the server data modules and API routes that read or
mutate a character's XP, the authorization helpers that gate those actions, and the
UI that displays and edits XP. Relevant areas include `packages/types`,
`apps/web/src/lib/data/`, `apps/web/src/lib/api/`, `apps/web/src/app/api/characters/[id]/`,
`apps/web/src/lib/authz.ts`, and the character-sheet and campaign-overview components.

## Questions

1. How is a character's XP stored, and what is the shape of the XP log entry? Trace the
   `xp` field and the `xpLog` array from the shared domain types through the Cosmos
   document type and the doc↔domain mappers, including every value of the XP log source
   enum and every field on a log entry.

2. Trace every server-side code path that mutates a character's XP end to end (from HTTP
   route to data module to document write). For each, describe what input it accepts
   (absolute total vs. delta), how it computes and records the log entry, and what
   validation it applies.

3. How is authorization enforced for each XP mutation and for reading the XP log? Detail
   the helpers involved (owner assertion, DM-of-account predicate, character-read
   predicate), where each is invoked, and any inline checks such as self-award rules.

4. How does the XP log read-and-display path work? Trace fetching the log, sorting,
   resolving actor IDs to names, and how the history page renders each entry including
   source labels and icons.

5. How does the character-sheet UI let a user change XP today? Trace the XP edit control
   in the header — its open/close state, how it collects input, the optimistic update,
   and the client API call it invokes — plus the DM-facing XP award panel in the
   campaign overview.

6. What existing tests cover XP mutation and the XP log, and what behaviors and edge
   cases do they assert (validation, log-entry contents, authorization outcomes)?
