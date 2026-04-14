import type { Cell, Fill, Font, Worksheet } from "exceljs"

function bytesFromWriteBuffer(data: ArrayBuffer | ArrayBufferView): Uint8Array {
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
}

export interface ReceiptExcelItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface ReceiptExcelData {
  cabinet: string;
  date: string;
  time: string;
  staff: string;
  paymentMethod: string;
  location: string;
  referenceNumber?: string;
  items: ReceiptExcelItem[];
  subtotal: number;
  tax: number;
  total: number;
  cashReceived: string;
  change: string;
}

export interface ReceiptExcelInput {
  receipt: ReceiptExcelData;
  logoBuffer?: ArrayBuffer;
}

const FILL_RECEIPT_HEAD = {
  type: "pattern" as const,
  pattern: "solid" as const,
  fgColor: { argb: "FF3B18DA" }, // Primary purple-ish/blue
}
const FILL_TABLE_HEAD = {
  type: "pattern" as const,
  pattern: "solid" as const,
  fgColor: { argb: "FFF1F5FF" },
}

export async function buildReceiptExcelBuffer(input: ReceiptExcelInput): Promise<Uint8Array> {
  const mod = await import("exceljs")
  const Excel = (mod as { default?: { Workbook: new () => import("exceljs").Workbook } }).default ?? mod
  const workbook = new Excel.Workbook()
  workbook.creator = "The Wheezard PH"
  const sheet = workbook.addWorksheet("Receipt", {
    views: [{ showGridLines: false }],
  })

  // Set column widths
  sheet.columns = [
    { width: 3 }, // A (margin)
    { width: 25 }, // B (Item Name)
    { width: 10 }, // C (Qty)
    { width: 15 }, // D (Unit Price)
    { width: 15 }, // E (Total Price)
    { width: 3 }, // F (margin)
  ]

  let currentRow = 2

  // Add Logo
  if (input.logoBuffer) {
    const ext = "png"
    const imageId = workbook.addImage({
      buffer: bytesFromWriteBuffer(input.logoBuffer).buffer as ArrayBuffer,
      extension: ext,
    })
    sheet.addImage(imageId, {
      tl: { col: 1, row: currentRow - 1 },
      ext: { width: 50, height: 50 },
    })
  }

  // Header
  sheet.mergeCells(`B${currentRow}:E${currentRow}`)
  const rTitle = sheet.getCell(`B${currentRow}`)
  rTitle.value = "THE WHEEZARD PH"
  rTitle.font = { name: "Inter", bold: true, size: 16 }
  rTitle.alignment = { horizontal: "center", vertical: "middle" }
  currentRow += 2

  // Receipt Meta
  const meta: [string, string][] = [
    ["Cabinet:", input.receipt.cabinet],
    ["Date/Time:", `${input.receipt.date} • ${input.receipt.time}`],
    ["Staff:", input.receipt.staff],
    ["Location:", input.receipt.location],
  ]

  for (const [lbl, val] of meta) {
    sheet.mergeCells(`B${currentRow}:C${currentRow}`)
    const lblCell = sheet.getCell(`B${currentRow}`)
    lblCell.value = lbl
    lblCell.font = { name: "Inter", size: 10, color: { argb: "FF666666" } }

    sheet.mergeCells(`D${currentRow}:E${currentRow}`)
    const valCell = sheet.getCell(`D${currentRow}`)
    valCell.value = val
    valCell.font = { name: "Inter", size: 10, bold: true }
    currentRow++
  }

  currentRow++

  // Table header
  sheet.getCell(`B${currentRow}`).value = "Item"
  sheet.getCell(`C${currentRow}`).value = "Qty"
  sheet.getCell(`D${currentRow}`).value = "Price"
  sheet.getCell(`E${currentRow}`).value = "Total"
  ;["B", "C", "D", "E"].forEach((c) => {
    const cCell = sheet.getCell(`${c}${currentRow}`)
    cCell.fill = FILL_TABLE_HEAD
    cCell.font = { name: "Inter", bold: true, size: 10 }
    cCell.border = { bottom: { style: "thin", color: { argb: "FFDDDDDD" } } }
    if (c === "C" || c === "D" || c === "E") cCell.alignment = { horizontal: "right" }
  })
  currentRow++

  // Items
  for (const item of input.receipt.items) {
    const bCell = sheet.getCell(currentRow, 2)
    const cCell = sheet.getCell(currentRow, 3)
    const dCell = sheet.getCell(currentRow, 4)
    const eCell = sheet.getCell(currentRow, 5)

    bCell.value = item.name
    cCell.value = item.quantity
    dCell.value = `₱${item.unitPrice.toLocaleString()}`
    eCell.value = `₱${item.totalPrice.toLocaleString()}`

    cCell.alignment = { horizontal: "right" }
    dCell.alignment = { horizontal: "right" }
    eCell.alignment = { horizontal: "right" }

    ;[bCell, cCell, dCell, eCell].forEach(
      (cell) => (cell.font = { name: "Inter", size: 10 })
    )
    currentRow++
  }

  // Totals Divider
  sheet.mergeCells(`B${currentRow}:E${currentRow}`)
  const divCell = sheet.getCell(`B${currentRow}`)
  divCell.border = { top: { style: "dashed", color: { argb: "FFCCCCCC" } } }
  currentRow++

  // Totals
  const addTotalRow = (label: string, value: string, bold = false) => {
    sheet.mergeCells(`B${currentRow}:D${currentRow}`)
    const lCell = sheet.getCell(`B${currentRow}`)
    lCell.value = label
    lCell.alignment = { horizontal: "right" }
    lCell.font = { name: "Inter", size: 10, bold }

    const vCell = sheet.getCell(`E${currentRow}`)
    vCell.value = value
    vCell.alignment = { horizontal: "right" }
    vCell.font = { name: "Inter", size: 10, bold }
    currentRow++
  }

  addTotalRow("Subtotal", `₱${input.receipt.subtotal.toLocaleString()}`)
  if (input.receipt.tax > 0) {
    addTotalRow("Tax", `₱${input.receipt.tax.toLocaleString()}`)
  }
  
  // Grand Total box
  currentRow++
  sheet.mergeCells(`B${currentRow}:D${currentRow}`)
  const gtLCell = sheet.getCell(`B${currentRow}`)
  gtLCell.value = "TOTAL"
  gtLCell.alignment = { horizontal: "right", vertical: "middle" }
  gtLCell.font = { name: "Inter", size: 12, bold: true, color: { argb: "FFFFFFFF" } }
  gtLCell.fill = FILL_RECEIPT_HEAD

  const gtVCell = sheet.getCell(`E${currentRow}`)
  gtVCell.value = `₱${input.receipt.total.toLocaleString()}`
  gtVCell.alignment = { horizontal: "right", vertical: "middle" }
  gtVCell.font = { name: "Inter", size: 12, bold: true, color: { argb: "FFFFFFFF" } }
  gtVCell.fill = FILL_RECEIPT_HEAD
  currentRow += 2

  // Payment Info
  const pMeta: [string, string][] = [
    ["Payment:", input.receipt.paymentMethod],
  ]
  if (input.receipt.paymentMethod === "Cash" && input.receipt.cashReceived) {
    pMeta.push(["Cash Received:", input.receipt.cashReceived])
    pMeta.push(["Change:", input.receipt.change])
  } else if (input.receipt.referenceNumber) {
    pMeta.push(["Ref #:", input.receipt.referenceNumber])
  }

  for (const [lbl, val] of pMeta) {
    sheet.mergeCells(`B${currentRow}:D${currentRow}`)
    const lblCell = sheet.getCell(`B${currentRow}`)
    lblCell.value = lbl
    lblCell.alignment = { horizontal: "right" }
    lblCell.font = { name: "Inter", size: 9, color: { argb: "FF666666" } }

    const valCell = sheet.getCell(`E${currentRow}`)
    valCell.value = val
    valCell.alignment = { horizontal: "right" }
    valCell.font = { name: "Inter", size: 9, bold: true }
    currentRow++
  }

  currentRow += 2
  sheet.mergeCells(`B${currentRow}:E${currentRow}`)
  const fCell = sheet.getCell(`B${currentRow}`)
  fCell.value = "*** Thank You! Please come again! ***"
  fCell.alignment = { horizontal: "center" }
  fCell.font = { name: "Inter", size: 9, italic: true, color: { argb: "FF888888" } }

  const buffer = await workbook.xlsx.writeBuffer()
  return bytesFromWriteBuffer(buffer)
}
