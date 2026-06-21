export interface MonthCell { date: Date; inMonth: boolean; }

export function buildMonthGrid(year: number, month: number): MonthCell[] {
  const startDow = new Date(year, month, 1).getDay();       // 0 = Sunday
  const gridStart = new Date(year, month, 1 - startDow);
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    return { date, inMonth: date.getMonth() === month };
  });
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}
