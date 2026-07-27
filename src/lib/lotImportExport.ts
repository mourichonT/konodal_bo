import { typeLotOptions, defaultIsLinkableForType } from "@/types/lot"
import type { LotInput } from "@/lib/lots"

// Généré ici plutôt qu'importé de lots.ts : LotInput y est défini sans
// `order` calculable à l'avance pour un import (dépend du nombre de lignes
// déjà en base au moment de la confirmation, pas de la lecture du fichier).
export type LotImportInput = Omit<LotInput, "order">

export const LOT_IMPORT_HEADERS = ["Bâtiment", "N°", "Référence", "Type", "Rattachable"] as const

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const UTF8_BOM = String.fromCharCode(0xfeff)

export function downloadLotImportTemplateCsv() {
  const csv = LOT_IMPORT_HEADERS.join(";") + "\r\n"
  // BOM UTF-8 : Excel ouvre sinon les accents (Bâtiment, Référence) mal
  // encodés sur un CSV sans BOM.
  downloadBlob(new Blob([UTF8_BOM + csv], { type: "text/csv;charset=utf-8" }), "modele_lots.csv")
}

// exceljs chargé à la demande (uniquement quand ce fichier sert vraiment) -
// même raison que ResidencesMap/maplibre-gl : évite d'alourdir le bundle
// principal pour une fonctionnalité utilisée occasionnellement.
export async function downloadLotImportTemplateXlsx() {
  const ExcelJS = await import("exceljs")
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("Lots")
  sheet.addRow([...LOT_IMPORT_HEADERS])
  sheet.getRow(1).font = { bold: true }
  sheet.columns = [{ width: 20 }, { width: 8 }, { width: 14 }, { width: 20 }, { width: 14 }]
  const buffer = await workbook.xlsx.writeBuffer()
  downloadBlob(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    "modele_lots.xlsx"
  )
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === delimiter) {
      result.push(current)
      current = ""
    } else {
      current += char
    }
  }
  result.push(current)
  return result.map((v) => v.trim())
}

function parseCsvText(text: string): { headers: string[]; rows: string[][] } {
  const cleaned = text.startsWith(UTF8_BOM) ? text.slice(1) : text
  const lines = cleaned.split(/\r\n|\r|\n/).filter((line) => line.trim() !== "")
  if (lines.length === 0) return { headers: [], rows: [] }
  const [headerLine, ...dataLines] = lines
  return {
    headers: parseCsvLine(headerLine, ";"),
    rows: dataLines.map((line) => parseCsvLine(line, ";")),
  }
}

async function parseXlsxFile(file: File): Promise<{ headers: string[]; rows: string[][] }> {
  const ExcelJS = await import("exceljs")
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await file.arrayBuffer())
  const sheet = workbook.worksheets[0]
  if (!sheet) return { headers: [], rows: [] }
  const rows: string[][] = []
  sheet.eachRow((row) => {
    // ExcelJS indexe row.values à partir de 1 (l'index 0 est toujours vide).
    const values = (row.values as unknown[]).slice(1)
    rows.push(values.map((v) => (v == null ? "" : String(v)).trim()))
  })
  const [headers, ...dataRows] = rows
  return { headers: headers ?? [], rows: dataRows }
}

// File.text() décode toujours en UTF-8 et remplace les octets invalides par
// U+FFFD : un CSV enregistré par Excel en Windows-1252 (le défaut de "CSV
// (séparateur: point-virgule)" en France) y perdait ses accents, "Bâtiment"
// devenait "B�timent" et normalizeHeader() n'y reconnaissait plus la
// colonne - l'import échouait sur "Colonne Bâtiment introuvable". On décode
// donc les octets nous-mêmes : BOM s'il y en a un, sinon UTF-8 strict avec
// repli sur windows-1252 dès qu'une séquence est invalide.
async function decodeCsvFile(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(bytes)
  }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes)
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes)
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  } catch {
    // Un fichier UTF-8 valide n'est presque jamais du windows-1252 valide et
    // réciproquement : le repli ne se déclenche donc pas sur de l'UTF-8 bien
    // formé.
    return new TextDecoder("windows-1252").decode(bytes)
  }
}

export async function parseLotImportFile(file: File): Promise<{ headers: string[]; rows: string[][] }> {
  const isCsv = file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv"
  if (isCsv) {
    return parseCsvText(await decodeCsvFile(file))
  }
  return parseXlsxFile(file)
}

// Tolère les variations d'en-tête (accents, casse, "N°" avec son symbole
// degré non couvert par la normalisation NFD des diacritiques classiques).
function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]/g, "")
}

export type RawLotImportRow = {
  rowNumber: number
  batiment: string
  lot: string
  refLot: string
  typeLot: string
  isLinkableRaw: string
}

