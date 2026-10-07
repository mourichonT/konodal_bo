import { typeLotOptions, defaultIsLinkableForType } from "@/types/lot"
import { structureTypeOptions } from "@/types/structure"
import type { LotInput } from "@/lib/lots"

// Généré ici plutôt qu'importé de lots.ts : LotInput y est défini sans
// `order` calculable à l'avance pour un import (dépend du nombre de lignes
// déjà en base au moment de la confirmation, pas de la lecture du fichier).
export type LotImportInput = Omit<LotInput, "order"> & {
  // Lot principal auquel rattacher ce lot (colonne "Rattaché à") : un lot
  // déjà en base (son id) ou un autre lot du même fichier (sa référence,
  // l'id n'existant pas encore avant l'import).
  parent: { kind: "existing"; id: string } | { kind: "new"; refLot: string } | null
  // Tantièmes par clé de charge (colonnes "Clé : <nom>"), par nom de clé -
  // les valeurs à 0 sont omises (un lot absent de tantiemesParLot vaut 0).
  clefTantiemes: Record<string, number>
}

export const LOT_IMPORT_HEADERS = [
  "Bâtiment",
  "N°",
  "Référence",
  "Type",
  "Rattachable",
  "Tantièmes",
  "Rattaché à (référence)",
  // Facultative, en dernière colonne fixe (ne décale pas les listes
  // déroulantes D/E/F du modèle) : sert à renseigner les étages des
  // bâtiments créés à l'import, pas stockée sur le lot.
  "Étage",
] as const

// Une colonne par clé de charge, nommée "Clé : <nom de la clé>" - le
// préfixe distingue ces colonnes de toute autre colonne libre ajoutée par
// l'utilisateur (ignorée), et permet de créer à l'import une clé qui
// n'existe pas encore (nouvelle résidence).
export const CLEF_HEADER_PREFIX = "Clé : "
const CLEF_HEADER_RE = /^cl[eé]\s*:\s*(.+)$/i

export function lotImportTemplateHeaders(clefNames: string[]): string[] {
  return [...LOT_IMPORT_HEADERS, ...clefNames.map((nom) => CLEF_HEADER_PREFIX + nom)]
}

// Lignes d'exemple des modèles : toute ligne dont la référence commence par
// ce préfixe est ignorée à l'import (validateLotImportRows) - oublier de les
// supprimer ne crée donc jamais de faux lots.
export const EXAMPLE_REF_PREFIX = "EXEMPLE-"

export function isExampleRef(refLot: string): boolean {
  return refLot.trim().toUpperCase().startsWith(EXAMPLE_REF_PREFIX)
}

// Clé d'exemple proposée dans le modèle d'une résidence qui n'en a encore
// aucune - créée seulement si des tantièmes réels y sont saisis (une clé
// inconnue sans aucune valeur n'est jamais créée, cf. validateLotImportRows).
const EXAMPLE_CLEF_NAME = "Ascenseur"

export function lotImportTemplateClefNames(existingClefNames: string[]): string[] {
  return existingClefNames.length > 0 ? existingClefNames : [EXAMPLE_CLEF_NAME]
}

// Deux logements, une cave rattachée au premier, un parking au second -
// couvre chaque colonne, dont "Rattaché à" vers un lot du même fichier.
function lotImportExampleRows(clefNames: string[]): (string | number)[][] {
  const clefValues = (values: number[]) => clefNames.map((_, i) => (i === 0 ? values[0] : values[1] ?? ""))
  return [
    ["Bâtiment A", "1", `${EXAMPLE_REF_PREFIX}001`, "Appartement", "Non", 250, "", "R+1", ...clefValues([300, 250])],
    ["Bâtiment A", "2", `${EXAMPLE_REF_PREFIX}002`, "Appartement", "Non", 180, "", "R+2", ...clefValues([200, 180])],
    [
      "Bâtiment A",
      "C1",
      `${EXAMPLE_REF_PREFIX}C01`,
      "Cave",
      "Oui",
      10,
      `${EXAMPLE_REF_PREFIX}001`,
      "Sous-sol -1",
      ...clefValues([0, 0]),
    ],
    [
      "Parking Extérieur",
      "P1",
      `${EXAMPLE_REF_PREFIX}P01`,
      "Place de parking",
      "Oui",
      15,
      `${EXAMPLE_REF_PREFIX}002`,
      "",
      ...clefValues([0, 0]),
    ],
  ]
}

