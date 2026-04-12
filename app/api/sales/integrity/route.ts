import { NextRequest, NextResponse } from "next/server"
import { deleteSalesByIds, listOrphanSales } from "@/lib/sales-integrity-cleanup"

function authorizeIntegrity(req: NextRequest): boolean {
  const token = process.env.SALES_INTEGRITY_TOKEN
  if (!token) {
    return process.env.NODE_ENV !== "production"
  }
  const auth = req.headers.get("authorization") || ""
  return auth === `Bearer ${token}`
}

/**
 * Inspect or remove active `sale` rows that have no `saleItem` rows (failed / partial writes).
 * Totals in the app are based on hydrated sales with items; these orphans skew DB aggregates only.
 *
 * GET/POST dryRun: list orphans. Deletes require `SALES_INTEGRITY_TOKEN` + `Authorization: Bearer …` in production.
 */
export async function GET(req: NextRequest) {
  if (!authorizeIntegrity(req)) {
    return NextResponse.json(
      { error: "Unauthorized. Set SALES_INTEGRITY_TOKEN and send Authorization: Bearer <token>." },
      { status: 403 }
    )
  }
  try {
    const { searchParams } = new URL(req.url)
    const cabinet = searchParams.get("cabinet") || undefined
    const orphans = await listOrphanSales(cabinet || undefined)
    return NextResponse.json({
      dryRun: true,
      cabinet: cabinet || "all",
      orphanCount: orphans.length,
      orphans,
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!authorizeIntegrity(req)) {
    return NextResponse.json(
      { error: "Unauthorized. Set SALES_INTEGRITY_TOKEN and send Authorization: Bearer <token>." },
      { status: 403 }
    )
  }
  try {
    const body = (await req.json().catch(() => ({}))) as {
      cabinet?: string
      dryRun?: boolean
    }
    const cabinet = body.cabinet
    const dryRun = body.dryRun !== false

    const orphans = await listOrphanSales(cabinet)

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        cabinet: cabinet || "all",
        orphanCount: orphans.length,
        orphans,
        hint: "Send { dryRun: false } to delete these rows (requires auth in production).",
      })
    }

    if (process.env.NODE_ENV === "production" && !process.env.SALES_INTEGRITY_TOKEN) {
      return NextResponse.json(
        { error: "Refusing delete in production without SALES_INTEGRITY_TOKEN." },
        { status: 403 }
      )
    }

    const ids = orphans.map((o) => o.id)
    const deletedCount = await deleteSalesByIds(ids)
    return NextResponse.json({
      dryRun: false,
      deletedCount,
      deletedIds: ids,
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
