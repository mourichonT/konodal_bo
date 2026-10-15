// Prédicats des barres de filtres : champ vide = pas de borne, bornes
// incluses (dates : du début du jour "du" à la fin du jour "au").

export function inNumberRange(value: number, min: string, max: string): boolean {
  if (min !== "" && value < Number(min)) return false
  if (max !== "" && value > Number(max)) return false
  return true
}

export function inDateRange(date: Date | null, from: string, to: string): boolean {
  if (!from && !to) return true
  if (!date) return false
  if (from && date < new Date(`${from}T00:00:00`)) return false
  if (to && date > new Date(`${to}T23:59:59`)) return false
  return true
}
