# Research Findings

All paths relative to repo root. Web app paths abbreviated: `web/` = `apps/web/src/`.

## Q1: Which per-character resources are consumable/use-limited, how stored, where reset?

### Findings

**Resources that exist:** spell slots, spell preparations, character HP, retainer HP, mount HP. No generic "ability uses per day" field exists anywhere — grep for `usesPerDay`/`perDay`/`usesRemaining` etc. returns zero matches in `web/`.

**Storage — all embedded on `CharacterDoc`** (container `characters`, partition `/ownerId`):
- `web/lib/cosmos/types.ts:45-50` — `SpellSlotDoc { id, rank, slotsTotal, slotsUsed }`
- `web/lib/cosmos/types.ts:52-58` — `SpellPrepDoc { id, slotRank, spellName, isCast, createdAt }`
- `web/lib/cosmos/types.ts:60-66` — `SpellbookEntryDoc` (spells known; `isMemorized` toggle, not consumed)
- `web/lib/cosmos/types.ts:138-139` — `hpCurrent`/`hpMax` flat on `CharacterDoc`
- Retainer HP `types.ts:90-91`, mount HP `types.ts:76-77` — embedded in `CharacterDoc.retainers`/`.mounts` arrays (`types.ts:156-157`)

**Spell slot mutation path (full trace):**
1. Slot-circle click → `web/components/character-sheet/magic/use-spells.ts:116-122` `toggleSlot()` (optimistic local state + API call)
2. `web/lib/api/spells.ts:85-91` `updateSlotUsage()` → POST `/api/characters/[id]/magic` `{ op: 'updateSlotUsage', ... }`
3. `web/app/api/characters/[id]/magic/route.ts:16-24` POST → `applyMagicOp(id, body)`
4. `web/lib/data/spells.ts:73-161` `applyMagicOp` — op-dispatch switch inside one `mutateOwnedCharacterDoc` call (`:76`); `updateSlotUsage` case at `:103-108` clamps `slotsUsed` to `[0, slotsTotal]`
5. Cosmos ETag-guarded replace (see Q4)

**The `rest` op — the only explicit reset in the codebase:**
- UI: "🌙 Rest" button `web/components/character-sheet/magic/SpellSlotsSection.tsx:25-33` → `use-spells.ts:125-129` `handleRest()`
- Client: `web/lib/api/spells.ts:93-96` `resetSpellsForRest()` → `{ op: 'rest' }`
- Server: `web/lib/data/spells.ts:109-113`:
  ```ts
  doc.spellPreparations = [];
  doc.spellSlots = (doc.spellSlots ?? []).map((s) => ({ ...s, slotsUsed: 0 }));
  ```
- Scope: touches ONLY `spellPreparations` + `spellSlots`. Does not touch HP, retainer/mount HP, spellbook, or inventory. `rest`/`Rest` appears only in the spells vertical.

**HP — no rest/reset op:**
- `web/components/character-sheet/header/HPBar.tsx:19-29` — manual +/-/direct-set → generic `updateCharacter` PATCH
- `web/lib/api/characters.ts:45-55` → `PATCH /api/characters/[id]` → `web/lib/data/characters.ts:125-130` `updateCharacter` → `applyCharacterUpdates`
- `web/lib/data/mappers/character.ts:142-164` — `UPDATABLE_FIELDS` whitelist includes `hpCurrent`/`hpMax`
- No server op resets `hpCurrent` to `hpMax`.

**Retainer/mount HP — manual standalone ops, no reset:**
- `web/lib/data/retainers.ts:86-96` `updateRetainerHP` (clamps to `[0, hpMax]`)
- `web/lib/data/mounts.ts:77-87` `updateMountHP` (clamps to `[0, ∞)` — no hpMax clamp)

**Spell slot totals re-sync after level-up:** `use-spells.ts:67-89` compares stored `slots_total` vs rules-engine table on load, issues `updateSlotTotals` ops (`web/lib/data/spells.ts:96-102`).

