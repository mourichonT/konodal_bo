import { useState } from "react"

export type SortDirection = "asc" | "desc"
export type SortKind = "text" | "date" | "number"
type Millis = { toMillis(): number }
export type SortValue = string | number | boolean | Date | Millis | null | undefined

// Une fonction suffit pour un texte, une date ou un nombre. Pour un ordre
// métier (statut, priorité...), value renvoie le rang et labels décrit les
// deux sens au survol.
type SortColumnDef<T> = {
  value: (row: T) => SortValue
  kind?: SortKind
  labels?: Record<SortDirection, string>
  first?: SortDirection
}
type SortColumn<T> = ((row: T) => SortValue) | SortColumnDef<T>

export type SortHeadProps = {
  direction: SortDirection | null
  title: string
  onSort: () => void
}

const LABELS: Record<SortKind, Record<SortDirection, string>> = {
  date: { desc: "du plus récent au plus ancien", asc: "du plus ancien au plus récent" },
  number: { desc: "du plus grand au plus petit", asc: "du plus petit au plus grand" },
  text: { asc: "de A à Z", desc: "de Z à A" },
}

// Sens du premier clic : le plus récent ou le plus grand d'abord pour une
// date ou un nombre, l'ordre alphabétique pour un texte.
const FIRST_DIRECTION: Record<SortKind, SortDirection> = { date: "desc", number: "desc", text: "asc" }

function normalize(value: SortValue): string | number | null {
  if (value == null) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime()
  if (typeof value === "object") return value.toMillis()
  if (typeof value === "boolean") return Number(value)
  if (typeof value === "number") return Number.isNaN(value) ? null : value
  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed
}

function kindOf(value: SortValue): SortKind {
  if (value instanceof Date || (typeof value === "object" && value != null)) return "date"
  return typeof value === "number" ? "number" : "text"
}

/** Tri stable de rows selon value ; valeurs vides en dernier dans les deux sens. */
export function sortRows<T>(rows: T[], value: (row: T) => SortValue, direction: SortDirection): T[] {
  const factor = direction === "asc" ? 1 : -1
  return rows
    .map((row) => ({ row, key: normalize(value(row)) }))
    .sort((a, b) => {
      if (a.key == null || b.key == null) return a.key == null ? (b.key == null ? 0 : 1) : -1
      const diff =
        typeof a.key === "number" && typeof b.key === "number"
          ? a.key - b.key
          : String(a.key).localeCompare(String(b.key), "fr", { numeric: true, sensitivity: "base" })
      return diff * factor
    })
    .map(({ row }) => row)
}

// Tri des tableaux du BO par clic sur l'en-tête (SortableTableHead) :
// 1er clic dans le sens naturel de la colonne, 2e dans l'autre sens, 3e
// retour à l'ordre de la page (rows tel que reçu). Les valeurs vides
// restent toujours en fin de liste ; à égalité, l'ordre de la page est
// gardé (tri stable).
export function useTableSort<T, K extends string>(rows: T[], columns: Record<K, SortColumn<T>>) {
  const [sort, setSort] = useState<{ key: K; direction: SortDirection } | null>(null)

  const accessor = (key: K): SortColumnDef<T> => {
    const column: SortColumn<T> = columns[key]
    return typeof column === "function" ? { value: column } : column
  }

  const kindFor = (key: K): SortKind => {
    const { value, kind } = accessor(key)
    if (kind) return kind
    for (const row of rows) {
      const v = value(row)
      if (normalize(v) != null) return kindOf(v)
    }
    return "text"
  }

  const sortedRows = sort ? sortRows(rows, accessor(sort.key).value, sort.direction) : rows

  const headProps = (key: K): SortHeadProps => {
    const column = accessor(key)
    const kind = kindFor(key)
    const labels = column.labels ?? LABELS[kind]
    const first = column.first ?? FIRST_DIRECTION[kind]
    const direction = sort?.key === key ? sort.direction : null
    const next: SortDirection | null = direction == null ? first : direction === first ? (first === "asc" ? "desc" : "asc") : null
    return {
      direction,
      title: next ? `Trier ${labels[next]}` : "Revenir à l'ordre par défaut",
      onSort: () => setSort(next ? { key, direction: next } : null),
    }
  }

  return { sortedRows, headProps }
}
