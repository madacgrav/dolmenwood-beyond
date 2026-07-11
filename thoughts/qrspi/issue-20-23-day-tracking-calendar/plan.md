# Implementation Plan

## Overview

A DM-controlled in-world Dolmenwood date on each campaign, shown to all participants with weekday, season, and moon phase; when the day advances, players get an opt-in per-character "rest" that runs the existing spell reset. Calendar math is static reference data + pure functions in `packages/rules-engine`.

Commands (from repo root, pnpm workspace + turbo):
- Rules-engine only: `pnpm --filter @dolmenwood/rules-engine test`
- Web only: `pnpm --filter @dolmenwood/web test` and `pnpm --filter @dolmenwood/web typecheck`
- Everything: `pnpm test` / `pnpm typecheck`

---

## Phase 1: Calendar reference data + pure functions (rules-engine)

### Changes

#### 1. Calendar data
**File**: `packages/rules-engine/src/data/calendar.json`
**Action**: create — transcribed from `Dolmenwood Calendar.pdf` (research.md appendix). Every month has `weekDays: 28`; days 29+ are the named `wysendays`.

```json
{
  "weekdayNames": ["Colly", "Chime", "Hayme", "Moot", "Frisk", "Eggfast", "Sunning"],
  "months": [
    { "name": "Grimvold", "seasonLabel": "The Onset of Winter", "weekDays": 28, "wysendays": ["Hanglemas", "Dyboll's Day"], "newMoon": 4, "fullMoon": 19, "solarEvent": { "name": "Winter Solstice", "day": 19 } },
    { "name": "Lymewald", "seasonLabel": "Deep Winter", "weekDays": 28, "wysendays": [], "newMoon": 4, "fullMoon": 18 },
    { "name": "Haggryme", "seasonLabel": "The Fading of Winter", "weekDays": 28, "wysendays": ["Yarl's Day", "The Day of Virgins"], "newMoon": 5, "fullMoon": 20 },
    { "name": "Symswald", "seasonLabel": "The Onset of Spring", "weekDays": 28, "wysendays": ["Hopfast"], "newMoon": 4, "fullMoon": 19, "solarEvent": { "name": "Vernal Equinox", "day": 20 } },
    { "name": "Harchment", "seasonLabel": "High Spring", "weekDays": 28, "wysendays": ["Smithing"], "newMoon": 5, "fullMoon": 19 },
    { "name": "Iggwyld", "seasonLabel": "The Fading of Spring", "weekDays": 28, "wysendays": ["Shortening", "Longshank's Day"], "newMoon": 5, "fullMoon": 20 },
    { "name": "Chysting", "seasonLabel": "The Onset of Summer", "weekDays": 28, "wysendays": ["Bradging", "Copsewallow", "Chalice"], "newMoon": 4, "fullMoon": 19, "solarEvent": { "name": "Summer Solstice", "day": 18 } },
    { "name": "Lillipythe", "seasonLabel": "High Summer", "weekDays": 28, "wysendays": ["Old Dobey's Day"], "newMoon": 3, "fullMoon": 17 },
    { "name": "Haelhold", "seasonLabel": "The Fading of Summer", "weekDays": 28, "wysendays": [], "newMoon": 3, "fullMoon": 18 },
    { "name": "Reedwryme", "seasonLabel": "The Onset of Autumn", "weekDays": 28, "wysendays": ["Shub's Eve", "Druden Day"], "newMoon": 4, "fullMoon": 19, "solarEvent": { "name": "Autumnal Equinox", "day": 19 } },
    { "name": "Obthryme", "seasonLabel": "Deep Autumn", "weekDays": 28, "wysendays": [], "newMoon": 4, "fullMoon": 19 },
    { "name": "Braghold", "seasonLabel": "The Fading of Autumn", "weekDays": 28, "wysendays": ["The Day of Doors", "Dolmenday"], "newMoon": 5, "fullMoon": 20 }
  ]
}
```

#### 2. Accessor + math
**File**: `packages/rules-engine/src/calendar.ts`
**Action**: create.

