# Structure Outline

## Approach

Four vertical slices, foundation-first. Phase 1 is pure reference data + math in `packages/rules-engine` (no DB, unit-testable in isolation). Phase 2 adds the DM-controlled `currentDate` on `CampaignDoc` end to end (data → route → client → widget read). Phase 3 adds DM set/advance controls. Phase 4 adds the per-character opt-in rest CTA. Each phase is independently valuable: 1 = correct calendar; 2 = date visible; 3 = DM drives it; 4 = resets wired.

---

## Phase 1: Calendar reference data + pure functions (rules-engine)

Static Dolmenwood calendar data and pure date math. No app/DB changes.

**Files**: `packages/rules-engine/src/data/calendar.json` (new), `packages/rules-engine/src/calendar.ts` (new), `packages/rules-engine/src/index.ts` (add `export * from './calendar'`), `packages/rules-engine/src/__tests__/calendar.test.ts` (new)

**Key changes**:
- `interface DwDate { year: number; month: number; day: number }` (month 1-12, day 1..monthLength)
- `interface DwMonth { name: string; seasonLabel: string; weekDays: number; wysendays: string[]; newMoon: number; fullMoon: number; solarEvent?: { name: string; day: number } }` — `weekDays` always 28; `wysendays` names for days 29+
- `calendar.json` — `{ weekdayNames: string[7]; months: DwMonth[12] }` transcribed from `Dolmenwood Calendar.pdf` (research.md appendix table)
- `MONTHS: DwMonth[]`, `WEEKDAY_NAMES: string[]` (accessors over the JSON)
- `monthLength(month: number): number` — `28 + wysendays.length`
- `advanceDay(d: DwDate): DwDate` — increments day, rolls month (1-12) and year on overflow
- `weekdayOf(d: DwDate): string | null` — `WEEKDAY_NAMES[(day-1)%7]` for day ≤28, else `null` (wysenday)
- `dayLabel(d: DwDate): string` — wysenday name if day >28, else weekday name
- `moonPhase(d: DwDate): 'new' | 'waxing' | 'full' | 'waning'` — from month's `newMoon`/`fullMoon`
- `formatDwDate(d: DwDate): string` — e.g. `"4 Grimvold"` / `"Hanglemas, Grimvold"`

**Verify**: `pnpm --filter @dolmenwood/rules-engine test` passes. Tests assert: `advanceDay({y,1,30})` → `{y,2,1}`; advance across Chysting day 31 → Lillipythe 1; advance month 12 day 30 → year+1 month 1; `weekdayOf` day 29 = null; `moonPhase` returns 'new' on each month's newMoon day; 352 total days across the year.

---

## Phase 2: `currentDate` on CampaignDoc + read path + widget

Add nullable in-world date to the campaign, expose it via the schedule/campaign read, render a read-only date+moon card on the campaign overview.

**Files**: `apps/web/src/lib/cosmos/types.ts` (add field), `apps/web/src/lib/data/campaigns.ts` (include in campaign read/UI mapping), `apps/web/src/lib/api/campaigns.ts` (type), campaign overview component under `apps/web/src/components/campaign/overview/` (new `CurrentDateCard.tsx`), plus wherever campaign data is assembled for the overview page.

**Key changes**:
- `CampaignDoc.currentDate?: DwDate | null` — optional, absent/null = "not set" (comment: absent on docs before this phase)
- Campaign UI shape gains `current_date: DwDate | null` (snake_case UI convention per research)
- `CurrentDateCard` renders `formatDwDate` + `dayLabel` + season label + moon-phase glyph; handles null → placeholder ("No date set"). Imports rules-engine accessors ONLY (no deep JSON import).

**Verify**: `pnpm --filter web test && pnpm --filter web typecheck`. Manually: seed/patch a campaign doc with a `currentDate`, load campaign overview, card shows correct weekday + season + moon; unset campaign shows placeholder.

---

## Phase 3: DM set + advance controls (DM-only mutations)

DM-only ops to set and advance the current date, wired to the card. Non-DM sees no controls; non-DM POST is rejected.

