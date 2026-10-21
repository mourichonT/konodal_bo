// Écran affiché dans l'onglet Documents, gardé dans l'URL (?v=...) pour que
// le retour arrière et les liens fonctionnent.
export type GedSelection =
  | { kind: "overview" }
  | { kind: "trash" }
  | { kind: "internal" }
  | { kind: "search"; query: string }
  | { kind: "category"; category: string }
  | { kind: "residence"; residenceId: string }
  | { kind: "building"; residenceId: string; batiment: string }
  | { kind: "lot"; residenceId: string; lotId: string }

export function selectionFromParams(params: URLSearchParams): GedSelection {
  const view = params.get("v") ?? "overview"
  const residenceId = params.get("r") ?? ""
  switch (view) {
    case "trash":
    case "internal":
      return { kind: view }
    case "search":
      return { kind: "search", query: params.get("q") ?? "" }
    case "category":
      return { kind: "category", category: params.get("c") ?? "" }
    case "residence":
      return residenceId ? { kind: "residence", residenceId } : { kind: "overview" }
    case "building":
      return residenceId ? { kind: "building", residenceId, batiment: params.get("b") ?? "" } : { kind: "overview" }
    case "lot":
      return residenceId && params.get("l")
        ? { kind: "lot", residenceId, lotId: params.get("l")! }
        : { kind: "overview" }
    default:
      return { kind: "overview" }
  }
}

export function selectionToParams(selection: GedSelection): Record<string, string> {
  switch (selection.kind) {
    case "overview":
      return {}
    case "trash":
    case "internal":
      return { v: selection.kind }
    case "search":
      return { v: "search", q: selection.query }
    case "category":
      return { v: "category", c: selection.category }
    case "residence":
      return { v: "residence", r: selection.residenceId }
    case "building":
      return { v: "building", r: selection.residenceId, b: selection.batiment }
    case "lot":
      return { v: "lot", r: selection.residenceId, l: selection.lotId }
  }
}

export function selectedResidenceId(selection: GedSelection): string | null {
  return "residenceId" in selection ? selection.residenceId : null
}

// Épinglées et récentes : préférences du navigateur (localStorage), jamais
// bloquantes (navigation privée, stockage refusé).
export function readStoredIds(key: string): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "[]")
    return Array.isArray(value) ? value.filter((v) => typeof v === "string") : []
  } catch {
    return []
  }
}

export function writeStoredIds(key: string, ids: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(ids))
  } catch {
    // préférence non conservée, sans conséquence
  }
}

export const PINNED_KEY = "ged.pinnedResidences"
export const RECENT_KEY = "ged.recentResidences"