// Lignes couvertes par les listes déroulantes du modèle .xlsx - largement
// au-delà de la taille d'une copropriété.
const TEMPLATE_VALIDATION_ROWS = 1000

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const UTF8_BOM = String.fromCharCode(0xfeff)

// clefNames : clés de charge déjà définies sur la résidence, une colonne
// chacune dans le modèle.
export function downloadLotImportTemplateCsv(existingClefNames: string[]) {
  const clefNames = lotImportTemplateClefNames(existingClefNames)
  const csv =
    [lotImportTemplateHeaders(clefNames), ...lotImportExampleRows(clefNames)]
      .map((row) => row.join(";"))
      .join("\r\n") + "\r\n"
  // BOM UTF-8 : Excel ouvre sinon les accents (Bâtiment, Référence) mal
  // encodés sur un CSV sans BOM.
  downloadBlob(new Blob([UTF8_BOM + csv], { type: "text/csv;charset=utf-8" }), "modele_lots.csv")
}

// exceljs chargé à la demande (uniquement quand ce fichier sert vraiment) -
// même raison que ResidencesMap/maplibre-gl : évite d'alourdir le bundle
// principal pour une fonctionnalité utilisée occasionnellement.
export async function downloadLotImportTemplateXlsx(existingClefNames: string[]) {
  const clefNames = lotImportTemplateClefNames(existingClefNames)
  const ExcelJS = await import("exceljs")
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("Lots")
  sheet.addRow(lotImportTemplateHeaders(clefNames))
  sheet.getRow(1).font = { bold: true }
  for (const example of lotImportExampleRows(clefNames)) {
    sheet.addRow(example).font = { italic: true, color: { argb: "FF808080" } }
  }
  sheet.columns = [
    { width: 20 },
    { width: 8 },
    { width: 14 },
    { width: 20 },
    { width: 14 },
    { width: 12 },
    { width: 24 },
    { width: 12 },
    ...clefNames.map((nom) => ({ width: Math.max(14, CLEF_HEADER_PREFIX.length + nom.length + 2) })),
  ]
  sheet.views = [{ state: "frozen", ySplit: 1 }]

  // Types de lot sur une feuille à part (référencée par la liste
  // déroulante) plutôt qu'en liste inline : une liste inline Excel est
  // limitée à 255 caractères. Seule la première feuille est relue à
  // l'import (parseXlsxFile), celle-ci est donc ignorée.
  const valuesSheet = workbook.addWorksheet("Valeurs")
  valuesSheet.addRow(["Types de lot", "", "Aide"])
  valuesSheet.getRow(1).font = { bold: true }
  const help = [
    "Bâtiment, N° et Référence sont obligatoires.",
    `Bâtiment : "<type> <nom>", type parmi ${structureTypeOptions.join(", ")} -`,
    'ex. "Bâtiment A", "Parking Extérieur". Un bâtiment absent de la résidence est créé à l\'import.',
    'Étage (facultatif) : "RdC", "R+2", "2", "Sous-sol -1"... - donne les étages des bâtiments créés.',
    "Rattaché à : référence du lot principal (appartement...) pour une cave, un",
    "parking... marqué Rattachable = Oui - lot du fichier ou déjà existant.",
    `Une colonne "${CLEF_HEADER_PREFIX}<nom>" par clé de charge : tantièmes du lot pour`,
    "cette clé. Une clé qui n'existe pas encore est créée à l'import.",
    `Les lignes dont la référence commence par "${EXAMPLE_REF_PREFIX}" sont des exemples,`,
    "ignorés à l'import : remplacez-les ou laissez-les.",
  ]
  typeLotOptions.forEach((type, i) => valuesSheet.addRow([type, "", help[i] ?? ""]))
  valuesSheet.getColumn(1).width = 22
  valuesSheet.getColumn(3).width = 80
  const typeRange = `Valeurs!$A$2:$A$${typeLotOptions.length + 1}`

  for (let row = 2; row <= TEMPLATE_VALIDATION_ROWS + 1; row++) {
    sheet.getCell(`D${row}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [typeRange],
      showErrorMessage: true,
      errorTitle: "Type inconnu",
      error: "Choisissez un type dans la liste.",
    }
    sheet.getCell(`E${row}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"Oui,Non"'],
      showErrorMessage: true,
      errorTitle: "Valeur non reconnue",
      error: "Oui ou Non.",
    }
    // Tantièmes généraux (colonne F) puis une colonne par clé de charge.
    const tantiemesColumns = [6, ...clefNames.map((_, i) => LOT_IMPORT_HEADERS.length + 1 + i)]
    for (const column of tantiemesColumns) {
      sheet.getCell(row, column).dataValidation = {
        type: "whole",
        operator: "greaterThanOrEqual",
        allowBlank: true,
        formulae: [0],
        showErrorMessage: true,
        errorTitle: "Tantièmes invalides",
        error: "Nombre entier positif ou nul attendu.",
      }
    }
  }
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

// Rapprochement nom de colonne <-> clé de charge existante : casse et
// espaces ignorés ("Ascenseur" = "ascenseur ").
export function clefNameKey(nom: string): string {
  return nom.trim().toLowerCase().replace(/\s+/g, " ")
}

// Libellé d'un bâtiment tel que le tableau des lots le référence
// (Lot.batiment = "<type> <nom>" d'une structure, cf. buildingOptions dans
// LotsSection).
export function structureLabel(s: { type: string; name: string }): string {
  return `${s.type} ${s.name}`.trim()
}

// Rapprochement libellé du fichier <-> structure : accents, casse et
// espaces ignorés ("Extérieur" = "Exterieur", "bâtiment a" = "Bâtiment A").
function structureLabelKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
}

