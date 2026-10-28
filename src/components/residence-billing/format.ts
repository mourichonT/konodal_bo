// Formats partagés par l'onglet Facturation de la fiche résidence.

export function formatAmount(cents: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100)
}

export function formatDate(date: Date | null | undefined): string {
  return date ? date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "—"
}

export function formatShortDate(date: Date | null | undefined): string {
  return date ? date.toLocaleDateString("fr-FR") : "—"
}

/** Jours entiers d'ici à date (négatif si passée). */
export function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000)
}

/** "AAAA-MM-JJ" à N mois d'aujourd'hui (ou de from), pour un DateInput. */
export function isoInMonths(months: number, from: Date = new Date()): string {
  const date = new Date(from)
  date.setMonth(date.getMonth() + months)
  return toIsoDate(date)
}

export function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