```ts
import calendarData from './data/calendar.json';

export interface DwDate { year: number; month: number; day: number } // month 1-12, day 1..monthLength
export interface DwMonth {
  name: string; seasonLabel: string; weekDays: number; wysendays: string[];
  newMoon: number; fullMoon: number; solarEvent?: { name: string; day: number };
}
export type MoonPhase = 'new' | 'waxing' | 'full' | 'waning';

export const WEEKDAY_NAMES: string[] = calendarData.weekdayNames;
export const MONTHS = calendarData.months as DwMonth[];

const monthOf = (m: number): DwMonth => {
  const mo = MONTHS[m - 1];
  if (!mo) throw new RangeError(`invalid month ${m}`);
  return mo;
};

export function monthLength(month: number): number {
  const mo = monthOf(month);
  return mo.weekDays + mo.wysendays.length;
}

export function advanceDay(d: DwDate): DwDate {
  if (d.day < monthLength(d.month)) return { ...d, day: d.day + 1 };
  if (d.month < 12) return { year: d.year, month: d.month + 1, day: 1 };
  return { year: d.year + 1, month: 1, day: 1 };
}

/** Weekday name for days 1-28; null for wysendays (days 29+). */
export function weekdayOf(d: DwDate): string | null {
  const mo = monthOf(d.month);
  if (d.day > mo.weekDays) return null;
  return WEEKDAY_NAMES[(d.day - 1) % 7];
}

/** Human day label: weekday for normal days, wysenday name otherwise. */
export function dayLabel(d: DwDate): string {
  const mo = monthOf(d.month);
  if (d.day > mo.weekDays) return mo.wysendays[d.day - mo.weekDays - 1] ?? 'Wysenday';
  return WEEKDAY_NAMES[(d.day - 1) % 7];
}

export function formatDwDate(d: DwDate): string {
  const mo = monthOf(d.month);
  if (d.day > mo.weekDays) return `${dayLabel(d)}, ${mo.name} ${d.year}`;
  return `${d.day} ${mo.name} ${d.year}`;
}

// ponytail: 4-bucket heuristic off the fixed new/full days — good enough for a display glyph, not astronomical.
export function moonPhase(d: DwDate): MoonPhase {
  const { newMoon, fullMoon } = monthOf(d.month);
  if (d.day === newMoon) return 'new';
  if (d.day === fullMoon) return 'full';
  return d.day > newMoon && d.day < fullMoon ? 'waxing' : 'waning';
}

export function sameDwDate(a?: DwDate | null, b?: DwDate | null): boolean {
  if (!a || !b) return false;
  return a.year === b.year && a.month === b.month && a.day === b.day;
}
```

#### 3. Barrel export
**File**: `packages/rules-engine/src/index.ts`
**Action**: modify — add `export * from './calendar';`

#### 4. Tests
**File**: `packages/rules-engine/src/__tests__/calendar.test.ts`
**Action**: create. Cover:
- `advanceDay` within month: `{y:1,m:1,d:1}` → day 2
- rollover Lymewald (28 days, no wysendays): `{y,m:2,d:28}` → `{y,m:3,d:1}`
- rollover Chysting (31 days incl. 3 wysendays): `{y,m:7,d:31}` → `{y,m:8,d:1}`; and `{y,m:7,d:28}` → `{y,m:7,d:29}`
- year rollover: `{y:5,m:12,d:30}` → `{y:6,m:1,d:1}`
- `weekdayOf` day 1 = 'Colly', day 28 = 'Sunning', day 29 (Grimvold) = null
- `dayLabel` Grimvold day 29 = 'Hanglemas'
- `moonPhase`: Grimvold day 4 = 'new', day 19 = 'full', day 10 = 'waxing', day 25 = 'waning'
- total year length = 352: `sum(monthLength(1..12)) === 352`
- `sameDwDate` true on equal, false on null

### Verification
#### Automated
- [x] `pnpm --filter @dolmenwood/rules-engine test` passes
- [x] `pnpm --filter @dolmenwood/rules-engine typecheck` passes
#### Manual
- [ ] Spot-check `calendar.json` month/moon/solstice values against `Dolmenwood Calendar.pdf` (one-time; data is static)

---

