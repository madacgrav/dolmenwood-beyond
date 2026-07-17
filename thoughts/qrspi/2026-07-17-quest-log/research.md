# Research Findings

All paths relative to `apps/web/src/`.

## Q1: Campaign NPCs feature end to end (route → data module → Cosmos embedded array)

### Findings
- NPCs live as embedded array `npcs?: NpcEntryDoc[]` on `CampaignDoc` (container `campaigns`, partition key `/id`) — `lib/cosmos/types.ts:240-241`.
- **Routes** are thin shells; auth + validation live in the data module:
  - `GET app/api/campaigns/[id]/npcs/route.ts:7-14` — awaits `params`, calls `getCampaignNpcs(id)`, returns `{ npcs }`.
  - `POST route.ts:16-30` — `await request.json()`, reads fields with defaults (`body?.name`, `body?.relationship ?? ''`, `body?.status ?? 'unknown'`, `body?.note ?? ''`), calls `addNpc`, returns `{ ok: true }` 201.
  - `PATCH app/api/campaigns/[id]/npcs/[npcId]/route.ts:7-21` — same defaulted body parse, calls `updateNpc(id, npcId, {...})`, returns `{ ok: true }`.
  - `DELETE [npcId]/route.ts:23-31` — calls `deleteNpc(id, npcId)`.
  - Every handler wraps in try/catch → `handleRouteError(e)` (`lib/http.ts:6-12`): `AuthError`/`HttpError` → `{ error: message }` with its status; anything else → `console.error` + 500.
- **Account resolution** is inside data functions, not routes: `requireAccountId()` (`lib/auth/session.ts:17-21`) reads NextAuth `auth()` session, throws `AuthError` (401) if no `session.user.id`.
- **Data module** `lib/data/npcs.ts`:
  - `STATUSES` + `normStatus(s)` clamp unknown status strings to `'unknown'` (`npcs.ts:19-23`).
  - `npcsToUi(doc)` (`npcs.ts:25-38`): sorts by name (`localeCompare`), batch-resolves `addedBy` display names via `displayNamesFor`, maps to snake_case client shape (`campaign_id`, `added_by`, `added_by_name`).
  - `getCampaignNpcs` (`npcs.ts:40-43`): `requireAccountId()` → `assertCampaignParticipant(campaignId, me)` → `npcsToUi(doc)`. Read path, no retry helper.
  - `addNpc` (`npcs.ts:45-67`): validates `input.name.trim()` (throws `badRequest('name is required')`) **before** fetching doc; then `replaceCampaignWithRetry` with `authorize` = participant check, `mutate` = append new entry: `id: crypto.randomUUID()`, trimmed fields, `status: normStatus(...)`, `addedBy: me`, `createdAt: new Date().toISOString()`; `doc.npcs = [...(doc.npcs ?? []), npc]`.
  - `assertCanEditNpc(doc, npc, meId)` (`npcs.ts:70-72`): edit/delete allowed for entry creator (`npc.addedBy === meId`) or DM (`doc.refereeId === meId`). Mirrors campaign-sessions edit rule (comment `npcs.ts:69`).
  - `updateNpc` (`npcs.ts:74-96`): name validation up front; `authorize` callback is a no-op — authorization happens **inside** `mutate` after locating the entry: find by id, throw `notFound('npc')`, `assertCanEditNpc`, mutate entry in place, set `updatedAt`.
  - `deleteNpc` (`npcs.ts:98-110`): same shape; removal via `doc.npcs = (doc.npcs ?? []).filter(n => n.id !== npcId)`.
