# Design Discussion

All paths relative to `apps/web/src/`. Line refs from `research.md`.

## Current State

- Campaign-scoped lists are embedded arrays on `CampaignDoc` (container `campaigns`, PK `/id`) — `lib/cosmos/types.ts:227-246`. Existing arrays: `partyMounts`, `sessions?`, `proposals?`, `npcs?`. Optional arrays carry a back-compat comment ("absent on documents created before X — default to []", `types.ts:237-241`).
- The campaign NPCs slice is the newest and cleanest vertical slice and serves as the template end to end:
  - Entry type `NpcEntryDoc` (`types.ts:203-213`) with `NpcStatus` enum (`types.ts:200`).
  - Data module `lib/data/npcs.ts`: `requireAccountId()` + `assertCampaignParticipant` for reads; `replaceCampaignWithRetry` (etag/412 retry, `lib/data/campaigns.ts:37-58`) for writes; `normStatus` clamps invalid statuses; `badRequest('name is required')` validation in data layer.
  - Route pair: `app/api/campaigns/[id]/npcs/route.ts` (GET/POST) + `[npcId]/route.ts` (PATCH/DELETE); thin shells, defaulted body reads, `handleRouteError` (`lib/http.ts:6-12`).
  - Client wrapper `lib/api/npcs.ts`: mutators return `MaybeError` (`{ error: { message } | null }`), `loadNpcs` returns `[]` on failure.
  - UI folder `components/campaign/npcs/`: `NpcTab.tsx` (campaign select, refetch-on-success), `NpcForm.tsx` (controlled create/edit form with status `<select>`), `NpcList.tsx` (status-grouped via `STATUS_ORDER`/`STATUS_META`), `NpcCard.tsx`.
  - Tab registered in `app/(app)/campaign/page.tsx:1-127` (`TabId` union + `tabs` array + conditional render).
- No native checkboxes anywhere; boolean toggles are styled buttons (`ConditionsSection.tsx:1-45`).

## Desired End State

A **Quests** tab on the campaign page. Any campaign participant can:
- Add a quest (title required; optional quest-giver and notes).
- Toggle a quest between active and completed ("check off").
- Edit a quest's fields; delete a quest.
- See quests grouped by status (Active first, then Completed), with who added them.

Verification: create/edit/complete/uncomplete/delete a quest as DM and as player in a shared campaign; entries persist on the campaign doc; non-participants get 403; two concurrent writes both land (412 retry).

## Data Model

```ts
export type QuestStatus = 'active' | 'completed';

/** Campaign quest log entry, embedded on the campaign. */
export interface QuestEntryDoc {
  id: string;            // crypto.randomUUID() server-side
  title: string;
  giver: string;         // Free text — who gave the quest. Optional in UI, stored as '' when empty.
  status: QuestStatus;
  note: string;          // Freeform notes about the quest
  addedBy: string;       // account id
  createdAt: string;
  updatedAt?: string;
}
```

- `quests?: QuestEntryDoc[]` added to `CampaignDoc` with the standard back-compat comment; `?? []` at every read.
- Status enum (not boolean) per decision Q1-B: two values now, extensible (`'failed'`, `'abandoned'`) without a migration later. "Check off" = PATCH toggling `status` between `'active'` and `'completed'`.
- Field naming mirrors `NpcEntryDoc` exactly (`note` singular, `addedBy`, `createdAt`/`updatedAt?`).

## Patterns to Follow

1. **Vertical slice, NPC-shaped** — copy the npcs slice structure file-for-file:
   - `lib/cosmos/types.ts`: `QuestStatus` + `QuestEntryDoc` + `quests?` on `CampaignDoc`.
   - `lib/data/quests.ts`: `getCampaignQuests`, `addQuest`, `updateQuest`, `deleteQuest`, `normStatus`-style clamp, `questsToUi` (sort + `displayNamesFor` for `added_by_name`, snake_case client shape) — mirror `lib/data/npcs.ts:19-110`.
   - Routes: `app/api/campaigns/[id]/quests/route.ts` + `[questId]/route.ts` — mirror npcs routes exactly (thin shells, try/catch → `handleRouteError`).
   - `lib/api/quests.ts`: `QUEST_STATUSES`, `loadQuests`, `createQuest`, `updateQuest`, `deleteQuest`, `errorOf` — mirror `lib/api/npcs.ts:5-67`.
   - `components/campaign/quests/`: `QuestTab.tsx`, `QuestForm.tsx`, `QuestList.tsx`, `QuestCard.tsx` — mirror the npcs components.
   - Register tab in `app/(app)/campaign/page.tsx` (`TabId` + `tabs` array + conditional render; not `dmOnly`).
