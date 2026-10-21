import { LOT_DOCUMENT_CATEGORIES, RESIDENCE_DOCUMENT_CATEGORIES } from "@/types/document"

// GED (onglet Documents) : un document reste à sa place, un seul
// enregistrement (décision de l'utilisateur) - documents_copro pour une
// résidence ou un bâtiment (champ batiment), users/{uid}/lots/{lotId}/
// documents pour un lot (un exemplaire par destinataire, même id).
export type GedScope = "residence" | "building" | "lot"

// internal = non partagé (adminOnly, superAdmin seul, fichier dans
// adminDocuments/{rid}/) ; cs = conseil syndical (csOnly) ; owners =
// propriétaires (audience "proprietaires", même champ et même filtre de l'app
// que les communications réservées aux propriétaires) ; shared = toute la
// résidence, les occupants du bâtiment ou les destinataires du lot.
export type GedVisibility = "internal" | "cs" | "owners" | "shared"

export type GedHistoryEntry = {
  at: Date | null
  by: string
  byName: string
  action: string
  detail?: string
}

export type GedDocument = {
  key: string
  scope: GedScope
  residenceId: string
  lotId: string | null
  id: string
  // Document de lot : comptes qui l'ont dans leur liste (exemplaires
  // existants) et destinataires d'origine (champ destinataire).
  holders: string[]
  recipients: string[]
  name: string
  category: string
  extension: string
  timeStamp: Date | null
  documentDate: Date | null
  adminOnly: boolean
  csOnly: boolean
  ownersOnly: boolean
  batiment: string
  tags: string[]
  deletedAt: Date | null
  url: string
  storagePath: string
  size: number
  contentType: string
  history: GedHistoryEntry[]
}

// Élément renvoyé par ged_overview / ged_find (functions_python/ged.py).
export type GedFoundDocument = {
  scope: GedScope
  residenceId: string
  residenceName: string
  lotId: string | null
  id: string
  holders: string[]
  recipients: string[]
  name: string
  category: string
  extension: string
  timeStamp: string | null
  documentDate: string | null
  adminOnly: boolean
  csOnly: boolean
  ownersOnly: boolean
  batiment: string
  tags: string[]
  deletedAt: string | null
  url: string
  storagePath: string
  size: number
  lot?: { refLot: string; batiment: string; lot: string; typeLot: string }
  // Recherche : passage du fichier qui contient les mots cherchés, et les
  // mots trouvés (à une lettre près : « MOUIAL » pour « moual »).
  excerpt?: string
  excerptWords?: string[]
}

export type GedResidenceStats = {
  documents: number
  internal: number
  residence: number
  buildings: Record<string, number>
  lots: Record<string, number>
}

export type GedOverview = {
  residences: Record<string, GedResidenceStats>
  categories: Record<string, number>
  totals: { documents: number; internal: number; addedThisWeek: number; trash: number }
  recent: GedFoundDocument[]
  residenceCount: number
  lotCount: number
}

// Sans « Justificatif », « Kbis » ni « Attestation de propriété » : les
// justificatifs n'apparaissent jamais dans la GED (cf. isPersonalDocument,
// lib/ged.ts).
export const GED_CATEGORIES: string[] = [
  ...new Set<string>([
    ...RESIDENCE_DOCUMENT_CATEGORIES,
    "Plans",
    ...LOT_DOCUMENT_CATEGORIES.filter((c) => c !== "Autre" && c !== "Justificatif"),
    "Autre",
  ]),
]

export function visibilityOf(document: Pick<GedDocument, "adminOnly" | "csOnly" | "ownersOnly">): GedVisibility {
  return document.adminOnly ? "internal" : document.csOnly ? "cs" : document.ownersOnly ? "owners" : "shared"
}

export function visibilityLabel(document: Pick<GedDocument, "adminOnly" | "csOnly" | "ownersOnly" | "scope">): string {
  const visibility = visibilityOf(document)
  if (visibility === "internal") return "Non partagé"
  if (visibility === "cs") return "Conseil syndical"
  if (visibility === "owners") return "Propriétaires"
  return document.scope === "lot" ? "Partagé avec le lot" : document.scope === "building" ? "Occupants du bâtiment" : "Partagé"
}

export const VISIBILITY_BADGE_CLASS: Record<GedVisibility, string> = {
  internal: "border-amber-300 bg-amber-50 text-amber-800",
  cs: "border-sky-200 bg-sky-50 text-sky-800",
  owners: "border-violet-200 bg-violet-50 text-violet-800",
  shared: "border-emerald-200 bg-emerald-50 text-emerald-800",
}

// Partage proposé à l'import d'un document de résidence selon sa catégorie
// (modifiable) : assemblées générales et documents juridiques (règlement de
// copropriété...) aux propriétaires, le reste à toute la résidence.
const OWNERS_CATEGORIES = new Set(["Assemblées générales", "Documents juridiques de la copropriété"])

export function defaultResidenceVisibility(category: string): GedVisibility {
  return OWNERS_CATEGORIES.has(category) ? "owners" : "shared"
}

export function formatFileSize(bytes: number): string {
  if (!bytes) return ""
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`
}