- **Persistence / concurrency** — `replaceCampaignWithRetry` (`lib/data/campaigns.ts:37-58`):
  - Signature `(campaignId, authorize(doc, me), mutate(doc)) => Promise<CampaignDoc>`.
  - Resolves `me` itself via `requireAccountId()` (line 42) — independent of the caller's earlier call.
  - Loop: point-read `campaigns().item(id, id).read()` → `notFound('campaign')` if missing → `authorize(doc, me)` → `mutate(doc)` → `.replace(doc, { accessCondition: { type: 'IfMatch', condition: doc._etag! } })`.
  - On 412 (etag conflict) with `attempt < 3`, re-reads and re-runs authorize/mutate; up to 4 total attempts, then rethrows raw Cosmos error (becomes generic 500 in `handleRouteError`).
  - Same helper reused by `setCampaignDate` (75-81), `advanceCampaignDay` (84-92), `joinCampaign` (145-155), `insertPackAnimal` (336-347), `removePackAnimal` (350-361).

## Q2: CampaignDoc model and embedded entry types

### Findings
- `CampaignDoc` (`lib/cosmos/types.ts:227-246`), container `campaigns`, partition key `/id`:
  - Required: `id`, `name`, `refereeId` (DM's account id, name kept for storage compat), `inviteCode`, `members: { accountId, joinedAt }[]`, `partyMounts: PartyMountDoc[]`, `createdAt`.
  - Optional: `sessions?: SessionEntryDoc[]`, `proposals?: ProposalEntryDoc[]`, `npcs?: NpcEntryDoc[]`, `currentDate?: DwDate | null`, `_etag?`.
  - Optional arrays documented as "absent on documents created before <feature> — default to []" (`types.ts:237-241`). No `updatedAt` on the campaign doc itself.
- Embedded entry types:
  - `NpcEntryDoc` (`types.ts:203-213`): `id`, `name`, `relationship` (free text), `status: NpcStatus`, `note`, `addedBy`, `createdAt`, `updatedAt?` (only optional field). `NpcStatus = 'alive' | 'dead' | 'missing' | 'unknown'` (`types.ts:200`).
  - `SessionEntryDoc` (`types.ts:190-198`): `id`, `title`, `scheduledAt`, `notes`, `createdBy`, `rsvps[]`, `createdAt`.
  - `ProposalEntryDoc` (`types.ts:215-225`): `id`, `title`, `scheduledAt`, `notes`, `status: 'open' | 'confirmed' | 'cancelled'`, `confirmedSessionId`, `createdBy`, `availability[]`, `createdAt`.
  - `PartyMountDoc` (`types.ts:181-188`): `id`, `name`, `mountType`, `speed`, `addedBy`, `createdAt`.
- Entry id generation: server-side `crypto.randomUUID()` (`lib/data/npcs.ts:56`). (Character-doc sub-lists edited client-side use `generateId()` = `Date.now()`+random — `components/character-sheet/NotesTab.tsx:13-15`.)
- Convention: every doc interface has a `/** Container '<name>', partition key '/<field>'. */` comment (e.g. `types.ts:227`).

## Q3: authz.ts enforcement

### Findings
- Header comment (`lib/authz.ts:4-8`): app-code port of Supabase RLS predicates — "every server data function must call one of these before reading or mutating on a caller's behalf."
- `HttpError` (`authz.ts:10-14`): `Error` subclass with public `status`. Factories: `forbidden()` = 403 (`:16`), `notFound(what='resource')` = 404 (`:17`), `badRequest(msg)` = 400 (`:18`).
- `fetchCampaignDoc(campaignId)` (`authz.ts:42-51`): point-read `.item(id, id).read()`, returns `null` on any error. Only invoked internally by `assertCampaignParticipant` (`authz.ts:67`).
- `isCampaignMember` (`:53-54`) = `members.some(accountId)`; `isCampaignDM` (`:56-57`) = `refereeId ===`; `isCampaignParticipant` (`:59-60`) = member || DM.
- `assertCampaignParticipant(campaignId, accountId)` (`authz.ts:63-71`): 404 if campaign missing, 403 if not participant, else returns the `CampaignDoc` — callers use the returned doc as both authz gate and data source.
- Call-site pattern (identical everywhere): `const me = await requireAccountId(); const doc = await assertCampaignParticipant(campaignId, me);` — `lib/data/npcs.ts:42`, `lib/data/schedule.ts:41`, `lib/data/campaigns.ts:278,326`, `lib/data/proposals.ts:35`.
- Other helpers: `assertOwner` (`:21-23`), `listCampaignsRunByDM` (`:73-81`), `listCampaignsWithMember` (`:83-92`), `isDMOfAccount` (`:98-105`), `canReadCharacter` (`:108-111`), `assertCharacterOwner` (`:114-133`, point-read fast path + cross-partition fallback).

## Q4: Client-side lib/api wrappers and hooks

### Findings
- `lib/api/npcs.ts` — campaign-list wrapper pattern:
  - `NPC_STATUSES` constant (`:5`).
  - `errorOf(res)` (`:27-31`): `res.ok` → `{ error: null }`; else parse body → `{ error: { message: body?.error ?? 'request failed (status)' } }`. All mutators return `MaybeError` (`:25`), never throw.
  - `loadNpcs` (`:33-38`): GET; `!res.ok` → `[]`. `createNpc` (`:40-47`) POST JSON; `updateNpc` (`:49-60`) PATCH full input (not partial); `deleteNpc` (`:62-67`) DELETE.
- `lib/api/inventory.ts` — older pattern; snake_case "kept from the Supabase era" (`:1-5`). Mutators `updateItemQuantity`/`updateItemLocation`/`deleteInventoryItem` (`:75-101`) are `void` and don't check `res.ok` — no failure signal.
- **Two refresh strategies coexist:**
  - **NPC tab: refetch-on-success.** `NpcTab.tsx:43-46` `refetch = loadNpcs → setNpcs`; `handleDelete` (`:76-81`) and `handleSubmit` (`:83-103`) call mutator, then `await refetch()` only when `!error`. No optimistic splice.
  - **Inventory: optimistic local update, no refetch.** `use-inventory.ts:53-69` — `setItems(prev => ...)` immediately, then awaited server call; server response not used for reconciliation. `use-add-item.ts:73-94` `addItem()` calls `insertInventoryItem`, feeds server-returned item to parent's `onItemAdded` callback (`InventoryTab.tsx:25-28` appends to `inv.items`).
- SignalR: not used for NPCs or inventory. Only `hooks/use-characters.ts:32-48` (roster; `characterChanged` event → full refetch) + `app/api/signalr/negotiate/route.ts`.

## Q5: Editable-list UI patterns

### Findings
- **List + row with add/remove/inline edit** (`components/character-sheet/inventory/`):
  - `ItemList.tsx:1-41` — groups items, passes row callbacks (`onToggleLocation`, `onSetQuantity`, `onDelete`) through to `ItemRow`.
  - `ItemRow.tsx:21-32,52-77` — tap-to-edit: local `editing` + `draft` state, `useEffect` re-syncs draft when not editing, commit on blur/Enter; numeric input with `inputMode="numeric"`. Stepper ± buttons (`:13-18,46-51`). Delete `✕` button gated by `isOwner`, `aria-label`, 44px touch targets (`:96-104`).
  - `AddItemForm.tsx:147-156` — Cancel/Add button pair; form state owned by `use-add-item` controller hook.
- **Campaign add/edit form with status select**: `components/campaign/npcs/NpcForm.tsx:1-89` — controlled form; props `{ mode: 'create'|'edit', value, error, loading, onChange(patch), onSubmit, onCancel }`; name input, relationship input + status `<select>` over `NPC_STATUSES`, notes `<textarea rows={3}>`, error line, Cancel/Save buttons; `canSubmit = !!value.name.trim() && !loading`.
  - Parent `NpcTab.tsx:83-103` owns `formValue`/`formError`/`saving`/`editingId`; trims inputs on submit; `window.confirm` for delete (`:76-81`, marked `ponytail:` comment).
- **Boolean toggle as styled button** (no native checkbox in app): `ConditionsSection.tsx:1-45` — `Set` state, `toggleCondition`, active styling via border/background/`color-mix`, `minHeight: 44px`.
- **Notes patterns**: `NotesTab.tsx:18-52` — debounced auto-save textarea (1s timer, `saving`/`saved`/`idle` status). `NotesTab.tsx:55-124` — add/remove note-card list ("+ New" toggle reveals textarea + Save; `×` delete; `filter(n => n.id !== id)`).
- **Section composition + tab registration**: `app/(app)/campaign/page.tsx:1-127` — `TabId` union + `tabs` array with optional `dmOnly` flag; `visibleTabs` filter; conditional render `{activeTab === 'npcs' && userId && <NpcTab userId={userId} />}`. Each section is a folder `components/campaign/<section>/` with `<Name>Tab.tsx` composing form + list + card (e.g. `npcs/NpcTab.tsx` → `NpcForm.tsx` + `NpcList.tsx` → `NpcCard.tsx`).
- `NpcTab` handles multi-campaign: loads `listMyCampaignNames()`, campaign `<select>` if >1 (`NpcTab.tsx:17-60`); `isDM` derived from campaign option's `is_dm`.
- `NpcList.tsx:15-47` — groups by status via `STATUS_ORDER`/`STATUS_META` (label + color per status), empty state `"No NPCs yet."`.

## Q6: Sub-resource route structure, validation, concurrency

### Findings
- Route-pair convention everywhere: collection `.../npcs/route.ts` (GET/POST) + item `.../npcs/[npcId]/route.ts` (PATCH/DELETE). Same shape for mounts, proposals, schedule, inventory, retainers, xp-log.
- Routes do **no** schema validation — defaulted field reads (`body?.x ?? ''`) then delegate; real validation (`badRequest('name is required')`) lives in the data module (`lib/data/npcs.ts:47-48,80-81`).
- Authenticated account resolved in data layer via `requireAccountId()`; routes never touch the session.
- Error mapping centralized: `handleRouteError` (`lib/http.ts:6-12`).
- Concurrency: optimistic-concurrency etag replace with 412-retry loop, `replaceCampaignWithRetry` (`lib/data/campaigns.ts:37-58`) — see Q1. Item-level authz (creator-or-DM) runs inside `mutate` so it re-executes against fresh doc on each retry.

## Cross-Cutting Observations
- **Vertical slice pattern** for a campaign-scoped list: Cosmos embedded array type in `lib/cosmos/types.ts` (+ optional field on `CampaignDoc` with back-compat comment) → data module `lib/data/<x>.ts` (requireAccountId + authz + replaceCampaignWithRetry) → route pair under `app/api/campaigns/[id]/<x>/` → client wrapper `lib/api/<x>.ts` (`MaybeError` returns) → section folder `components/campaign/<x>/` with `<X>Tab.tsx` registered in `app/(app)/campaign/page.tsx`.
- The NPC slice is the newest campaign-list slice; its client uses refetch-on-success (vs inventory's optimistic updates) and its wrapper surfaces errors (vs inventory's void mutators).
- Edit-permission rule for campaign entries: creator or DM (`assertCanEditNpc`, `npcs.ts:70-72`); read access: any participant.
- All list rows use inline styles with CSS variables (`var(--color-*)`), 44px min touch targets, aria-labels.
- No native `<input type="checkbox">` anywhere; boolean toggles are styled buttons.
- `sessions`/`proposals`/`npcs` optional-array back-compat convention: absent on old docs, `?? []` everywhere.

## Open Areas
- `SessionEntryDoc`/`ProposalEntryDoc` edit rules were not traced line-by-line in `lib/data/schedule.ts`/`proposals.ts` (only their `assertCampaignParticipant` call sites confirmed); `npcs.ts:69` comment says NPC edit rule mirrors sessions.
- `displayNamesFor` (batch account-name resolution in `lib/data/campaigns.ts`) internals not examined.
- No tests were located for the NPC slice during this research (test conventions not investigated).
