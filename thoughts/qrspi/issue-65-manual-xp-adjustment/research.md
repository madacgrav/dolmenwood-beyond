# Research Findings

## Q1: How is a character's XP stored, and what is the shape of the XP log entry?

### Findings
- `Character.xp: number` — `packages/types/src/index.ts:75`. Sibling campaign field `CharacterCampaignData.xpEarnedThisCampaign: number` at `packages/types/src/index.ts:101`.
- `XPLogSource` union has exactly three values — `packages/types/src/index.ts:186`:
  ```ts
  export type XPLogSource = 'dm_award' | 'manual_edit' | 'level_up';
  ```
- `XPLogEntry` — `packages/types/src/index.ts:188-196`:
  ```ts
  export interface XPLogEntry {
    id: string;
    timestamp: string;   // server ISO-8601
    delta: number;       // signed; 0 for level_up
    newTotal: number;    // character xp after the mutation
    source: XPLogSource;
    actorId: string;     // DM account id for dm_award; owner id otherwise
    toLevel?: number;    // only on level_up entries
  }
  ```
- Cosmos document: `CharacterDoc.xp: number` (`apps/web/src/lib/cosmos/types.ts:149`) and `CharacterDoc.xpLog?: XPLogEntry[]` (`apps/web/src/lib/cosmos/types.ts:169`) — the log is embedded on the character doc, optional (absent on old docs).
- Mappers (`apps/web/src/lib/data/mappers/character.ts`): `docToCharacter` copies `xp: doc.xp` verbatim (line 37). **`xpLog` is never mapped to any domain type** — not on `Character`, `CharacterWithNotes`, or `FullCharacter`; it is only surfaced via the dedicated `fetchXPLog` read path (Q4).
- Creation: `NewCharacterInput.xp?` (line 93), defaulted `xp: input.xp ?? 0` in `newCharacterToDoc` (line 117). `xpLog` is not initialized on new docs — stays `undefined` until first append; all writers use `[...(d.xpLog ?? []), entry]`.

## Q2: Every server-side XP mutation path end to end

### Findings
Three mutation paths, all appending to the same `xpLog` array in the same document replace as the field mutation (optimistic-concurrency retry loop `mutateCharacterDoc`, `apps/web/src/lib/data/characters.ts:44-63`).

| Path | Route | Input | Delta | `source` |
|---|---|---|---|---|
| `adjustXP` | `apps/web/src/app/api/characters/[id]/adjust-xp/route.ts:7-15` | absolute `{ newTotal }` | computed `newTotal - d.xp` | `manual_edit` |
| `awardXP` | `apps/web/src/app/api/characters/[id]/award-xp/route.ts:7-16` | delta `{ gain }` | caller-supplied `gain` | `dm_award` |
| `levelUp` | `apps/web/src/app/api/characters/[id]/level-up/route.ts:16-31` | no XP field; `xpThreshold` gate | `delta: 0` | `level_up` |

- **`adjustXP`** (`apps/web/src/lib/data/characters.ts:141-157`): validates `Number.isInteger(newTotal) && newTotal >= 0` else 400 (line 142). Computes signed delta from the freshly-read doc (line 145), sets `d.xp = newTotal`, appends `{ delta, newTotal, source: 'manual_edit', actorId: me }` (lines 147-154). Routes coerce with `Number(body?.newTotal)` so non-numeric becomes `NaN` and fails the integer check. Negative deltas (downward corrections) are allowed — only the resulting **total** must be ≥ 0.
- **`awardXP`** (`apps/web/src/lib/data/campaigns.ts:294-317`): validates `Number.isInteger(gain) && gain > 0` else 400 ("XP gain must be positive", line 295) — zero and negative gains rejected. `doc.xp += gain`; log entry `{ delta: gain, newTotal: doc.xp, source: 'dm_award', actorId: me }` (lines 305-315).
- **`levelUp`** (`apps/web/src/lib/data/level-up.ts:22-63`): never writes `xp`; reads it for the threshold gate (`doc.xp < input.xpThreshold` → 400, lines 37-39). Appends zero-delta marker `{ delta: 0, newTotal: doc.xp, source: 'level_up', actorId: me, toLevel: newLevel }` plus a separate `levelUpLogs` entry. Validation: level in [2,15], one-step monotonic, hpGain non-negative integer.
- Generic PATCH (`updateCharacter`, `apps/web/src/lib/data/characters.ts:132-137`) **cannot** change `xp` — it is off the update whitelist (asserted by test, see Q6).

