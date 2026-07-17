# Research Questions

## Context
Focus on the campaign-scoped list features in the Next.js + Azure Cosmos DB app — especially the campaign NPCs slice (`lib/cosmos/types.ts` `NpcEntryDoc`/`CampaignDoc`, `lib/data/npcs.ts`, `app/api/campaigns/[id]/npcs/**`, `lib/api/npcs.ts`, `components/campaign/npcs/**`). Also relevant: the inventory slice (`characters/[id]/inventory`), the authz helper (`lib/authz.ts`), Cosmos access (`lib/cosmos/client.ts`), and existing notes/toggle UI patterns.

## Questions
1. Trace the campaign NPCs feature end to end: how does a request flow from the API route (`app/api/campaigns/[id]/npcs/**`) through the data module (`lib/data/npcs.ts`) to the Cosmos `campaigns` container, and how are add/update/delete operations performed against the embedded `npcs` array on the campaign document?

2. How is the campaign document modeled in `lib/cosmos/types.ts` — what is the shape of `CampaignDoc` and its embedded entry types (`NpcEntryDoc`, sessions, proposals), what fields/timestamps do entries carry, and how are entry ids generated?

3. How does `lib/authz.ts` enforce access for campaign-scoped resources — what do `assertCampaignParticipant`, `fetchCampaignDoc`, `isCampaignDM`/`isCampaignMember`, and the `HttpError` helpers (`forbidden`/`notFound`/`badRequest`) do, and how are they invoked from data modules and routes?

4. What is the client-side data-fetching pattern in the `lib/api/**` wrappers (e.g. `lib/api/npcs.ts`) and any associated hooks (e.g. `use-inventory.ts`) — how do components load, mutate, and refresh a campaign-scoped list?

5. What UI patterns exist for rendering an editable list with add, remove, inline field editing, a boolean/status toggle, and a freeform note field — covering `components/character-sheet/inventory/ItemRow.tsx`, `components/campaign/npcs/NpcForm.tsx`, `ConditionsSection.tsx` (button-style toggle), and the notes textareas in `NotesTab.tsx`?

6. How are campaign sub-resource API routes structured and validated — what do the collection route (`.../npcs/route.ts`, GET/POST) and item route (`.../npcs/[npcId]/route.ts`, PATCH/DELETE) look like, including how the authenticated account is resolved, how the body is validated, and how concurrent writes to the embedded array are handled (e.g. `replaceCampaignWithRetry`)?
