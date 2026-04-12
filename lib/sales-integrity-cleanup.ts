import { query, getConnection } from "@/lib/pg-direct"

export type OrphanSaleRow = {
  id: string
  cabinet: string
  amount: unknown
  date: unknown
  archived?: unknown
}

/**
 * Active sale rows with no line items — these inflate DB totals and never match a meaningful POS line.
 */
export async function listOrphanSales(cabinet?: string): Promise<OrphanSaleRow[]> {
  if (cabinet && cabinet !== "all") {
    return await query(
      `SELECT s.id, s.cabinet, s.amount, s.date, s.archived
       FROM sale s
       WHERE COALESCE(s.archived, false) = false
         AND s.cabinet = $1
         AND NOT EXISTS (SELECT 1 FROM "saleItem" i WHERE i."saleId" = s.id)
       ORDER BY s.date DESC NULLS LAST`,
      [cabinet]
    )
  }
  return await query(
    `SELECT s.id, s.cabinet, s.amount, s.date, s.archived
     FROM sale s
     WHERE COALESCE(s.archived, false) = false
       AND NOT EXISTS (SELECT 1 FROM "saleItem" i WHERE i."saleId" = s.id)
     ORDER BY s.date DESC NULLS LAST`
  )
}

export async function deleteSalesByIds(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0
  const pool = await getConnection()
  const result = await pool.query(`DELETE FROM sale WHERE id::text = ANY($1::text[])`, [ids])
  return result.rowCount ?? 0
}