## Q2: `moonSign` and any in-game time model

### Findings

**Definition:**
- `packages/types/src/index.ts:74` — domain `Character.moonSign?: string`
- `web/lib/cosmos/types.ts:133` — `CharacterDoc.moonSign: string | null`

**Write paths — effectively none:**
- `web/lib/data/mappers/character.ts:112` — `newCharacterToDoc()` hardcodes `moonSign: null`; `NewCharacterInput` (`character.ts:81-97`) has no `moonSign` field
- `web/lib/data/mappers/character.ts:142-155` — `UPDATABLE_FIELDS` excludes `moonSign`; PATCH can never set it
- JSON import UI (`web/app/(app)/characters/new/import/page.tsx:29,79`) parses `moonSign` client-side, but the value is dropped at persistence because `newCharacterToDoc` ignores it. **Every stored `moonSign` is `null`.**
- Manual/auto creation wizards have no moonSign field at all
- `scripts/lib/transform.ts:76` — one-off Supabase migration mapping `moon_sign` → `moonSign`

**Read/display:**
- `web/lib/data/mappers/character.ts:33` — `docToCharacter` maps `doc.moonSign ?? undefined`
- `web/lib/pdf/character-sheet.ts:79` — `set('Moon Sign', c.moonSign)` on PDF export. **Only render site in the app**; zero matches in `web/components`.

**In-game time model: none.**
- Repo-wide grep (`downtime|elapsed|in-world|game.?day|moon.?phase|lunar|calendar` in `*.ts`): 0 matches in implementation code
- `web/lib/cosmos/types.ts`: no day/date/downtime/turn fields on `CharacterDoc` (:122-162) or `CampaignDoc` (:197-211)
- All date/time fields found are real-world: `createdAt`/`updatedAt` audit stamps, `SessionEntryDoc.scheduledAt`/`ProposalEntryDoc.scheduledAt` (:177,187), `LevelUpLogDoc.timestamp` (:114), `BankLedgerEntryDoc.createdAt` (:107), `SessionNote.date` (`packages/types/src/index.ts:90`, free-text recap field)

## Q3: Campaign-scoped shared state — model, storage, authz

### Findings

**Model:** single `CampaignDoc` per campaign (container `campaigns`, partition `/id`), `web/lib/cosmos/types.ts:197-211`: `refereeId` (DM account), `inviteCode`, `members[]`, `partyMounts[]`, `sessions?: SessionEntryDoc[]`, `proposals?: ProposalEntryDoc[]`, `_etag`. Sessions/proposals are **embedded arrays, no separate containers** (`SessionEntryDoc` :174-182, `ProposalEntryDoc` :184-194).

**Authz helpers** (`web/lib/authz.ts`):
- `isCampaignMember` :53-54, `isCampaignDM` :56-57 (`refereeId === accountId`), `isCampaignParticipant` :59-60 (member OR DM)
- `assertCampaignParticipant` :63-71 — point-read (`fetchCampaignDoc` :42-51) → 404/403/doc
- `isDMOfAccount` :98-105 — DM-of-a-campaign-containing-target; used for cross-cutting character access (`canReadCharacter` :108-111, XP awards, bank)

**Mutation primitive:** `web/lib/data/campaigns.ts:34-55` `replaceCampaignWithRetry(campaignId, authorize, mutate)` — point-read → caller-supplied `authorize(doc, me)` → `mutate(doc)` in place → ETag `IfMatch` replace → retry ≤3 on 412 (re-read + re-authorize + re-mutate each attempt).

**READ trace (schedule):** `web/app/api/campaigns/[id]/schedule/route.ts:7-10` GET → `web/lib/data/schedule.ts:39-42` `getCampaignSchedule`: `requireAccountId()` → `assertCampaignParticipant` → `sessionsToUi` (:19-37) sorts by `scheduledAt`, resolves display names, reshapes to snake_case API shape.