## Phase 2: `currentDate` on CampaignDoc + read path + widget

### Changes

#### 1. Persistence type
**File**: `apps/web/src/lib/cosmos/types.ts`
**Action**: modify — add import + field on `CampaignDoc`.

```ts
import type { DwDate } from '@dolmenwood/rules-engine';
// ...in CampaignDoc, near sessions/proposals:
  /** In-world current date, DM-controlled. Absent/null on docs before this phase. */
  currentDate?: DwDate | null;
```

#### 2. UI shape + mapping
**File**: `apps/web/src/lib/api/campaigns.ts`
**Action**: modify — add `current_date` to `CampaignData`.
```ts
import type { DwDate } from '@dolmenwood/rules-engine';
// in CampaignData:
  current_date: DwDate | null;
```
**File**: `apps/web/src/lib/data/campaigns.ts`
**Action**: modify — populate it in `hydrateCampaign` return (`campaigns.ts:187-194`):
```ts
    current_date: doc.currentDate ?? null,
```
(Also add to any other place that builds a `CampaignData` for the DM list — `loadDMCampaigns` path reuses `hydrateCampaign`, verify no second literal needs it.)

#### 3. Date card component
**File**: `apps/web/src/components/campaign/overview/CurrentDateCard.tsx`
**Action**: create — read-only in this phase (DM controls added Phase 3).
```ts
'use client';
import { formatDwDate, dayLabel, moonPhase, MONTHS } from '@dolmenwood/rules-engine';
import type { DwDate } from '@dolmenwood/rules-engine';

const MOON_GLYPH = { new: '🌑', waxing: '🌓', full: '🌕', waning: '🌗' } as const;

export function CurrentDateCard({ date }: { date: DwDate | null }) {
  if (!date) return null; // players see nothing until the DM sets a date
  const mo = MONTHS[date.month - 1];
  const phase = moonPhase(date);
  // render: formatDwDate(date) · dayLabel(date) · mo.seasonLabel · MOON_GLYPH[phase] + phase
  // + mo.solarEvent when solarEvent.day === date.day
}
```
Render it inside `PartyRoster.tsx` (per-campaign, players) — pass `campaign.current_date`. (DM view wiring in Phase 3.)

### Verification
#### Automated
- [x] `pnpm --filter @dolmenwood/web typecheck` passes
- [x] `pnpm --filter @dolmenwood/web test` passes
#### Manual
- [ ] Patch a campaign doc in Cosmos with `currentDate: {year:1000,month:1,day:4}`; load campaign overview as a member → card shows "4 Grimvold 1000 · Moot · The Onset of Winter · 🌑 new"
- [ ] Campaign with no `currentDate` → card renders nothing (no crash)

---

## Phase 3: DM set + advance controls

### Changes

#### 1. Data-module functions
**File**: `apps/web/src/lib/data/campaigns.ts`
**Action**: modify — add two functions using existing `replaceCampaignWithRetry` + `isCampaignDM`. Import `isCampaignDM` (add to the `@/lib/authz` import) and calendar helpers.
```ts
import { isCampaignDM } from '@/lib/authz';
import { advanceDay, monthLength } from '@dolmenwood/rules-engine';
import type { DwDate } from '@dolmenwood/rules-engine';

const authorizeDM = (doc: CampaignDoc, me: string) => {
  if (!isCampaignDM(doc, me)) throw forbidden();
};

function validDwDate(d: unknown): DwDate {
  const o = d as Partial<DwDate>;
  if (!o || !Number.isInteger(o.year) || !Number.isInteger(o.month) || !Number.isInteger(o.day)) throw badRequest('invalid date');
  if (o.month! < 1 || o.month! > 12) throw badRequest('invalid month');
  if (o.day! < 1 || o.day! > monthLength(o.month!)) throw badRequest('invalid day');
  return { year: o.year!, month: o.month!, day: o.day! };
}

export async function setCampaignDate(campaignId: string, date: unknown): Promise<DwDate> {
  const valid = validDwDate(date);
  await replaceCampaignWithRetry(campaignId, authorizeDM, (doc) => { doc.currentDate = valid; });
  return valid;
}

export async function advanceCampaignDay(campaignId: string): Promise<DwDate> {
  let next: DwDate;
  await replaceCampaignWithRetry(campaignId, authorizeDM, (doc) => {
    if (!doc.currentDate) throw badRequest('set the date first');
    next = advanceDay(doc.currentDate);
    doc.currentDate = next;
  });
  return next!;
}
```