// Sépare la résolution des colonnes (peut échouer globalement si le modèle
// n'est pas respecté) de la validation ligne par ligne (peut échouer
// partiellement, une ligne en erreur n'empêche pas les autres).
export function mapLotImportHeaders(
  headers: string[],
  rows: string[][]
): { rows: RawLotImportRow[]; headerErrors: string[] } {
  const normalized = headers.map(normalizeHeader)
  const col = {
    batiment: normalized.indexOf("batiment"),
    lot: normalized.indexOf("n"),
    refLot: normalized.indexOf("reference"),
    typeLot: normalized.indexOf("type"),
    isLinkable: normalized.indexOf("rattachable"),
  }
  const headerErrors: string[] = []
  if (col.batiment === -1) headerErrors.push('Colonne "Bâtiment" introuvable.')
  if (col.lot === -1) headerErrors.push('Colonne "N°" introuvable.')
  if (col.refLot === -1) headerErrors.push('Colonne "Référence" introuvable.')
  if (headerErrors.length > 0) return { rows: [], headerErrors }

  return {
    headerErrors: [],
    rows: rows
      .filter((cols) => cols.some((c) => c.trim() !== ""))
      .map((cols, i) => ({
        rowNumber: i + 2, // +1 ligne d'en-tête, +1 pour repasser en 1-based
        batiment: (cols[col.batiment] ?? "").trim(),
        lot: (cols[col.lot] ?? "").trim(),
        refLot: (cols[col.refLot] ?? "").trim(),
        typeLot: col.typeLot >= 0 ? (cols[col.typeLot] ?? "").trim() : "",
        isLinkableRaw: col.isLinkable >= 0 ? (cols[col.isLinkable] ?? "").trim() : "",
      })),
  }
}

const TRUE_VALUES = new Set(["oui", "true", "vrai", "1", "yes", "x"])
const FALSE_VALUES = new Set(["non", "false", "faux", "0", "no", ""])

function parseIsLinkable(raw: string, typeLot: string): { value: boolean; error?: string } {
  const normalized = raw.trim().toLowerCase()
  if (TRUE_VALUES.has(normalized)) return { value: true }
  if (FALSE_VALUES.has(normalized)) return { value: false }
  return {
    value: defaultIsLinkableForType(typeLot),
    error: `valeur "Rattachable" non reconnue ("${raw}"), Oui/Non attendu`,
  }
}

export type LotImportValidation = {
  toCreate: LotImportInput[]
  duplicatesExisting: string[]
  duplicatesInFile: string[]
  errors: string[]
}

// Aucun écrasement des lots déjà en base (les doublons - même référence, ou
// même bâtiment+n° - sont ignorés, jamais fusionnés/mis à jour) ; un doublon
// à l'intérieur du fichier lui-même (deux lignes identiques) ne garde que la
// première occurrence.
export function validateLotImportRows(
  rawRows: RawLotImportRow[],
  existingLots: { refLot: string; batiment: string; lot: string }[]
): LotImportValidation {
  const existingRefs = new Set(existingLots.map((l) => l.refLot.trim()).filter(Boolean))
  const existingCombos = new Set(
    existingLots
      .filter((l) => l.batiment.trim() && l.lot.trim())
      .map((l) => `${l.batiment.trim()}|${l.lot.trim()}`)
  )
  const seenRefs = new Set<string>()
  const seenCombos = new Set<string>()

  const toCreate: LotImportInput[] = []
  const duplicatesExisting: string[] = []
  const duplicatesInFile: string[] = []
  const errors: string[] = []

  for (const row of rawRows) {
    const label = `Ligne ${row.rowNumber}`
    if (!row.batiment || !row.lot || !row.refLot) {
      errors.push(`${label} : bâtiment, n° et référence sont obligatoires.`)
      continue
    }
    if (row.typeLot && !(typeLotOptions as readonly string[]).includes(row.typeLot)) {
      errors.push(`${label} : type "${row.typeLot}" inconnu.`)
      continue
    }
    const combo = `${row.batiment}|${row.lot}`
    if (existingRefs.has(row.refLot) || existingCombos.has(combo)) {
      duplicatesExisting.push(`${label} (${row.refLot})`)
      continue
    }
    if (seenRefs.has(row.refLot) || seenCombos.has(combo)) {
      duplicatesInFile.push(`${label} (${row.refLot})`)
      continue
    }
    const { value: isLinkable, error } = parseIsLinkable(row.isLinkableRaw, row.typeLot)
    if (error) {
      errors.push(`${label} : ${error}`)
      continue
    }
    seenRefs.add(row.refLot)
    seenCombos.add(combo)
    toCreate.push({ refLot: row.refLot, batiment: row.batiment, lot: row.lot, typeLot: row.typeLot, isLinkable })
  }

  return { toCreate, duplicatesExisting, duplicatesInFile, errors }
}
