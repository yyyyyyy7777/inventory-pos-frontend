import { countUnitsInSale } from "@/lib/sale-metrics";

/** Same labels as Sales tab time period filter */
export type SalesPeriodFilter = "today" | "weekly" | "monthly" | "quarterly" | "annually";

export type SaleLike = {
  id?: string;
  requestKey?: string;
  archived?: boolean;
  cabinet: string;
  date: string;
  staffName?: string;
  paymentMethod?: string;
  soldAt?: string;
  referenceNumber?: string;
  amount: number;
  items?: { quantity?: number; productName?: string; name?: string; price?: number; category?: string }[];
};

function isSaleArchived(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

function buildSaleItemsSignature(sale: SaleLike): string {
  const items = Array.isArray(sale.items) ? [...sale.items] : [];
  return items
    .map((item: any) => ({
      productName: String(item.productName || item.name || '').trim().toLowerCase(),
      category: String(item.category || '').trim().toLowerCase(),
      quantity: Number(item.quantity) || 0,
      price: Number(item.price) || 0,
    }))
    .sort((a, b) =>
      `${a.productName}-${a.category}-${a.quantity}-${a.price}`.localeCompare(
        `${b.productName}-${b.category}-${b.quantity}-${b.price}`
      )
    )
    .map((item) => `${item.productName}|${item.category}|${item.quantity}|${item.price}`)
    .join('||');
}

export function dedupeLikelyDuplicateSales<T extends SaleLike>(rows: T[]): T[] {
  const seen = new Set<string>();
  const deduped: T[] = [];

  for (const sale of rows) {
    const requestKey = String((sale as any).requestKey || '').trim();
    if (requestKey) {
      const key = `requestKey::${requestKey}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(sale);
      continue;
    }

    const saleId = String((sale as any).id || '').trim();
    if (saleId) {
      const key = `id::${saleId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(sale);
      continue;
    }

    // Legacy fallback only for rows that do not have requestKey/id.
    // Keep conservative to avoid hiding valid transactions.
    const d = parseSaleDate(sale.date);
    const minuteBucket = Number.isNaN(d.getTime()) ? 'unknown' : Math.floor(d.getTime() / (60 * 1000));
    const signature = [
      String(sale.cabinet || '').trim().toLowerCase(),
      String(sale.staffName || '').trim().toLowerCase(),
      String(sale.paymentMethod || '').trim().toLowerCase(),
      String(sale.soldAt || '').trim().toLowerCase(),
      String(sale.referenceNumber || '').trim().toLowerCase(),
      Number(sale.amount) || 0,
      minuteBucket,
      buildSaleItemsSignature(sale),
    ].join('::');

    if (seen.has(signature)) continue;
    seen.add(signature);
    deduped.push(sale);
  }

  return deduped;
}

/**
 * Parse mixed sale date formats safely.
 * Supports:
 * - ISO timestamps
 * - Local strings like "3/20/2026, 5:30:00 PM"
 * - Local strings with timezone suffix like "3/20/2026, 5:30:00 PM (UTC+8)"
 */
export function parseSaleDate(dateValue: string | Date): Date {
  if (dateValue instanceof Date) return dateValue;

  const raw = String(dateValue || "").trim();
  if (!raw) return new Date(NaN);

  // Try native parsing first (covers ISO and many browser-parsable values).
  const native = new Date(raw);
  if (!Number.isNaN(native.getTime())) return native;

  // Fallback for custom format with timezone suffix.
  const withTz = raw.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2}):(\d{2})\s+(AM|PM)\s+\(UTC([+-]\d+)\)$/i
  );
  if (withTz) {
    const [, mm, dd, yyyy, hh, min, sec, ampm, tzOffset] = withTz;
    let hour24 = parseInt(hh, 10);
    if (ampm.toUpperCase() === "PM" && hour24 !== 12) hour24 += 12;
    if (ampm.toUpperCase() === "AM" && hour24 === 12) hour24 = 0;

    const offsetHours = parseInt(tzOffset, 10) || 0;
    const utcMs = Date.UTC(
      parseInt(yyyy, 10),
      parseInt(mm, 10) - 1,
      parseInt(dd, 10),
      hour24 - offsetHours,
      parseInt(min, 10),
      parseInt(sec, 10)
    );
    return new Date(utcMs);
  }

  // Fallback for local 12-hour format without timezone suffix.
  const local12h = raw.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2}):(\d{2})\s+(AM|PM)$/i
  );
  if (local12h) {
    const [, mm, dd, yyyy, hh, min, sec, ampm] = local12h;
    let hour24 = parseInt(hh, 10);
    if (ampm.toUpperCase() === "PM" && hour24 !== 12) hour24 += 12;
    if (ampm.toUpperCase() === "AM" && hour24 === 12) hour24 = 0;

    return new Date(
      parseInt(yyyy, 10),
      parseInt(mm, 10) - 1,
      parseInt(dd, 10),
      hour24,
      parseInt(min, 10),
      parseInt(sec, 10)
    );
  }

  return new Date(NaN);
}

export function saleMatchesPeriod(saleDate: Date, timePeriod: SalesPeriodFilter, now: Date = new Date()): boolean {
  let startDate: Date;
  switch (timePeriod) {
    case "today": {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return saleDate.toDateString() === today.toDateString();
    }
    case "weekly":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return saleDate >= startDate;
    case "monthly":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return saleDate >= startDate;
    case "quarterly":
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      return saleDate >= startDate;
    case "annually":
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      return saleDate >= startDate;
    default:
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return saleDate >= startDate;
  }
}

/** Staff dashboard uses different enum names; map to Sales tab logic */
export function mapStaffTimePeriodToSalesPeriod(
  period: "daily" | "weekly" | "monthly" | "quarterly" | "yearly"
): SalesPeriodFilter {
  switch (period) {
    case "daily":
      return "today";
    case "yearly":
      return "annually";
    default:
      return period;
  }
}

/**
 * Same pool + date rules as Sales tab (getSalesByCabinet + time period, no search/filters).
 */
export function summarizeSalesForPeriod(
  sales: SaleLike[],
  cabinet: string,
  timePeriod: SalesPeriodFilter
): { revenue: number; transactions: number; items: number; periodSales: SaleLike[] } {
  const filtered =
    cabinet === "all"
      ? sales.filter((sale) => !isSaleArchived((sale as any).archived))
      : sales.filter((sale) => sale.cabinet === cabinet && !isSaleArchived((sale as any).archived));
  const dedupedFiltered = dedupeLikelyDuplicateSales(filtered);

  const now = new Date();
  const periodSales = dedupedFiltered.filter((sale) => {
    const saleDate = parseSaleDate(sale.date);
    if (Number.isNaN(saleDate.getTime())) return false;
    return saleMatchesPeriod(saleDate, timePeriod, now);
  });

  const revenue = periodSales.reduce((sum, sale) => {
    const amount = typeof sale.amount === "number" ? sale.amount : parseFloat(String(sale.amount)) || 0;
    return sum + amount;
  }, 0);
  const transactions = periodSales.length;
  const items = periodSales.reduce((sum, sale) => sum + countUnitsInSale(sale), 0);

  return { revenue, transactions, items, periodSales };
}