**Files**: `apps/web/src/lib/data/campaigns.ts` (two functions), `apps/web/src/app/api/campaigns/[id]/calendar/route.ts` (new), `apps/web/src/lib/api/campaigns.ts` (client wrappers), `apps/web/src/components/campaign/overview/CurrentDateCard.tsx` (DM controls)

**Key changes**:
- `setCampaignDate(campaignId: string, date: DwDate): Promise<void>` — `replaceCampaignWithRetry(id, authorizeDM, (doc)=>{ doc.currentDate = date })`
- `advanceCampaignDay(campaignId: string): Promise<DwDate>` — same, `doc.currentDate = advanceDay(doc.currentDate ?? DEFAULT_START)`; validates currentDate set (or defaults to a start date)
- `authorizeDM(doc, me)` = `if (!isCampaignDM(doc, me)) throw forbidden()` (`authz.ts:56-57`)
- Route POST body: `{ op: 'setDate'; date: DwDate } | { op: 'advanceDay' }` (op-dispatch per `MagicOp` convention)
- Client: `setCampaignDate(id, date)`, `advanceCampaignDay(id)` fetch wrappers
- Card: `isDM` prop → render "Advance day" button + "Set date…" (year/month/day inputs)

**Verify**: `pnpm --filter web test`. Manually as DM: set date → card updates; advance → day increments, rolls month at boundary. As non-DM: no buttons; direct `POST /api/campaigns/[id]/calendar` returns 403. ETag-retry path unchanged (reuses `replaceCampaignWithRetry`).

---

## Phase 4: Per-character opt-in rest CTA

On the campaign overview, list the viewer's own characters with a "Rest" button when they haven't rested on the current in-world date. Button runs the existing spells reset and stamps the date.

**Files**: `apps/web/src/lib/cosmos/types.ts` (`lastRestDate` field), `apps/web/src/lib/data/spells.ts` (extend `rest` op), `apps/web/src/lib/api/spells.ts` (pass date), `apps/web/src/lib/data/mappers/character.ts` (map field), roster/overview component (new `RestPrompt.tsx` in `components/campaign/overview/`), campaign overview data assembly (include viewer's characters — reuse `charactersByOwner` at `campaigns.ts:147`).

**Key changes**:
- `CharacterDoc.lastRestDate?: DwDate | null` — optional, absent = never rested
- `MagicOp` `rest` case gains optional `restDate?: DwDate`; op sets `doc.lastRestDate = restDate` alongside existing slot/prep clear (`spells.ts:109-113`)
- `resetSpellsForRest(characterId, restDate?)` — client wrapper passes date through
- `RestPrompt` shows a row per viewer-owned character where `!sameDwDate(char.lastRestDate, campaign.currentDate)`; button → `resetSpellsForRest(charId, currentDate)`; row clears on success
- `sameDwDate(a, b): boolean` — add to rules-engine `calendar.ts` (+ test)

**Verify**: `pnpm test` (all). Manually: character with used spell slots + stale/absent `lastRestDate` shows Rest button after DM advances day; click → slots reset to 0, preparations cleared, button disappears; re-advancing day re-shows the button. Character sheet 🌙 Rest button still works unchanged (no `restDate` = existing behavior; `lastRestDate` left untouched when omitted).

---

## Testing Checkpoints

- **After P1**: `packages/rules-engine` tests green — calendar math correct in isolation, no app dependency. Resumable foundation.
- **After P2**: campaign overview shows the current in-world date/moon (read-only); null-safe. DB field exists.
- **After P3**: DM can drive the date from the UI; authz enforced (403 for non-DM); month/year rollover works live.
- **After P4**: player opt-in rest resets spells and clears against the in-world date. Issues #23 (calendar+moon) and #20-first-half (skill reset) delivered; downtime explicitly deferred.

## Notes on Slicing

- All four slices are cleanly vertical. Phase 1 is the one "horizontal-looking" phase (pure lib, no UI), but it is independently testable and every later phase imports it — foundation, not a layer split.
- `DEFAULT_START` in Phase 3 (the year/date used when a DM advances before ever setting one) is a small open decision — pick a sensible in-world start (year 0/1, Grimvold 1) during planning; the PDF defines no canonical year number (design.md decision 5).
