import { describe, it, expect } from 'vitest';
import {
  MONTHS,
  WEEKDAY_NAMES,
  monthLength,
  advanceDay,
  weekdayOf,
  dayLabel,
  formatDwDate,
  moonPhase,
  sameDwDate,
} from '../calendar';

describe('calendar data', () => {
  it('has 12 months and 7 weekday names', () => {
    expect(MONTHS).toHaveLength(12);
    expect(WEEKDAY_NAMES).toHaveLength(7);
  });

  it('year totals 352 days', () => {
    const total = MONTHS.reduce((sum, _m, i) => sum + monthLength(i + 1), 0);
    expect(total).toBe(352);
  });

  it('every month has one new moon and one full moon within its week days', () => {
    for (const m of MONTHS) {
      expect(m.newMoon).toBeGreaterThanOrEqual(1);
      expect(m.newMoon).toBeLessThanOrEqual(m.weekDays);
      expect(m.fullMoon).toBeGreaterThan(m.newMoon);
      expect(m.fullMoon).toBeLessThanOrEqual(m.weekDays);
    }
  });
});

describe('advanceDay', () => {
  it('increments within a month', () => {
    expect(advanceDay({ year: 1, month: 1, day: 1 })).toEqual({ year: 1, month: 1, day: 2 });
  });

  it('rolls Lymewald (28 days, no wysendays) into Haggryme', () => {
    expect(advanceDay({ year: 1, month: 2, day: 28 })).toEqual({ year: 1, month: 3, day: 1 });
  });

  it('walks into and out of Chysting wysendays (31 days)', () => {
    expect(advanceDay({ year: 1, month: 7, day: 28 })).toEqual({ year: 1, month: 7, day: 29 });
    expect(advanceDay({ year: 1, month: 7, day: 31 })).toEqual({ year: 1, month: 8, day: 1 });
  });

  it('rolls the year on Braghold 30', () => {
    expect(advanceDay({ year: 5, month: 12, day: 30 })).toEqual({ year: 6, month: 1, day: 1 });
  });
});

describe('weekdayOf / dayLabel', () => {
  it('day 1 is Colly and day 28 is Sunning', () => {
    expect(weekdayOf({ year: 1, month: 1, day: 1 })).toBe('Colly');
    expect(weekdayOf({ year: 1, month: 1, day: 28 })).toBe('Sunning');
  });

  it('wysendays have no weekday but a proper name', () => {
    expect(weekdayOf({ year: 1, month: 1, day: 29 })).toBeNull();
    expect(dayLabel({ year: 1, month: 1, day: 29 })).toBe('Hanglemas');
    expect(dayLabel({ year: 1, month: 1, day: 30 })).toBe("Dyboll's Day");
  });
});

describe('formatDwDate', () => {
  it('formats regular days as "day month year"', () => {
    expect(formatDwDate({ year: 1000, month: 1, day: 4 })).toBe('4 Grimvold 1000');
  });

  it('formats wysendays by name', () => {
    expect(formatDwDate({ year: 1000, month: 1, day: 29 })).toBe('Hanglemas, Grimvold 1000');
  });
});

describe('moonPhase', () => {
  it('hits new and full on the fixed days (Grimvold: 4 and 19)', () => {
    expect(moonPhase({ year: 1, month: 1, day: 4 })).toBe('new');
    expect(moonPhase({ year: 1, month: 1, day: 19 })).toBe('full');
  });

  it('waxes between new and full, wanes otherwise', () => {
    expect(moonPhase({ year: 1, month: 1, day: 10 })).toBe('waxing');
    expect(moonPhase({ year: 1, month: 1, day: 25 })).toBe('waning');
    expect(moonPhase({ year: 1, month: 1, day: 1 })).toBe('waning');
  });
});

describe('sameDwDate', () => {
  it('matches equal dates, rejects different or missing', () => {
    const d = { year: 1, month: 2, day: 3 };
    expect(sameDwDate(d, { ...d })).toBe(true);
    expect(sameDwDate(d, { ...d, day: 4 })).toBe(false);
    expect(sameDwDate(d, null)).toBe(false);
    expect(sameDwDate(undefined, d)).toBe(false);
  });
});
