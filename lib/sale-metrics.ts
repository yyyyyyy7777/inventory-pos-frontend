/**
 * Total units sold across line items (sum of quantities).
 * Matches PostgreSQL analytics: SUM("saleItem".quantity).
 */
export function countUnitsInSale(sale: { items?: { quantity?: number }[] }): number {
  if (!sale.items?.length) return 0;
  return sale.items.reduce((sum, item) => sum + (item.quantity ?? 1), 0);
}