## Q3: Authorization for XP mutations and log reads

### Findings
- Helpers in `apps/web/src/lib/authz.ts`:
  - `assertCharacterOwner(accountId, characterId)` (lines 114-133): 1-RU point read on `(id, ownerId)` partition; falls back to cross-partition fetch + `assertOwner` (403 if not owner, 404 if missing).
  - `isDMOfAccount(dmId, targetAccountId)` (lines 98-105): false if same account; true iff `dmId` referees a campaign containing `targetAccountId`.
  - `canReadCharacter(accountId, doc)` (lines 108-111): owner OR DM-of-owner.
- **`adjustXP`**: owner-only via `mutateOwnedCharacterDoc` (`characters.ts:66-71`) → `requireAccountId` (401 unauthenticated) + `assertCharacterOwner` as the fetch-authorized callback — re-asserted on every ETag-conflict retry. No DM path exists for `adjustXP`.
- **`awardXP`**: inline checks inside the fetch-authorized closure (`campaigns.ts:299-302`): 404 if missing; `if (doc.ownerId === me) throw forbidden()` (no self-award, line 301); `if (!(await isDMOfAccount(me, doc.ownerId))) throw forbidden()` (line 302). Re-run on retries.
- **`levelUp`**: owner-only via `mutateOwnedCharacterDoc` (level-up.ts:33). No DM path.
- **`fetchXPLog`** (read): `canReadCharacter` gate (`apps/web/src/lib/data/xp-log.ts:16`) — owner or DM-of-owner. Contrast: level-up history read (`fetchLevelUpLog`, level-up.ts:76-96) is owner-only.

## Q4: XP log read-and-display path

### Findings
- Server `fetchXPLog` (`apps/web/src/lib/data/xp-log.ts:12-23`): cross-partition doc fetch → `canReadCharacter` gate → sort newest-first by ISO-string compare (`b.timestamp.localeCompare(a.timestamp)`, line 17) → `displayNamesFor(actorIds)` resolves names (`apps/web/src/lib/data/campaigns.ts:160-168`; dedupes, parallel account fetch, `'Unknown'` fallback) → returns `XPLogView { characterName, entries: (XPLogEntry & { actorName })[] }`.
- GET route: `apps/web/src/app/api/characters/[id]/xp-log/route.ts:7-13`. Client wrapper: `apps/web/src/lib/api/xp-log.ts:8-12` (returns `null` on non-OK). `XPLogView` type duplicated in `lib/api/xp-log.ts:3-6` and `lib/data/xp-log.ts:6-9`.
- History page (`apps/web/src/app/(app)/characters/[id]/xp-log/page.tsx`): fetch in `useEffect` (41-55); label/icon maps keyed by `XPLogSource` (lines 12-22): `dm_award` "DM Award" 🎁, `manual_edit` "Manual Edit" ✏️, `level_up` "Level Up" ⬆. `deltaColor` by sign (24-28). Per-entry render (98-139): source icon + label (level_up appends `→ Level N`), "Latest" badge on first entry, `formatDate(timestamp) · by actorName`, signed colored delta, `newTotal` as "total". Skeleton/empty/error states at 81-95.

## Q5: Character-sheet XP edit UI + DM award panel

### Findings
- **Open/close**: `xpEditOpen` state in `CharacterSheetHeader.tsx:12`; XPBar toggle closes the HP editor and vice versa (lines 71, 75-81) — one inline editor open at a time.
- **XPBar** (`apps/web/src/components/character-sheet/header/XPBar.tsx`): text state `xpInputVal` (line 16); editor renders when `!readOnly && xpEditOpen` (line 63). `commitXPInput` (lines 28-38):
  - parses int; ignores NaN/0;
  - **positive input** → runs through `applyXPModifiers` (rules-engine: class prime-ability + kindred bonus) — "Add XP" semantics with live preview `{base} → +{actual} ({mod}% mod)` (96-101);
  - **negative input** → passed through unmodified — UI labels it "Correct XP:" (lines 74-76);
  - calls `onAdjustXP?.(Math.max(0, character.xp + gain))` — converts to an absolute new total, clamped at 0;
  - clears input and closes editor regardless of parse outcome. Bound to Enter key and the `+XP`/`−XP` button (81-93).