2. **Writes** via `replaceCampaignWithRetry` (`campaigns.ts:37-58`); validation (`badRequest('title is required')`) before the retry loop, per-entry checks inside `mutate`.
3. **Check-off UI**: styled toggle button per `ConditionsSection.tsx:1-45` idiom (44px target, aria-label) on the quest card — not a native checkbox, not only reachable through the edit form.
4. **Refetch-on-success** client (Q5-A): `refetch()` after successful mutation, per `NpcTab.tsx:43-46,76-103`. `window.confirm` for delete (matches `NpcTab.tsx:76-81`).
5. **Status-grouped list**: `STATUS_ORDER = ['active', 'completed']` + `STATUS_META` labels/colors, per `NpcList.tsx:15-47`. Completed cards visually muted (e.g. strikethrough title / lower opacity).
6. Inline styles with `var(--color-*)`, 44px touch targets, aria-labels — house style throughout.

**Do NOT follow:** the inventory client pattern (`lib/api/inventory.ts:75-101`) — void mutators with no `res.ok` check and optimistic state with no reconciliation. NPC pattern supersedes it.

## Design Decisions

1. **Done state = status enum** (`'active' | 'completed'`), not boolean — reuses NPC's clamp + grouped-list machinery; extensible without migration. Check-off toggles the enum.
2. **Notes = single freeform `note` string** per quest — matches `NpcEntryDoc.note` (`types.ts:209`); one textarea in the form. No timestamped note-entry list.
3. **Permissions = any participant can add/edit/complete/delete** (user decision Q3-B). Read + every mutation gated only by `isCampaignParticipant` (via `assertCampaignParticipant` on reads, `authorize` callback in `replaceCampaignWithRetry` on writes). **No** `assertCanEditNpc`-style creator-or-DM check — this is a deliberate divergence from the NPC slice.
4. **Fields = title + giver + status + note** plus server bookkeeping (`id`, `addedBy`, `createdAt`, `updatedAt?`). `giver` is free text, optional in UI ('' when empty), like `relationship` on NPCs.
5. **Client = refetch-on-success** with `MaybeError` returns — newest pattern, surfaces errors.
6. **Sort**: within each status group, newest first (`createdAt` desc) — quests are chronological, unlike alphabetical NPCs. (Divergence from `npcsToUi`'s `localeCompare` sort; trivial.)

## What We're NOT Doing

- No separate Cosmos container; quests are embedded on the campaign doc like every other campaign list.
- No completed-by / completed-at tracking (only `updatedAt`); add later if wanted.
- No quest ordering/drag-reorder, no priorities, no rewards/XP linkage, no character/session linkage.
- No timestamped multi-note log per quest (Q2-A).
- No SignalR live updates (NPCs/inventory don't have them either).
- No pagination/archival — a campaign's quest list is small; whole array in one doc.
- No DM-only restrictions (Q3-B).

## Open Risks

- **Doc size**: every quest lives on the single campaign doc (Cosmos 2 MB item limit). Same accepted risk as sessions/proposals/npcs; a campaign would need thousands of quests with long notes to matter.
- **Any-participant delete** means a player can delete another player's (or the DM's) quest — accepted per Q3-B, but worth a `window.confirm`.
- **Status enum growth**: if `'failed'` etc. added later, `STATUS_ORDER`/`STATUS_META`/toggle logic all need touching — toggle button assumes exactly two states today.
- `updateNpc`'s PATCH sends the full input object, not a partial (`lib/api/npcs.ts:49-60`); quests will mirror that. The check-off toggle therefore must send the full quest fields (or the data layer must accept partial) — plan phase must pick one; leaning: keep full-input PATCH, toggle sends current fields with flipped status.