#### 2. Route
**File**: `apps/web/src/app/api/campaigns/[id]/calendar/route.ts`
**Action**: create — op-dispatch POST, mirrors `schedule/route.ts`.
```ts
import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/http';
import { setCampaignDate, advanceCampaignDay } from '@/lib/data/campaigns';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const date = body?.op === 'advanceDay'
      ? await advanceCampaignDay(id)
      : await setCampaignDate(id, body?.date);
    return NextResponse.json({ currentDate: date });
  } catch (e) {
    return handleRouteError(e);
  }
}
```

#### 3. Client wrappers
**File**: `apps/web/src/lib/api/campaigns.ts`
**Action**: modify — add:
```ts
import type { DwDate } from '@dolmenwood/rules-engine';
export async function setCampaignDate(campaignId: string, date: DwDate): Promise<DwDate | null> {
  const res = await fetch(`/api/campaigns/${campaignId}/calendar`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'setDate', date }),
  });
  return res.ok ? (await res.json()).currentDate : null;
}
export async function advanceCampaignDay(campaignId: string): Promise<DwDate | null> {
  const res = await fetch(`/api/campaigns/${campaignId}/calendar`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'advanceDay' }),
  });
  return res.ok ? (await res.json()).currentDate : null;
}
```

#### 4. DM controls in card
**File**: `apps/web/src/components/campaign/overview/CurrentDateCard.tsx`
**Action**: modify — add optional `campaignId` + `isDM` props and an `onChange(date)` callback. When `isDM`:
- "Advance day →" button → `advanceCampaignDay(campaignId)`; on success call `onChange`
- "Set date…" toggle revealing year/month(select from `MONTHS`)/day number inputs → `setCampaignDate(campaignId, {...})`; on success `onChange`
- When `date` is null and `isDM`, show the "Set date…" control (so DM can bootstrap)
**File**: `apps/web/src/components/campaign/overview/DungeonMasterView.tsx`
**Action**: modify — render `<CurrentDateCard date={campaign.current_date} campaignId={campaign.id} isDM onChange={...reload or local set...} />` per campaign (reuse existing `loadDMCampaigns` refresh, or patch local state).
**File**: `apps/web/src/components/campaign/overview/PartyRoster.tsx`
**Action**: already renders the read-only card from Phase 2 (no `isDM`) — leave as is.

### Verification
#### Automated
- [x] `pnpm --filter @dolmenwood/web typecheck` passes
- [x] `pnpm --filter @dolmenwood/web test` passes
#### Manual
- [ ] As DM (`account.role === 'referee'`): "Set date…" → set Grimvold 28 → card updates; "Advance day" → rolls to Lymewald... wait, Grimvold has 30 days → day 29 Hanglemas; advance again → 30 Dyboll's Day; advance → Lymewald 1
- [ ] As non-DM: no Advance/Set controls visible
- [ ] `curl -X POST /api/campaigns/<id>/calendar -d '{"op":"advanceDay"}'` as a non-DM session → 403
- [ ] Advance on a campaign with no date set → 400 "set the date first"

---

## Phase 4: Per-character opt-in rest CTA

### Changes

#### 1. Persistence field
**File**: `apps/web/src/lib/cosmos/types.ts`
**Action**: modify — add to `CharacterDoc` (near spellSlots):
```ts
  /** Last in-world date this character rested. Absent = never rested. */
  lastRestDate?: DwDate | null;
```
(`DwDate` import already added in Phase 2.)

