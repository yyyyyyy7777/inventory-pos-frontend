import type { Cell, Fill, Font, Worksheet } from "exceljs"

function bytesFromWriteBuffer(data: ArrayBuffer | ArrayBufferView): Uint8Array {
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
}

const COLS = 8

const FILL_TITLE = {
  type: "pattern" as const,
  pattern: "solid" as const,
  fgColor: { argb: "FF3B18DA" },
}
const FILL_SECTION = {
  type: "pattern" as const,
  pattern: "solid" as const,
  fgColor: { argb: "FFEEF2FF" },
}
const FILL_TABLE_HEAD = {
  type: "pattern" as const,
  pattern: "solid" as const,
  fgColor: { argb: "FF1E293B" },
}
const FILL_ZEBRA = {
  type: "pattern" as const,
  pattern: "solid" as const,
  fgColor: { argb: "FFF8FAFC" },
}
const FONT_WHITE = { bold: true, color: { argb: "FFFFFFFF" } }
const BORDER_LIGHT = {
  top: { style: "thin" as const, color: { argb: "FFE2E8F0" } },
  left: { style: "thin" as const, color: { argb: "FFE2E8F0" } },
  bottom: { style: "thin" as const, color: { argb: "FFE2E8F0" } },
  right: { style: "thin" as const, color: { argb: "FFE2E8F0" } },
}

export interface SalesExcelDetailRow {
  date: string
  saleId: string
  units: number
  products: string
  staff: string
  paymentMethod: string
  amount: number
  soldAt: string
}

export interface SalesExcelExportInput {
  cabinetLabel: string
  generatedAt: string
  dateScopeLabel: string
  filterLine: string
  totalTransactions: number
  totalUnits: number
  totalRevenue: number
  totalCOGS: number
  totalProfit: number
  netRevenue: number
  avgSale: number
  salesWithDiscount: number
  paymentRows: { method: string; count: number; revenue: number }[]
  detailRows: SalesExcelDetailRow[]
  logoBuffer?: ArrayBuffer
}

function mergeRow(
  sheet: Worksheet,
  row: number,
  text: string,
  opts: { fill?: Fill; font?: Partial<Font>; height?: number }
) {
  sheet.mergeCells(row, 1, row, COLS)
  const cell = sheet.getCell(row, 1)
  cell.value = text
  cell.alignment = { vertical: "middle", horizontal: "left", indent: 1, wrapText: true }
  if (opts.fill) cell.fill = opts.fill
  if (opts.font) cell.font = opts.font
  if (opts.height) sheet.getRow(row).height = opts.height
}

function styleMetaLabel(cell: Cell) {
  cell.font = { color: { argb: "FF64748B" }, size: 11 }
}

function styleMetaValue(cell: Cell) {
  cell.font = { size: 11 }
  cell.alignment = { vertical: "middle", wrapText: true }
}