**WRITE trace (create session):** route POST :16-28 → `schedule.ts:44-70` `createSession`: local validation (`badRequest`) → `replaceCampaignWithRetry` with `authorize` = participant check (:54-56), `mutate` appends new `SessionEntryDoc` (:57-68).

**Authorize predicates vary per write:** edit/delete session restricted to `createdBy` or `refereeId` (`assertCanEdit` `schedule.ts:73-75`); `joinCampaign` uses `authorize: () => undefined` with guard inside mutate (`campaigns.ts:94-119`); `awardXP` (`campaigns.ts:254-269`) mutates the **character** doc via `mutateCharacterDoc`, gated by `isDMOfAccount`.

**`CharacterCampaignData` is dead:** defined only in `packages/types/src/index.ts:100-106` + PRD; no Cosmos doc type, no usage in `web/`. XP is a single global `CharacterDoc.xp` (`types.ts:136`), not per-campaign.

## Q4: Server-tier pattern end to end (magic/spells slice)

### Findings

Six layers, each with a single responsibility:

1. **Client hook** — `web/components/character-sheet/magic/use-spells.ts` (`'use client'`): state + optimistic updates, calls only `lib/api/spells` functions
2. **Client API wrapper** — `web/lib/api/spells.ts`: `magicOp<T>()` (:40-48) single POST dispatcher; each exported mutation is a thin op-tagged call; snake_case UI types preserved from Supabase era
3. **API route** — `web/app/api/characters/[id]/magic/route.ts`: GET :7-14 / POST :16-24, zero business logic — parse → data module → `NextResponse.json`, errors via `handleRouteError` (`web/lib/http.ts`)
4. **Data module** — `web/lib/data/spells.ts`: `fetchMagicData` :57-60 (auth + shape), `applyMagicOp` :73-164 (op switch inside one `mutateOwnedCharacterDoc`), doc↔UI mappers :17-41, `MagicOp` discriminated union :62-71
5. **Authz** — `web/lib/authz.ts`: `HttpError` :10-14 + `forbidden`/`notFound`/`badRequest` :16-18; `assertCharacterOwner` :114-133 — 1-RU point-read `(characterId, accountId)` hot path, cross-partition fallback + owner assert
6. **Cosmos mutation** — `web/lib/data/characters.ts`: `mutateOwnedCharacterDoc` :63-69 → `mutateCharacterDoc` :41-60 — read-authorize-mutate loop, `replace(doc, { accessCondition: { type: 'IfMatch', condition: doc._etag } })`, retry ≤3 on 412. `fetchAuthorized` injected per call site so same loop serves owner-only and owner-or-referee (bank) mutations.

Same triad (`lib/data/X.ts` + `lib/api/X.ts` + `app/api/.../route.ts`) repeats for inventory, retainers, level-up, mounts, bank, schedule, proposals, notifications.

## Q5: Static reference data — storage, seeding, loading

### Findings

**Mechanism A — `packages/rules-engine` JSON-in-package (primary):**
- Data: `packages/rules-engine/src/data/*.json` — `class-advancement`, `kindreds`, `skills`, `spell-slots`, `spells`, `equipment`, `name-tables`. Hand-authored, committed, no seed step.
- Pattern: paired `.ts` accessor per JSON — `advancement.ts:1`, `kindreds.ts:1`, `skills.ts:1`, `spells.ts:1-2` each `import xData from './data/x.json'` and export typed getters (`getClassData`, `getSpellSlots`, `ALL_KINDREDS`, …)
- Barrel: `packages/rules-engine/src/index.ts:1-11` `export * from` each module; consumers import `@dolmenwood/rules-engine`
- Resolution: `package.json:5-6` main/types point at `./src/index.ts` (no build step); `tsconfig.base.json:17` `resolveJsonModule: true`
- Unwired: `equipment.json` imported nowhere; `name-tables.json` deep-imported bypassing barrel at `web/components/wizard/steps/Step13Details.tsx:6`
- Adding a dataset = new JSON in `data/` + paired accessor `.ts` + `export *` line in `index.ts`. No DB, no fetch — bundled at build time.

