import { countUnitsInSale } from "@/lib/sale-metrics";

/** Same labels as Sales tab time period filter */
export type SalesPeriodFilter = "today" | "weekly" | "monthly" | "quarterly" | "annually";

export type SaleLike = {
  archived?: boolean;
  cabinet: string;
  date: string;
  amount: number;
  items?: { quantity?: number; productName?: string; name?: string; price?: number; category?: string }[];
};

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
      ? sales.filter((sale) => !sale.archived)
      : sales.filter((sale) => sale.cabinet === cabinet && !sale.archived);

  const now = new Date();
  const periodSales = filtered.filter((sale) => {
    const saleDate = new Date(sale.date);
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