#### 2. Extend the rest op
**File**: `apps/web/src/lib/data/spells.ts`
**Action**: modify — `MagicOp` `rest` variant + case (`spells.ts:66`, `:109-113`):
```ts
import type { DwDate } from '@dolmenwood/rules-engine';
// union:
  | { op: 'rest'; restDate?: DwDate }
// case:
      case 'rest': {
        doc.spellPreparations = [];
        doc.spellSlots = (doc.spellSlots ?? []).map((s) => ({ ...s, slotsUsed: 0 }));
        if (op.restDate) doc.lastRestDate = op.restDate;
        return;
      }
```
(Existing 🌙 Rest button on the sheet omits `restDate` → `lastRestDate` untouched, behavior unchanged.)

#### 3. Client wrapper
**File**: `apps/web/src/lib/api/spells.ts`
**Action**: modify — `resetSpellsForRest` (`:93-96`):
```ts
import type { DwDate } from '@dolmenwood/rules-engine';
export async function resetSpellsForRest(characterId: string, restDate?: DwDate): Promise<void> {
  await magicOp(characterId, { op: 'rest', restDate });
}
```

#### 4. Expose lastRestDate on roster
**File**: `apps/web/src/lib/api/campaigns.ts`
**Action**: modify — add to `MemberCharacter`:
```ts
  last_rest_date?: DwDate | null;
```
**File**: `apps/web/src/lib/data/campaigns.ts`
**Action**: modify — `charToMemberCharacter` (`:133-144`) add:
```ts
    last_rest_date: doc.lastRestDate ?? null,
```

#### 5. Rest prompt component
**File**: `apps/web/src/components/campaign/overview/RestPrompt.tsx`
**Action**: create.
```ts
'use client';
import { useState } from 'react';
import { sameDwDate } from '@dolmenwood/rules-engine';
import type { DwDate } from '@dolmenwood/rules-engine';
import { resetSpellsForRest } from '@/lib/api/spells';
import type { MemberCharacter } from '@/lib/api/campaigns';

// Show a "Rest" row per viewer-owned character whose last_rest_date != current date.
export function RestPrompt({ characters, currentDate }: { characters: MemberCharacter[]; currentDate: DwDate | null }) {
  const [rested, setRested] = useState<Record<string, boolean>>({});
  if (!currentDate) return null;
  const need = characters.filter((c) => !rested[c.id] && !sameDwDate(c.last_rest_date, currentDate));
  if (need.length === 0) return null;
  return (/* per char: name + "🌙 Rest" button → resetSpellsForRest(c.id, currentDate) then setRested */);
}
```
Render inside `PartyRoster.tsx`, passing the viewer's own member characters (the `Member` where `account_id === userId`) and `campaign.current_date`.

### Verification
#### Automated
- [ ] `pnpm --filter @dolmenwood/rules-engine test` passes (sameDwDate covered in Phase 1)
- [ ] `pnpm --filter @dolmenwood/web typecheck` passes
- [ ] `pnpm --filter @dolmenwood/web test` passes
#### Manual
- [ ] Give a caster used spell slots; DM sets/advances the date → on campaign overview the character shows a "🌙 Rest" row
- [ ] Click Rest → open the character's Magic tab → slots show 0 used, preparations cleared; the campaign Rest row is gone
- [ ] DM advances the day again → Rest row reappears for that character
- [ ] Character-sheet 🌙 Rest button still works and does NOT change the campaign Rest row's underlying logic beyond the normal reset (it leaves `lastRestDate` untouched, so the campaign row may still show until rested from there — acceptable per design)

---

## Notes / deviations from structure.md

- **Resolved the open `DEFAULT_START` decision**: `advanceCampaignDay` requires a date already set (400 otherwise) instead of inventing a default year. DM bootstraps via "Set date…". No arbitrary canonical year in code.
- `DwDate` is defined in `packages/rules-engine` (`calendar.ts`) and imported by `cosmos/types.ts` and the client `lib/api` types — web already depends on `@dolmenwood/rules-engine`.
- Card placement: read-only card in `PartyRoster` (players) from Phase 2; DM controls added to the same component in Phase 3 and wired from `DungeonMasterView`. No separate DM card.
- `moonPhase` is a documented 4-bucket heuristic (`ponytail:` comment), not astronomical — sufficient for the display glyph per design decision 6.
- No change to `UPDATABLE_FIELDS`; `lastRestDate` is written only by the rest op, never by PATCH.