**Mechanism B — Cosmos `catalog_items` container (one instance):**
- `web/lib/cosmos/types.ts:236-250` `CatalogItemDoc`, partition `/itemType`
- Reader `web/lib/data/catalog.ts:5-10` `listCatalogItems()` (`SELECT * FROM c ORDER BY c.name`); route `web/app/api/catalog/route.ts:4-12`; consumed via `fetch('/api/catalog')` in `web/components/character-sheet/inventory/use-add-item.ts:31`
- Seed: `scripts/seed-catalog.ts:1-79` — manual one-off (`npx tsx`), reads legacy Supabase Postgres, upserts into Cosmos with snake→camel remap. No scheduled invocation.
- Adding a dataset = new `XDoc` type + `lib/data/x.ts` reader + route + manual seed script.

## Q6: `lib/calendar.ts` and scheduling — real-world or in-world?

### Findings

**Entirely real-world Gregorian.** `web/lib/calendar.ts:1-17` full contents: `buildMonthGrid(year, month)` — 42-cell month grid from native `Date`, week starts Sunday; `sameDay(a, b)` — Y/M/D compare. Weekday labels `['Su','Mo',...]` in `SessionCalendar.tsx:15`, `CalendarDatePicker.tsx:6`. No fictional calendar logic anywhere.

**Purpose:** player-availability session scheduling (shared session calendar + RSVP + availability-proposal voting), UI in `web/components/campaign/schedule/*`.

**Date/time representation:**
- Stored: `scheduledAt: string` on `SessionEntryDoc`/`ProposalEntryDoc` (`types.ts:177,187`) — raw `datetime-local` string (`'YYYY-MM-DDTHH:mm'`, no timezone), passed through the route unparsed (`web/app/api/campaigns/[id]/schedule/route.ts:20-24`)
- Sorted lexicographically: `a.scheduledAt.localeCompare(b.scheduledAt)` (`schedule.ts:20-21`, `proposals.ts:37-38`)
- Rendered: `web/lib/format.ts:1-6` `formatSessionDate(iso)` → `toLocaleString('en-US', ...)`; `toDatetimeLocal` :9-13 for edit forms
- Calendar dots: `sameDay(new Date(s.scheduled_at), cell.date)` (`SessionCalendar.tsx:55`)

**Proposal auto-confirm:** `web/lib/data/proposals.ts:128-194` `setProposalAvailability` converts a proposal into a real `Session` once all participants vote available (:160-180), same doc-replace transaction, then notifications (:196-225).

## Cross-Cutting Observations

- **Two write primitives, one shape:** `mutateCharacterDoc` (`characters.ts:41-60`) and `replaceCampaignWithRetry` (`campaigns.ts:34-55`) are parallel read→authorize→mutate→ETag-replace→412-retry loops for the two mutable doc types. Every mutation in the app funnels through one of them.
- **Embedded-array modeling:** all sub-entities (spell slots, preps, retainers, mounts, inventory, bank ledger, sessions, proposals, RSVPs) are arrays embedded on `CharacterDoc` or `CampaignDoc`. No feature has its own container except reference data (`catalog_items`) and top-level entities (accounts, characters, campaigns).
- **Op-dispatch POST convention:** multi-mutation features expose one POST route with a discriminated-union `op` body (`MagicOp`, `spells.ts:62-71`) rather than REST-per-entity.
- **snake_case UI / camelCase doc split:** client-facing types keep Supabase-era snake_case; mappers in data modules translate (`slotToUi` etc., `spells.ts:17-41`).
- **`moonSign` is write-orphaned:** typed in domain + doc, parsed by import validator, but `newCharacterToDoc` hardcodes `null` and `UPDATABLE_FIELDS` excludes it — no live write path; only consumer is the PDF export.
- **Only "day"-like mechanic:** the spells `rest` op — a manual, single-character, spells-only reset. Nothing campaign-wide, nothing time-driven.