- **Page handler** (`apps/web/src/app/(app)/characters/[id]/page.tsx:51-55`): optimistic `setCharacter({...prev, xp: newTotal})` then `await adjustXP(id, newTotal)` (client wrapper `apps/web/src/lib/api/characters.ts:58-65`, POST `{ newTotal }`). The wrapper's error return value is not checked — no rollback/reconcile of the optimistic update at this call site.
- **DM award panel** (`XPAwardPanel.tsx`, mounted in `DungeonMasterView.tsx:251-256`): per-campaign `XPAwardState { showPanel, baseXP, applyModifier, awarding, error, lastAwardAt }` (`overview/types.ts:15-26`) held in `DungeonMasterView.tsx:31-41`. Per-character preview computes modifier-adjusted gain + level-up ⬆️ badge (`XPAwardPanel.tsx:85-115`). Submit `handleAwardXP` (`DungeonMasterView.tsx:91-129`): validates positive int, fires client `awardXP(ch.id, gain)` for all members' characters in parallel `Promise.all`, aggregates failures into one error, refetches campaigns on completion — no optimistic update in this flow.

## Q6: Existing test coverage

### Findings
- **`apps/web/src/test/__tests__/characters-xp.test.ts`** (`adjustXP`):
  - sets XP + appends `manual_edit` entry with signed delta; second call with lower total logs `delta: -50` and appends (length 2) (lines 38-51);
  - rejects negative and non-integer totals with 400; log stays empty on rejection (53-58);
  - rejects non-owner with 403 (60-64);
  - generic PATCH `updateCharacter({ xp: 9999 })` leaves xp unchanged — xp off the PATCH whitelist (66-70).
- **`apps/web/src/test/__tests__/xp-log.test.ts`** (`fetchXPLog`), seeded with dm_award + manual_edit + level_up entries (41-64):
  - owner reads all entries newest-first with actor names resolved (`'Alice'`, `'The Referee'`) (67-75);
  - DM of owner can read (77-82); unrelated account 403 (84-88); characters without a log return `[]` (90-95).
- **`apps/web/src/test/__tests__/campaigns.test.ts`** (`awardXP`, lines 93-120):
  - owner self-award 403; outsider 403; zero gain 400; rejected calls append nothing;
  - referee award succeeds: xp updated, one `dm_award` entry `{ delta, newTotal, actorId: REFEREE.id }`;
  - referee of an unrelated campaign 403.
- **`apps/web/src/test/__tests__/bank-levelup.test.ts`** (`levelUp`, lines 113-144+): asserts the zero-delta `level_up` xpLog entry `{ delta: 0, newTotal: 2000, toLevel: 2 }` in the same replace; rejects non-monotonic/out-of-range levels and unmet thresholds with 400.

## Cross-Cutting Observations
- All XP writers follow one pattern: mutation + log append in a single doc replace inside the `mutateCharacterDoc` optimistic-concurrency retry loop, with authz in the fetch-authorized callback so it re-runs on retries.
- The log is append-only in practice: no code path edits or deletes `xpLog` entries; corrections are represented as new signed-delta entries.
- Semantic split baked into the current design: **owner** = absolute set (`manual_edit`, signed delta derived server-side, negative allowed, total floor 0); **DM** = positive delta only (`dm_award`, no self-award); level-up = zero-delta marker.
- XP modifier math (`applyXPModifiers`, kindred bonus, thresholds) lives in `packages/rules-engine` and is applied **client-side** before submission in both UIs (XPBar positive input, XPAwardPanel with checkbox opt-out); the server stores raw numbers only.
- The XPBar already exposes both "Add XP" (modifier-applied) and "Correct XP" (raw negative) semantics through one input, converting both to an absolute total for the same `adjust-xp` endpoint.
- DM read access to the XP log exists (`canReadCharacter`); DM write access is limited to positive `awardXP` — no DM path to lower or set a character's XP.
- Optimistic update on the sheet page ignores the API error return; the DM panel instead refetches after submit.

## Open Areas
- `bank-levelup.test.ts` beyond line 144 wasn't fully read; likely asserts the unmet-XP-threshold case but unconfirmed.
- `CharacterCampaignData.xpEarnedThisCampaign` (`packages/types/src/index.ts:101`) — no mutation path for it surfaced in this research; its relationship to the XP log is unexplored.