export async function buildSalesExcelBuffer(input: SalesExcelExportInput): Promise<Uint8Array> {
  const mod = await import("exceljs")
  const Excel = (mod as { default?: { Workbook: new () => import("exceljs").Workbook } }).default ?? mod
  const workbook = new Excel.Workbook()
  workbook.creator = "The Wheezard PH"
  const sheet = workbook.addWorksheet("Sales report", {
    properties: { defaultRowHeight: 18 },
  })

  sheet.columns = [
    { key: "a", width: 14 },
    { key: "b", width: 16 },
    { key: "c", width: 10 },
    { key: "d", width: 44 },
    { key: "e", width: 16 },
    { key: "f", width: 18 },
    { key: "g", width: 14 },
    { key: "h", width: 16 },
  ]

  let r = 1

  // Handle Logo Insertion
  if (input.logoBuffer) {
    try {
      const imageId = workbook.addImage({
        buffer: input.logoBuffer,
        extension: 'png',
      })
      // Place logo over the title bar
      sheet.addImage(imageId, {
        tl: { col: 0, row: 0 },
        ext: { width: 80, height: 80 }
      })
    } catch (e) {
      console.warn("Failed to inject logo to excel", e)
    }
  }

  sheet.mergeCells(r, 1, r, COLS)
  const title = sheet.getCell(r, 1)
  title.value = "SALES REPORT — The Wheezard PH"
  title.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } }
  title.fill = FILL_TITLE
  title.alignment = { vertical: "middle", horizontal: "center" }
  sheet.getRow(r).height = 65
  r++

  const meta: [string, string][] = [
    ["Generated", input.generatedAt],
    ["Cabinet", input.cabinetLabel],
    ["Date scope", input.dateScopeLabel],
    ["Other active filters", input.filterLine],
  ]
  for (const [label, val] of meta) {
    const c1 = sheet.getCell(r, 1)
    const c2 = sheet.getCell(r, 2)
    c1.value = label
    styleMetaLabel(c1)
    c2.value = val
    styleMetaValue(c2)
    sheet.mergeCells(r, 2, r, COLS)
    r++
  }

  r++
  mergeRow(sheet, r, "SUMMARY", {
    fill: FILL_SECTION,
    font: { bold: true, size: 12, color: { argb: "FF3730A3" } },
    height: 26,
  })
  r++

  const summaryHeader = sheet.getRow(r)
  summaryHeader.getCell(1).value = "Metric"
  summaryHeader.getCell(2).value = "Value"
  for (let c = 1; c <= 2; c++) {
    const cell = summaryHeader.getCell(c)
    cell.font = FONT_WHITE
    cell.fill = FILL_TABLE_HEAD
    cell.border = BORDER_LIGHT
    cell.alignment = { vertical: "middle", horizontal: c === 1 ? "left" : "right" }
  }
  sheet.mergeCells(r, 2, r, COLS)
  summaryHeader.height = 22
  r++

  const summaryRows: [string, string | number][] = [
    ["Total sales (transactions)", input.totalTransactions],
    ["Total units sold", input.totalUnits],
    ["Total revenue (Gross)", input.totalRevenue],
    ["Net revenue (Less OpEx)", input.netRevenue],
    ["Total COGS (PHP)", input.totalCOGS],
    ["Gross profit (PHP)", input.totalProfit],
    ["Average sale (PHP)", input.avgSale],
    ["Discounted sales (transactions)", input.salesWithDiscount],
  ]
  for (let i = 0; i < summaryRows.length; i++) {
    const [label, val] = summaryRows[i]
    const row = sheet.getRow(r)
    row.getCell(1).value = label
    const v = row.getCell(2)
    if (typeof val === "number" && (label.includes("PHP") || label.includes("revenue") || label.includes("COGS") || label.includes("profit") || label.includes("Average"))) {
      v.value = val
      v.numFmt = "#,##0.00"
    } else {
      v.value = val
    }
    row.getCell(1).border = BORDER_LIGHT
    v.border = BORDER_LIGHT
    v.alignment = { horizontal: "right" }
    if (i % 2 === 1) {
      row.getCell(1).fill = FILL_ZEBRA
      v.fill = FILL_ZEBRA
    }
    r++
  }

  r++
  mergeRow(sheet, r, "BY PAYMENT METHOD", {
    fill: FILL_SECTION,
    font: { bold: true, size: 12, color: { argb: "FF3730A3" } },
    height: 26,
  })
  r++

  const payHead = sheet.getRow(r)
  ;["Payment method", "Transactions", "Revenue (PHP)"].forEach((text, idx) => {
    const cell = payHead.getCell(idx + 1)
    cell.value = text
    cell.font = FONT_WHITE
    cell.fill = FILL_TABLE_HEAD
    cell.border = BORDER_LIGHT
    cell.alignment = {
      vertical: "middle",
      horizontal: idx === 0 ? "left" : "center",
    }
  })
  payHead.height = 22
  r++

  for (let i = 0; i < input.paymentRows.length; i++) {
    const p = input.paymentRows[i]
    const row = sheet.getRow(r)
    row.getCell(1).value = p.method
    row.getCell(2).value = p.count
    const rev = row.getCell(3)
    rev.value = p.revenue
    rev.numFmt = "#,##0.00"
    for (let c = 1; c <= 3; c++) {
      row.getCell(c).border = BORDER_LIGHT
      if (c === 2) row.getCell(c).alignment = { horizontal: "center" }
      if (c === 3) row.getCell(c).alignment = { horizontal: "right" }
    }
    if (i % 2 === 1) {
      row.getCell(1).fill = FILL_ZEBRA
      row.getCell(2).fill = FILL_ZEBRA
      row.getCell(3).fill = FILL_ZEBRA
    }
    r++
  }

  r++
  mergeRow(sheet, r, "DETAIL — LINE ITEMS", {
    fill: FILL_SECTION,
    font: { bold: true, size: 12, color: { argb: "FF3730A3" } },
    height: 26,
  })
  r++

  const detailCols = [
    "Date",
    "Sale ID",
    "Units",
    "Products",
    "Staff",
    "Payment method",
    "Amount (PHP)",
    "Sold at",
  ]
  const hdr = sheet.getRow(r)
  detailCols.forEach((text, idx) => {
    const cell = hdr.getCell(idx + 1)
    cell.value = text
    cell.font = FONT_WHITE
    cell.fill = FILL_TABLE_HEAD
    cell.border = BORDER_LIGHT
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true }
  })
  hdr.height = 24
  const detailColumnHeaderRow = r
  r++

  for (let i = 0; i < input.detailRows.length; i++) {
    const d = input.detailRows[i]
    const row = sheet.getRow(r)
    const values: (string | number)[] = [
      d.date,
      d.saleId,
      d.units,
      d.products,
      d.staff,
      d.paymentMethod,
      d.amount,
      d.soldAt,
    ]
    values.forEach((v, idx) => {
      const cell = row.getCell(idx + 1)
      cell.value = v
      cell.border = BORDER_LIGHT
      cell.alignment = {
        vertical: "top",
        horizontal: idx === 3 ? "left" : idx === 6 || idx === 2 ? "right" : "left",
        wrapText: true,
      }
      if (idx === 6) {
        cell.numFmt = "#,##0.00"
      }
    })
    if (i % 2 === 1) {
      for (let c = 1; c <= COLS; c++) row.getCell(c).fill = FILL_ZEBRA
    }
    r++
  }

  r++
  sheet.mergeCells(r, 1, r, COLS)
  const end = sheet.getCell(r, 1)
  end.value = "End of report"
  end.font = { italic: true, color: { argb: "FF94A3B8" } }
  end.alignment = { horizontal: "center" }

  // First scrollable row is the row after the detail table headers (keep Date, columns visible).
  sheet.views = [
    {
      state: "frozen",
      ySplit: detailColumnHeaderRow + 1,
      activeCell: "A1",
      showGridLines: true,
    },
  ]

  const raw = await workbook.xlsx.writeBuffer()
  return bytesFromWriteBuffer(raw as ArrayBuffer | ArrayBufferView)
}
