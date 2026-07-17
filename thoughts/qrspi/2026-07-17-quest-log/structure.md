# Structure Outline

## Approach

Copy the campaign NPC vertical slice file-for-file into a `quests` slice, with the design's deliberate divergences (status enum `active`/`completed`, any-participant edit/delete, newest-first sort, `giver` field, on-card check-off toggle). Three phases: server slice (types + data + routes + unit tests), client wrapper + UI, tab registration + manual verification. Each phase is independently testable. Verify commands (run in `apps/web/`): `npm run typecheck`, `npm run lint`, `npm run test`.

---

## Phase 1: Server slice — data model, data module, routes, unit tests

Delivers the full backend: a `quests` array on the campaign doc with add/read/update/delete, gated by campaign participation, persisted through the etag-retry helper. Testable via vitest without any UI.

**Files**:
- `src/lib/cosmos/types.ts` — add types + field
- `src/lib/data/quests.ts` — new data module (mirror `src/lib/data/npcs.ts`)
- `src/app/api/campaigns/[id]/quests/route.ts` — GET/POST (mirror npcs route)
- `src/app/api/campaigns/[id]/quests/[questId]/route.ts` — PATCH/DELETE
- `src/test/__tests__/quests.test.ts` — new (mirror `npcs.test.ts`)

**Key changes**:
- `type QuestStatus = 'active' | 'completed'` — new
- `interface QuestEntryDoc { id; title; giver; status: QuestStatus; note; addedBy; createdAt; updatedAt? }` — new
- `CampaignDoc.quests?: QuestEntryDoc[]` — new optional field, back-compat comment
- `getCampaignQuests(campaignId): Promise<Quest[]>` — read; `assertCampaignParticipant`, `questsToUi` (newest-first sort, `displayNamesFor`)
- `addQuest(campaignId, input): Promise<void>` — validate `title` (`badRequest`), `replaceCampaignWithRetry` with participant `authorize`, append entry (`crypto.randomUUID()`, `normStatus`, `giver`/`note` trimmed, `addedBy`, `createdAt`)
- `updateQuest(campaignId, questId, patch): Promise<void>` — locate entry (`notFound('quest')`), **no creator-or-DM check** (any participant), mutate in place, set `updatedAt`
- `deleteQuest(campaignId, questId): Promise<void>` — filter out, any participant
- `normStatus(s): QuestStatus` — clamp to `'active'` default

**Verify**: `npm run typecheck` + `npm run test` pass. `quests.test.ts` covers: add appends + generates id/createdAt; update mutates + sets updatedAt; status clamps invalid → active; delete removes; non-participant → forbidden; missing quest → notFound; missing name → badRequest.

---

## Phase 2: Client wrapper + UI components

Delivers the client API wrapper and the quest UI (tab body, form, list, card with on-card check-off toggle). Components exist and render but are not yet wired into the campaign page nav.

**Files**:
- `src/lib/api/quests.ts` — new (mirror `src/lib/api/npcs.ts`)
- `src/components/campaign/quests/QuestTab.tsx` — campaign select + refetch-on-success + form show/hide (mirror `NpcTab.tsx`)
- `src/components/campaign/quests/QuestForm.tsx` — controlled create/edit form (title input, giver input, notes textarea; **no status select** — status set via toggle, defaults active on create)
- `src/components/campaign/quests/QuestList.tsx` — status-grouped (`STATUS_ORDER = ['active','completed']`, `STATUS_META`)
- `src/components/campaign/quests/QuestCard.tsx` — quest display + check-off toggle button + edit/delete

**Key changes**:
- `QUEST_STATUSES: QuestStatus[]`, `loadQuests(campaignId): Promise<Quest[]>`, `createQuest(campaignId, input): Promise<MaybeError>`, `updateQuest(campaignId, questId, input): Promise<MaybeError>`, `deleteQuest(campaignId, questId): Promise<MaybeError>` — mirror npcs wrapper (return `MaybeError`, `loadQuests` → `[]` on failure)
- `Quest` client shape: `{ id, campaign_id, title, giver, status, note, added_by, added_by_name, created_at, updated_at }` (snake_case, like `Npc`)
- Check-off = styled toggle button (`ConditionsSection.tsx` idiom); handler sends full-input PATCH with flipped `status` (per design open item), then `refetch()`
- `window.confirm('Delete this quest?')` on delete
- Completed cards visually muted (opacity / strikethrough title)

**Verify**: `npm run typecheck` + `npm run lint` pass. Components compile; no route wiring yet — cannot exercise in-app until Phase 3.

---

## Phase 3: Register Quests tab + end-to-end manual verification

Wires `QuestTab` into the campaign page tab nav so it's reachable, then manual end-to-end check.

**Files**:
- `src/app/(app)/campaign/page.tsx` — add `'quests'` to `TabId`, `{ id: 'quests', label: '📜 Quests' }` to `tabs` (not `dmOnly`), conditional render `{activeTab === 'quests' && userId && <QuestTab userId={userId} />}`, import

**Key changes**:
- `type TabId = ... | 'quests'`
- tab entry + render branch (mirror the `npcs` entry)

**Verify**: `npm run build` succeeds. Manual (dev server, shared campaign): add quest with title+giver+notes → appears in Active; toggle check-off → moves to Completed, card muted; toggle back → Active; edit fields → persist; delete (confirm) → gone. As a non-DM player in the campaign: can add/toggle/delete (per Q3-B). Reload page → state persisted on campaign doc.

---

## Testing Checkpoints

- **After Phase 1**: backend complete and unit-tested. `quests.test.ts` green. Campaign docs gain a `quests` array via the API; participation enforced; etag-retry path shared with NPCs. No user-facing surface yet.
- **After Phase 2**: client wrapper + all quest components compile and typecheck/lint clean. Reusable but unreachable (not in nav).
- **After Phase 3**: Quests tab live on the campaign page; full add/edit/complete/delete flow works end-to-end for any participant and survives reload. `npm run build` green.

## Notes
- No horizontal-only phases: each phase either crosses to a testable boundary (Phase 1 unit tests, Phase 3 UI) or is a self-contained buildable unit (Phase 2 components). Phase 2 can't be exercised in-app alone — that's inherent to "build the component before wiring nav"; it's still independently typecheck/lint-verifiable, and Phase 3 is a tiny wiring phase.
- `giver` free-text field is the only field beyond the NPC template's analog (`relationship`); everything else maps 1:1.
