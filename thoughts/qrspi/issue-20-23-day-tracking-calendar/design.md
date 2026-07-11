# Design Discussion

Issues #20 (track day / skill reset) + #23 (Dolmenwood calendar / moon phases), designed together around one shared concept: a DM-controlled in-world current date.

## Current State

- **No in-world time model exists.** No day counter, in-world date, or downtime field on `CharacterDoc` or `CampaignDoc` (research Q2; `web/lib/cosmos/types.ts:122-162`, `:197-211`). All date fields are real-world timestamps.
- **Only per-day reset is spells.** The `rest` op (`web/lib/data/spells.ts:109-113`) zeroes `slotsUsed` and clears `spellPreparations` — manual, per-character, triggered by the 🌙 Rest button (`SpellSlotsSection.tsx:25-33`). HP has no rest op. No other per-day resources exist.
- **Campaign shared state is embedded arrays on `CampaignDoc`** (sessions, proposals, partyMounts), mutated via `replaceCampaignWithRetry` (`web/lib/data/campaigns.ts:34-55`) with per-write authorize predicates; `isCampaignDM` (`web/lib/authz.ts:56-57`) gates DM-only writes.
- **Campaign page already knows members' characters** via `charactersByOwner` roster query (`web/lib/data/campaigns.ts:147-185`).
- **Static game data lives in `packages/rules-engine/src/data/*.json`** with paired typed accessor modules, barrel-exported (`packages/rules-engine/src/index.ts:1-11`) — no DB, no seeding.
- **`lib/calendar.ts` is real-world Gregorian only** (session scheduling); untouched by this feature.
- **Calendar source data available:** `Dolmenwood Calendar.pdf` (repo root) — 12 months, 7-day week, 352-day year, fixed new/full moon days, solstices/equinoxes (full structure in research.md appendix).

## Desired End State

1. `CampaignDoc` carries an in-world `currentDate` (`{ year, month, day }`), null until the DM sets it.
2. DM (referee only) can **set** the date and **advance** it by one day from a campaign-overview widget; all participants see the current date, weekday, season, and moon phase.
3. When the day advances, players see a per-character "rest" call-to-action on the campaign page (opt-in); clicking runs the existing spells `rest` reset and stamps the character as rested for that date, so the CTA clears.
4. Calendar math (month lengths, wysendays, weekday cycle, moon phase, solstices) lives in `packages/rules-engine` as reference data + pure functions.

**Verification:** DM sets date → widget shows "4 Grimvold, Moot — New Moon 🌑, Onset of Winter"; DM advances past month end → rolls into next month correctly (incl. wysendays, which have no weekday); player with used spell slots sees rest CTA after advance, clicks it, slots reset, CTA disappears; non-DM sees no set/advance controls and POST as non-DM returns 403.

## Patterns to Follow

- **Reference data:** new `packages/rules-engine/src/data/calendar.json` + `calendar.ts` accessor + `export *` in `index.ts` — exactly the `advancement.ts:1` / `kindreds.ts:1` pattern. Do NOT use the Cosmos `catalog_items` mechanism (that exists for legacy-migrated data; JSON-in-package is the primary pattern).
- **Campaign mutation:** new ops via `replaceCampaignWithRetry(campaignId, authorize, mutate)` (`campaigns.ts:34-55`); authorize = `isCampaignDM` throw-forbidden, mirroring `assertCanEdit` strictness (`schedule.ts:73-75`), not the looser participant gate.
- **Vertical slice:** data module function(s) in `web/lib/data/campaigns.ts` (or small `calendar-day.ts`), thin route under `web/app/api/campaigns/[id]/`, client wrapper in `web/lib/api/`, following the schedule slice (`schedule/route.ts:7-28`).
- **Character rest stamp:** extend the existing magic `rest` op (`spells.ts:109-113`) to accept an optional in-world date and write `lastRestDate` on `CharacterDoc` — mutation stays inside `mutateOwnedCharacterDoc`, same as every character write.
- **Op-dispatch POST** for the two campaign mutations (`{ op: 'setDate' | 'advanceDay' }`), matching the `MagicOp` convention (`spells.ts:62-71`).
- **Anti-pattern to avoid:** the deep JSON import bypassing the rules-engine barrel (`Step13Details.tsx:6`) — consume calendar data only through accessor functions.

## Design Decisions

1. **DM controls the day** *(user decision)*: `currentDate` lives on `CampaignDoc`; only `refereeId` may set/advance; participants read. Matches embedded-shared-state + ETag-retry architecture.
2. **Opt-in rest, not auto-reset** *(user decision)*: advancing the day never mutates character docs. Campaign overview lists the viewer's own characters (from existing roster) with a "Rest" button when `character.lastRestDate ≠ campaign.currentDate`; button calls the existing `resetSpellsForRest` (extended to stamp the date). Avoids DM-writes-player-docs concerns entirely; character sheet untouched.
3. **Reference data scope** *(user decision)*: months (name, season label, day counts, wysenday names), weekday names, new/full moon days, solstices/equinoxes. **Not** feast days, **not** seasonal event dice odds — later additions to the same JSON if wanted.
4. **UI = campaign overview widget** *(user decision)*: date + weekday + season + moon-phase card; DM additionally gets "Advance day" and "Set date…" controls. No dedicated calendar page/month grid in this pass.
5. **Date shape:** structured `{ year: number; month: 1-12; day: number }`, not an ordinal day counter — human-readable in the doc, trivially rendered, and the rules-engine owns `advanceDay(date)` rollover logic (month lengths vary 28-31 incl. wysendays). Year is a plain integer the DM chooses (the PDF defines no canonical year numbering).
6. **Moon phase derived, not stored:** phase computed from `(month, day)` against the fixed new/full moon table — four buckets (new / waxing / full / waning). No lunar state in Cosmos.
7. **Wysendays are days 29+ with no weekday:** weekday = `(day - 1) % 7` for days 1-28; wysendays render by their proper name (e.g. "Hanglemas") instead of a weekday.

## What We're NOT Doing

- No downtime activity tracking (issue 20's second half) — needs its own design. Not even a days-elapsed counter.
- No auto-reset of any character resource on day advance.
- No HP-on-rest healing, no new per-day ability-use tracking — spells `rest` is the only reset wired up.
- No feast days or seasonal-event dice rolls (Hitching, the Vague, Colliggwyld, Chame) in the data.
- No dedicated in-world month-grid page.
- No changes to real-world scheduling (`lib/calendar.ts`, sessions, proposals).
- Not fixing the orphaned `moonSign` write path (separate small fix if wanted).
- No notifications/SignalR push on day advance — players see the new date on next page load.

## Open Risks

- **Rest stamp on shared `rest` op:** characters can belong to multiple campaigns conceptually (roster is per-owner, not per-campaign). `lastRestDate` is a single stamp; if one account plays the same character in two campaigns with different dates, the CTA logic is approximate. Acceptable — matches the existing global-XP simplification (research: `CharacterDoc.xp` is campaign-agnostic).
- **`currentDate` null state:** widget must handle "no date set" (DM sees "Set date…", players see nothing/placeholder).
- **Transcription accuracy:** month/moon table hand-extracted from the PDF; verify against the PDF during implementation (one-time check, data is static).
- **Advance across wysendays:** `advanceDay` must know each month's true length including wysendays (e.g. Chysting has 31). Pure-function unit tests in rules-engine cover this (`__tests__` pattern already exists per data module).