## Appendix: Dolmenwood Calendar structure (from `Dolmenwood Calendar.pdf`, repo root)

Official Necrotic Gnome calendar PDF (version 2024-09-23) added to repo root. Extracted structure:

**Week:** 7 named days — Colly, Chime, Hayme, Moot, Frisk, Eggfast, Sunning.

**Year:** 12 months, each = 4 weeks (28 numbered days) + 0-3 intercalary "Wysendays" (named days outside the week cycle, numbered continuing from 28). Total 352 days/year (336 + 16 Wysendays).

| # | Month | Season label | Days | Wysendays | New moon | Full moon | Solar event |
|---|-------|-------------|------|-----------|----------|-----------|-------------|
| 1 | Grimvold | Onset of Winter | 30 | 29 Hanglemas, 30 Dyboll's Day | 4 | 19 | Winter Solstice (19) |
| 2 | Lymewald | Deep Winter | 28 | — | 4 | 18 | — |
| 3 | Haggryme | Fading of Winter | 30 | 29 Yarl's Day, 30 Day of Virgins | 5 | 20 | — |
| 4 | Symswald | Onset of Spring | 29 | 29 Hopfast | 4 | 19 | Vernal Equinox (20) |
| 5 | Harchment | High Spring | 29 | 29 Smithing | 5 | 19 | — |
| 6 | Iggwyld | Fading of Spring | 30 | 29 Shortening, 30 Longshank's Day | 5 | 20 | — |
| 7 | Chysting | Onset of Summer | 31 | 29 Bradging, 30 Copsewallow, 31 Chalice | 4 | 19 | Summer Solstice (18) |
| 8 | Lillipythe | High Summer | 29 | 29 Old Dobey's Day | 3 | 17 | — |
| 9 | Haelhold | Fading of Summer | 28 | — | 3 | 18 | — |
| 10 | Reedwryme | Onset of Autumn | 30 | 29 Shub's Eve, 30 Druden Day | 4 | 19 | Autumnal Equinox (19) |
| 11 | Obthryme | Deep Autumn | 28 | — | 4 | 19 | — |
| 12 | Braghold | Fading of Autumn | 30 | 29 Day of Doors, 30 Dolmenday | 5 | 20 | — |

**Moon phases:** exactly one new moon (day 3-5) and one full moon (day 17-20) per month, fixed dates per the table.

**Saints' feast days:** most days carry a named feast (e.g. Grimvold 1 = Feast of St Vinicus); ~100 across the year, printed per-day in the PDF.

**Random seasonal events** (referee dice rolls noted on the calendar):
- Hitching: 1-in-4 chance beginning Dolmenday (Braghold 30); if begun, ends Grimvold 19
- The Vague: 1-in-10 chance beginning on each Colly of Lymewald and Haggryme
- Colliggwyld: 1-in-4 chance beginning Iggwyld 1; if begun, ends Longshank's Day (Iggwyld 30)
- Chame: 1-in-20 chance beginning on each of Haelhold 1-5

## Open Areas

- Whether any Cosmos production data has non-null `moonSign` from the one-off Supabase migration (`scripts/lib/transform.ts:76`) — can't determine from code alone.
- ~~Dolmenwood in-world calendar structure exists nowhere in the repo~~ — resolved: `Dolmenwood Calendar.pdf` now in repo root (see Appendix). Full feast-day list per day would still need transcription from the PDF.
- `equipment.json` in rules-engine is unused/orphaned; unclear if intentionally superseded by the Cosmos `catalog_items` container.
