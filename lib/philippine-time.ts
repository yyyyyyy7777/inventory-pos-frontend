/** Philippine business day boundaries (UTC+8) for consistent POS / Sales / analytics. */
const PH_TIMEZONE = "Asia/Manila";

export function getPhilippineDayBounds(baseDate: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PH_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(baseDate);

  const year = Number(parts.find((p) => p.type === "year")?.value || 0);
  const month = Number(parts.find((p) => p.type === "month")?.value || 1);
  const day = Number(parts.find((p) => p.type === "day")?.value || 1);

  const startUtcMs = Date.UTC(year, month - 1, day, -8, 0, 0, 0);
  return {
    start: new Date(startUtcMs),
    end: new Date(startUtcMs + 24 * 60 * 60 * 1000),
  };
}

/**
 * Interpret yyyy-mm-dd from a date input as that calendar day in Asia/Manila.
 * Matches getPhilippineDayBounds and the Sales table Date column (timeZone Asia/Manila).
 * Returns [start, end) instants suitable for saleDate >= start && saleDate < end.
 */
export function getPhilippineDayRangeFromYmd(yyyyMmDd: string): { start: Date; end: Date } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(yyyyMmDd || "").trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!year || !month || !day) return null;
  const startUtcMs = Date.UTC(year, month - 1, day, -8, 0, 0, 0);
  return {
    start: new Date(startUtcMs),
    end: new Date(startUtcMs + 24 * 60 * 60 * 1000),
  };
}