// Bâtiment absent de la résidence, à créer à l'import (comme une clé de
// charge inconnue). Le libellé est toujours "<type> <nom>" : le type en tête
// parmi structureTypeOptions, le nom ensuite ("Bâtiment A" -> Bâtiment / A,
// "Parking Extérieur" -> Parking / Extérieur). null si le libellé ne commence
// pas par un type ou n'a pas de nom ("A", "Extérieur" seuls) : ligne en
// erreur plutôt qu'un type deviné - un mot comme "Extérieur" est un nom
// ("Parking Extérieur"), jamais un type à lui seul.
export function parseStructureLabel(label: string): { type: string; name: string } | null {
  const key = structureLabelKey(label)
  const types = [...structureTypeOptions].sort((a, b) => b.length - a.length)
  for (const type of types) {
    const typeKey = structureLabelKey(type)
    if (key.startsWith(typeKey + " ")) {
      const name = label.trim().slice(type.length).trim()
      if (name) return { type, name }
    }
  }
  return null
}

// Niveau d'un étage saisi librement : 0 = rez-de-chaussée, n > 0 = étage n,
// n < 0 = sous-sol n. null = non renseigné ("", "-", "Ext."), undefined =
// non reconnu (ligne en erreur).
export function parseEtageLevel(raw: string): number | null | undefined {
  const v = raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
  if (v === "" || v === "-" || v === "ext" || v === "ext." || v === "exterieur") return null
  if (/^(rdc|r\.?d\.?c\.?|rez[- ]de[- ]chaussee|rez de jardin|0)$/.test(v)) return 0
  let m = /^(?:sous[- ]?sol|ss|s\/sol)\s*-?\s*(\d*)$/.exec(v)
  if (m) return -(Number(m[1]) || 1)
  m = /^(?:r\s*-\s*|-\s*)(\d+)$/.exec(v)
  if (m) return -Number(m[1])
  m = /^(?:r\s*\+\s*|etage\s*)?(\d+)\s*(?:er|e|eme|ème)?(?:\s*etage)?$/.exec(v)
  if (m) return Number(m[1])
  return undefined
}

// Liste d'étages d'un bâtiment, même format que buildEtage (saisie manuelle
// dans la configuration de la résidence) : du RDC à l'étage le plus haut,
// puis les sous-sols.
function etagesFromLevels(levels: number[]): { etage: string[]; hasUnderground: boolean } {
  if (levels.length === 0) return { etage: [], hasUnderground: false }
  const max = Math.max(0, ...levels)
  const min = Math.min(0, ...levels)
  const etage = ["RDC"]
  for (let i = 1; i <= max; i++) etage.push(`étage ${i}`)
  for (let i = 1; i <= -min; i++) etage.push(`Sous-sol -${i}`)
  return { etage, hasUnderground: min < 0 }
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
  tantiemesRaw: string
  parentRefRaw: string
  etageRaw: string
  // Valeur brute par nom de clé de charge (colonnes "Clé : <nom>").
  clefsRaw: Record<string, string>
}

