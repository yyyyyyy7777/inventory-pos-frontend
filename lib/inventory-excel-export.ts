import type { Cell, Fill, Font, Worksheet } from "exceljs"

function bytesFromWriteBuffer(data: ArrayBuffer | ArrayBufferView): Uint8Array {
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
}

const COLS = 19

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

export interface InventoryExcelDetailRow {
  sku: string
  name: string
  description: string
  category: string
  stock: number
  unitCost: number
  sellingPrice: number
  profit: number
  capital: number
  dimensions: string
  weight: string
  purchaseDate: string
  purchasePlace: string
  supplierName: string
  createdBy: string
  lastUpdatedBy: string
  dateCreated: string
  lastModified: string
  lastRestock: string
}

export interface InventoryExcelExportInput {
  cabinetLabel: string
  generatedAt: string
  filterLine: string
  totalItems: number
  totalStockUnits: number
  totalInventoryCapital: number
  detailRows: InventoryExcelDetailRow[]
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

export async function buildInventoryExcelBuffer(input: InventoryExcelExportInput): Promise<Uint8Array> {
  const mod = await import("exceljs")
  const Excel = (mod as { default?: { Workbook: new () => import("exceljs").Workbook } }).default ?? mod
  const workbook = new Excel.Workbook()
  workbook.creator = "The Wheezard PH"
  const sheet = workbook.addWorksheet("Inventory tracker", {
    properties: { defaultRowHeight: 18 },
  })

  sheet.columns = [
    { key: "a", width: 14 }, // SKU
    { key: "b", width: 34 }, // Name
    { key: "c", width: 44 }, // Description
    { key: "d", width: 18 }, // Category
    { key: "e", width: 10 }, // Stock
    { key: "f", width: 16 }, // Unit Cost
    { key: "g", width: 16 }, // Selling Price
    { key: "profit", width: 16 }, // Profit
    { key: "h", width: 16 }, // Capital
    { key: "i", width: 14 }, // Dimensions
    { key: "j", width: 12 }, // Weight
    { key: "purchaseDate", width: 14 }, // Purchase Date
    { key: "k", width: 18 }, // Place of Purchase
    { key: "l", width: 18 }, // Supplier
    { key: "m", width: 14 }, // Created By
    { key: "n", width: 14 }, // Last Updated By
    { key: "o", width: 14 }, // Date Added
    { key: "p", width: 14 }, // Last Modified
    { key: "q", width: 14 }, // Last Restock
  ]

  let r = 1

  // Handle Logo Insertion
  if (input.logoBuffer) {
    try {
      const imageId = workbook.addImage({
        buffer: input.logoBuffer,
        extension: 'png',
      })
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
  title.value = "INVENTORY REPORT — The Wheezard PH"
  title.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } }
  title.fill = FILL_TITLE
  title.alignment = { vertical: "middle", horizontal: "center" }
  sheet.getRow(r).height = 65
  r++

  const meta: [string, string][] = [
    ["Generated", input.generatedAt],
    ["Cabinet", input.cabinetLabel],
    ["Active filters", input.filterLine],
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
    ["Total unique SKU items", input.totalItems],
    ["Total physical product stock", input.totalStockUnits],
    ["Total inventory capital (PHP)", input.totalInventoryCapital],
  ]
  for (let i = 0; i < summaryRows.length; i++) {
    const [label, val] = summaryRows[i]
    const row = sheet.getRow(r)
    row.getCell(1).value = label
    const v = row.getCell(2)
    if (typeof val === "number" && label.includes("capital")) {
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
  mergeRow(sheet, r, "DETAIL — ASSETS", {
    fill: FILL_SECTION,
    font: { bold: true, size: 12, color: { argb: "FF3730A3" } },
    height: 26,
  })
  r++

  const detailCols = [
    "SKU",
    "Product Name",
    "Description",
    "Category",
    "Stock",
    "Unit Cost (PHP)",
    "Selling Price (PHP)",
    "Profit (PHP)",
    "Capital (PHP)",
    "Dimensions (L×W×H)",
    "Weight (kg)",
    "Purchase Date",
    "Place of Purchase",
    "Supplier",
    "Created By",
    "Last Updated By",
    "Date Added",
    "Last Modified",
    "Last Restock",
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
      d.sku,
      d.name,
      d.description,
      d.category,
      d.stock,
      d.unitCost,
      d.sellingPrice,
      d.profit,
      d.capital,
      d.dimensions,
      d.weight,
      d.purchaseDate,
      d.purchasePlace,
      d.supplierName,
      d.createdBy,
      d.lastUpdatedBy,
      d.dateCreated,
      d.lastModified,
      d.lastRestock,
    ]
    values.forEach((v, idx) => {
      const cell = row.getCell(idx + 1)
      cell.value = v ?? "—"
      cell.border = BORDER_LIGHT
      
      let hAlign: "left" | "right" | "center" = "left";
      if (idx === 4) hAlign = "center"; // Stock
      else if (idx >= 5 && idx <= 8) hAlign = "right"; // Currency (Unit Cost, Price, Profit, Capital)
      else if (idx === 9 || idx === 10) hAlign = "center"; // Dimensions, Weight
      
      cell.alignment = {
        vertical: "top",
        horizontal: hAlign,
        wrapText: true,
      }
      
      if (idx >= 5 && idx <= 8) {
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

  sheet.views = [
    {
      state: "frozen",
      ySplit: detailColumnHeaderRow,
      activeCell: "A1",
      showGridLines: true,
    },
  ]

  const raw = await workbook.xlsx.writeBuffer()
  return bytesFromWriteBuffer(raw as ArrayBuffer | ArrayBufferView)
}
