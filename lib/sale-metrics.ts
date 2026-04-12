/**
 * Total units sold across line items (sum of quantities).
 * Matches PostgreSQL analytics: SUM("saleItem".quantity).
 */
export function countUnitsInSale(sale: { items?: { quantity?: number }[] }): number {
  if (!sale.items?.length) return 0;
  return sale.items.reduce((sum, item) => sum + (item.quantity ?? 1), 0);
}

/** Single-unit lines show the product name only; multi-qty uses "Name × n" (avoids "Name (1)"). */
export function formatSaleLineItemLabel(productName: string, quantity: unknown): string {
  const name = String(productName ?? "").trim();
  const raw =
    typeof quantity === "number" && Number.isFinite(quantity)
      ? quantity
      : parseFloat(String(quantity ?? 1));
  const n = Number.isFinite(raw) && raw > 0 ? raw : 1;
  if (n === 1) return name;
  return `${name} × ${n}`;
}

function parseMoney(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const s = String(value ?? "")
    .trim()
    .replace(/,/g, "")
  const p = parseFloat(s)
  return Number.isFinite(p) ? p : 0
}

export function lineQuantity(item: { quantity?: unknown }): number {
  const raw =
    typeof item.quantity === "number" && Number.isFinite(item.quantity)
      ? item.quantity
      : parseFloat(String(item.quantity ?? 1))
  return Number.isFinite(raw) && raw > 0 ? raw : 1
}

export function lineUnitSellingPrice(item: { price?: unknown }): number {
  return parseMoney(item.price)
}

/** Stored acquired cost per unit at time of sale (from inventory / POS). */
export function lineUnitCostPrice(item: { costPrice?: unknown; unitCost?: unknown }): number {
  return parseMoney(item.unitCost ?? item.costPrice)
}

export function lineRevenue(item: { price?: unknown; quantity?: unknown }): number {
  return lineUnitSellingPrice(item) * lineQuantity(item)
}

export function lineCogs(item: { costPrice?: unknown; quantity?: unknown }): number {
  return lineUnitCostPrice(item) * lineQuantity(item)
}

export function lineProfit(item: { price?: unknown; costPrice?: unknown; quantity?: unknown }): number {
  return lineRevenue(item) - lineCogs(item)
}

export function saleTotalRevenue(sale: { items?: { price?: unknown; quantity?: unknown }[] }): number {
  if (!sale.items?.length) return 0
  return sale.items.reduce((sum, it) => sum + lineRevenue(it), 0)
}

export function saleTotalCogs(sale: { items?: { costPrice?: unknown; quantity?: unknown }[] }): number {
  if (!sale.items?.length) return 0
  return sale.items.reduce((sum, it) => sum + lineCogs(it), 0)
}

export function saleTotalProfit(sale: { items?: { price?: unknown; costPrice?: unknown; quantity?: unknown }[] }): number {
  if (!sale.items?.length) return 0
  return sale.items.reduce((sum, it) => sum + lineProfit(it), 0)
}