// Sépare la résolution des colonnes (peut échouer globalement si le modèle
// n'est pas respecté) de la validation ligne par ligne (peut échouer
// partiellement, une ligne en erreur n'empêche pas les autres).
export function mapLotImportHeaders(
  headers: string[],
  rows: string[][]
): { rows: RawLotImportRow[]; clefNames: string[]; headerErrors: string[] } {
  const normalized = headers.map(normalizeHeader)
  const col = {
    batiment: normalized.indexOf("batiment"),
    lot: normalized.indexOf("n"),
    refLot: normalized.indexOf("reference"),
    typeLot: normalized.indexOf("type"),
    isLinkable: normalized.indexOf("rattachable"),
    // Colonne facultative : un fichier rempli avec l'ancien modèle (5
    // colonnes) reste importable, tantièmes à 0.
    tantiemes: normalized.indexOf("tantiemes"),
    // "Rattaché à (référence)" -> "rattacheareference" ; jamais confondu
    // avec "rattachable" (comparé exactement ci-dessus).
    parentRef: normalized.findIndex((h) => h.startsWith("rattachea")),
    etage: normalized.indexOf("etage"),
  }
  const clefColumns: { nom: string; index: number }[] = []
  headers.forEach((h, index) => {
    const match = CLEF_HEADER_RE.exec(h.trim())
    if (match) clefColumns.push({ nom: match[1].trim(), index })
  })
  const headerErrors: string[] = []
  if (col.batiment === -1) headerErrors.push('Colonne "Bâtiment" introuvable.')
  if (col.lot === -1) headerErrors.push('Colonne "N°" introuvable.')
  if (col.refLot === -1) headerErrors.push('Colonne "Référence" introuvable.')
  const seenClefs = new Set<string>()
  for (const { nom } of clefColumns) {
    const key = clefNameKey(nom)
    if (seenClefs.has(key)) headerErrors.push(`Colonne "${CLEF_HEADER_PREFIX}${nom}" présente deux fois.`)
    seenClefs.add(key)
  }
  if (headerErrors.length > 0) return { rows: [], clefNames: [], headerErrors }

  return {
    headerErrors: [],
    clefNames: clefColumns.map((c) => c.nom),
    rows: rows
      .filter((cols) => cols.some((c) => c.trim() !== ""))
      .map((cols, i) => ({
        rowNumber: i + 2, // +1 ligne d'en-tête, +1 pour repasser en 1-based
        batiment: (cols[col.batiment] ?? "").trim(),
        lot: (cols[col.lot] ?? "").trim(),
        refLot: (cols[col.refLot] ?? "").trim(),
        typeLot: col.typeLot >= 0 ? (cols[col.typeLot] ?? "").trim() : "",
        isLinkableRaw: col.isLinkable >= 0 ? (cols[col.isLinkable] ?? "").trim() : "",
        tantiemesRaw: col.tantiemes >= 0 ? (cols[col.tantiemes] ?? "").trim() : "",
        parentRefRaw: col.parentRef >= 0 ? (cols[col.parentRef] ?? "").trim() : "",
        etageRaw: col.etage >= 0 ? (cols[col.etage] ?? "").trim() : "",
        clefsRaw: Object.fromEntries(clefColumns.map(({ nom, index }) => [nom, (cols[index] ?? "").trim()])),
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

// Entier positif ou nul (cf. Lot.tantiemes) - vide = 0. Espaces tolérés
// ("1 250", séparateur de milliers fréquent en saisie française).
function parseTantiemes(raw: string): { value: number; error?: string } {
  const compact = raw.replace(/\s/g, "")
  if (compact === "") return { value: 0 }
  const value = Number(compact)
  if (!Number.isInteger(value) || value < 0) {
    return { value: 0, error: `tantièmes "${raw}" invalides, nombre entier positif ou nul attendu` }
  }
  return { value }
}

export type LotImportValidation = {
  toCreate: LotImportInput[]
  duplicatesExisting: string[]
  duplicatesInFile: string[]
  errors: string[]
  // Clés de charge du fichier : id de la clé existante correspondante, ou
  // null si elle sera créée à l'import.
  clefs: { nom: string; existingId: string | null }[]
  // Bâtiments cités par le fichier et absents de la résidence, créés à
  // l'import (structures/{id}) ; les lots portent déjà leur libellé final.
  // `etage`/`hasUnderground` : même format que la saisie manuelle
  // (buildEtage, ResidenceDetailPage : "RDC", "étage 1"..., "Sous-sol -1"...),
  // déduits des étages des lots du fichier ; vides si aucun n'est renseigné.
  structuresToCreate: { type: string; name: string; label: string; etage: string[]; hasUnderground: boolean }[]
  linkedCount: number
  exampleRowsIgnored: number
}

export type ExistingLotForImport = {
  id?: string
  refLot: string
  batiment: string
  lot: string
  isLinkable: boolean
  parentLotId?: string | null
}

// Aucun écrasement des lots déjà en base (les doublons - même référence, ou
// même bâtiment+n° - sont ignorés, jamais fusionnés/mis à jour) ; un doublon
// à l'intérieur du fichier lui-même (deux lignes identiques) ne garde que la
// première occurrence.
export function validateLotImportRows(
  rawRows: RawLotImportRow[],
  existingLots: ExistingLotForImport[],
  clefNames: string[] = [],
  existingClefs: { id: string; nom: string }[] = [],
  existingStructures: { type: string; name: string }[] = []
): LotImportValidation {
  // Libellé final du bâtiment de chaque ligne : celui de la structure
  // existante correspondante, sinon celui de la structure qui sera créée.
  const labelByKey = new Map(existingStructures.map((s) => [structureLabelKey(structureLabel(s)), structureLabel(s)]))
  const structuresToCreate: { type: string; name: string; label: string }[] = []
  function resolveBatiment(raw: string): string | null {
    const key = structureLabelKey(raw)
    const known = labelByKey.get(key)
    if (known) return known
    const parsed = parseStructureLabel(raw)
    if (!parsed) return null
    const label = structureLabel(parsed)
    // Deux graphies du fichier pour un même bâtiment ("Bâtiment A" /
    // "batiment a") ne créent qu'une structure.
    const parsedKnown = labelByKey.get(structureLabelKey(label))
    if (parsedKnown) {
      labelByKey.set(key, parsedKnown)
      return parsedKnown
    }
    structuresToCreate.push({ ...parsed, label })
    labelByKey.set(key, label)
    labelByKey.set(structureLabelKey(label), label)
    return label
  }

  const existingRefs = new Set(existingLots.map((l) => l.refLot.trim()).filter(Boolean))
  const existingCombos = new Set(
    existingLots
      .filter((l) => l.batiment.trim() && l.lot.trim())
      .map((l) => `${l.batiment.trim()}|${l.lot.trim()}`)
  )
  const seenRefs = new Set<string>()
  const seenCombos = new Set<string>()

  const toCreate: (LotImportInput & { rowNumber: number; parentRefRaw: string })[] = []
  // Niveau d'étage de chaque lot retenu (par référence) - sert uniquement à
  // renseigner les étages des bâtiments créés.
  const levelByRef = new Map<string, number>()
  const duplicatesExisting: string[] = []
  const duplicatesInFile: string[] = []
  const errors: string[] = []

  let exampleRowsIgnored = 0
  for (const row of rawRows) {
    if (isExampleRef(row.refLot)) {
      exampleRowsIgnored++
      continue
    }
    const label = `Ligne ${row.rowNumber}`
    if (!row.batiment || !row.lot || !row.refLot) {
      errors.push(`${label} : bâtiment, n° et référence sont obligatoires.`)
      continue
    }
    const batiment = resolveBatiment(row.batiment)
    if (!batiment) {
      errors.push(
        `${label} : bâtiment "${row.batiment}" non reconnu - indiquer "<type> <nom>", le type parmi ${structureTypeOptions.join(", ")} (ex. "Bâtiment A", "Parking Extérieur").`
      )
      continue
    }
    row.batiment = batiment
    const etageLevel = parseEtageLevel(row.etageRaw)
    if (etageLevel === undefined) {
      errors.push(`${label} : étage "${row.etageRaw}" non reconnu (ex. "RdC", "R+2", "2", "Sous-sol -1").`)
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
    const { value: tantiemes, error: tantiemesError } = parseTantiemes(row.tantiemesRaw)
    if (tantiemesError) {
      errors.push(`${label} : ${tantiemesError}`)
      continue
    }
    const clefTantiemes: Record<string, number> = {}
    let clefError: string | null = null
    for (const nom of clefNames) {
      const parsed = parseTantiemes(row.clefsRaw[nom] ?? "")
      if (parsed.error) {
        clefError = `clé "${nom}" : ${parsed.error}`
        break
      }
      if (parsed.value > 0) clefTantiemes[nom] = parsed.value
    }
    if (clefError) {
      errors.push(`${label} : ${clefError}`)
      continue
    }
    if (row.parentRefRaw && !isLinkable) {
      errors.push(`${label} : "Rattaché à" renseigné mais le lot n'est pas rattachable (Rattachable = Oui attendu).`)
      continue
    }
    if (row.parentRefRaw === row.refLot) {
      errors.push(`${label} : un lot ne peut pas être rattaché à lui-même.`)
      continue
    }
    if (etageLevel !== null) levelByRef.set(row.refLot, etageLevel)
    seenRefs.add(row.refLot)
    seenCombos.add(combo)
    toCreate.push({
      refLot: row.refLot,
      batiment: row.batiment,
      lot: row.lot,
      typeLot: row.typeLot,
      isLinkable,
      tantiemes,
      parent: null,
      clefTantiemes,
      rowNumber: row.rowNumber,
      parentRefRaw: row.parentRefRaw,
    })
  }

  // Résolution des rattachements une fois toutes les lignes lues (le lot
  // principal peut figurer plus bas dans le fichier). Mêmes garde-fous que
  // sync_lot_tenants côté serveur : parent non rattachable lui-même, et pas
  // déjà enfant d'un autre lot (un seul niveau).
  const newByRef = new Map(toCreate.map((l) => [l.refLot, l]))
  const existingByRef = new Map(
    existingLots.filter((l) => l.id && l.refLot.trim()).map((l) => [l.refLot.trim(), l])
  )
  const resolved: LotImportInput[] = []
  let linkedCount = 0
  for (const { rowNumber, parentRefRaw, ...lot } of toCreate) {
    if (!parentRefRaw) {
      resolved.push(lot)
      continue
    }
    const label = `Ligne ${rowNumber}`
    const newParent = newByRef.get(parentRefRaw)
    const existingParent = existingByRef.get(parentRefRaw)
    if (newParent) {
      if (newParent.isLinkable) {
        errors.push(`${label} : le lot principal "${parentRefRaw}" est lui-même rattachable, il ne peut pas recevoir de lot rattaché.`)
        continue
      }
      resolved.push({ ...lot, parent: { kind: "new", refLot: parentRefRaw } })
    } else if (existingParent?.id) {
      if (existingParent.isLinkable || existingParent.parentLotId) {
        errors.push(`${label} : le lot "${parentRefRaw}" est un lot rattachable, il ne peut pas servir de lot principal.`)
        continue
      }
      resolved.push({ ...lot, parent: { kind: "existing", id: existingParent.id } })
    } else {
      errors.push(`${label} : lot principal "${parentRefRaw}" introuvable (ni dans le fichier, ni dans la résidence).`)
      continue
    }
    linkedCount++
  }

  const existingClefByKey = new Map(existingClefs.map((c) => [clefNameKey(c.nom), c.id]))
  // Une clé à créer sans aucune valeur saisie (ex: colonne d'exemple du
  // modèle laissée vide) est écartée plutôt que créée vide.
  const clefs = clefNames
    .map((nom) => ({ nom, existingId: existingClefByKey.get(clefNameKey(nom)) ?? null }))
    .filter((c) => c.existingId || resolved.some((lot) => lot.clefTantiemes[c.nom]))

  // Erreurs de rattachement relevées après les autres : retri par ligne.
  const lineOf = (e: string) => Number(/^Ligne (\d+)/.exec(e)?.[1] ?? 0)
  errors.sort((x, y) => lineOf(x) - lineOf(y))

  // Bâtiment créé uniquement si une ligne retenue l'utilise (pas pour une
  // ligne en erreur ou en doublon).
  const levelsByLabel = new Map<string, number[]>()
  for (const lot of resolved) {
    const level = levelByRef.get(lot.refLot)
    if (!levelsByLabel.has(lot.batiment)) levelsByLabel.set(lot.batiment, [])
    if (level !== undefined) levelsByLabel.get(lot.batiment)!.push(level)
  }
  return {
    toCreate: resolved,
    duplicatesExisting,
    duplicatesInFile,
    errors,
    clefs,
    structuresToCreate: structuresToCreate
      .filter((s) => levelsByLabel.has(s.label))
      .map((s) => ({ ...s, ...etagesFromLevels(levelsByLabel.get(s.label)!) })),
    linkedCount,
    exampleRowsIgnored,
  }
}
