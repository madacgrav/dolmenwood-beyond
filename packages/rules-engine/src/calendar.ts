import calendarData from './data/calendar.json';

/**
 * The Dolmenwood in-world calendar (from the official Necrotic Gnome
 * "Dolmenwood Calendar" PDF): 12 months of four 7-day weeks plus 0-3
 * named intercalary "wysendays" (days 29+, outside the weekday cycle),
 * one new moon and one full moon per month on fixed days.
 */

/** In-world date. `month` is 1-12; `day` is 1..monthLength(month). */
export interface DwDate {
  year: number;
  month: number;
  day: number;
}

export interface DwMonth {
  name: string;
  seasonLabel: string;
  weekDays: number;
  wysendays: string[];
  newMoon: number;
  fullMoon: number;
  solarEvent?: { name: string; day: number };
}

export type MoonPhase = 'new' | 'waxing' | 'full' | 'waning';

export const WEEKDAY_NAMES: string[] = calendarData.weekdayNames;
export const MONTHS = calendarData.months as DwMonth[];

function monthOf(m: number): DwMonth {
  const mo = MONTHS[m - 1];
  if (!mo) throw new RangeError(`invalid month ${m}`);
  return mo;
}

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
  return WEEKDAY_NAMES[(d.day - 1) % 7]!;
}

/** Human day label: weekday for normal days, wysenday name otherwise. */
export function dayLabel(d: DwDate): string {
  const mo = monthOf(d.month);
  if (d.day > mo.weekDays) return mo.wysendays[d.day - mo.weekDays - 1] ?? 'Wysenday';
  return WEEKDAY_NAMES[(d.day - 1) % 7]!;
}

export function formatDwDate(d: DwDate): string {
  const mo = monthOf(d.month);
  if (d.day > mo.weekDays) return `${dayLabel(d)}, ${mo.name} ${d.year}`;
  return `${d.day} ${mo.name} ${d.year}`;
}

// ponytail: 4-bucket heuristic off the fixed new/full days — a display glyph, not astronomy.
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
