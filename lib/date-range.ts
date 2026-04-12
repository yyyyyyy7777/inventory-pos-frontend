/**
 * Parse YYYY-MM-DD from <input type="date"> as local calendar bounds
 * (avoids UTC midnight shifts from `new Date("yyyy-mm-dd")`).
 */
export function parseLocalDayStart(yyyyMmDd: string): Date {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  if (!y || !m || !d) return new Date(NaN);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export function parseLocalDayEnd(yyyyMmDd: string): Date {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  if (!y || !m || !d) return new Date(NaN);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

export function isValidYyyyMmDd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s.trim());
}
