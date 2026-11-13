// Date et heure de publication d'une communication programmée, saisies dans
// l'heure locale du navigateur (le BO est utilisé en France) et stockées en
// instant absolu (Timestamp publishAt).

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

/** "AAAA-MM-JJ", format de <input type="date"> (DateInput). */
export function toDateField(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** "HH:MM", format de <input type="time">. */
export function toTimeField(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function toPublishAt(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null
  const d = new Date(`${date}T${time}:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Proposition par défaut : la prochaine heure pleine. */
export function nextFullHour(now: Date = new Date()): Date {
  const d = new Date(now)
  d.setMinutes(0, 0, 0)
  d.setHours(d.getHours() + 1)
  return d
}

/** "13/11/2026 à 12h00". */
export function formatPublishAt(d: Date): string {
  return `${d.toLocaleDateString("fr-FR")} à ${pad(d.getHours())}h${pad(d.getMinutes())}`
}

/** Message d'erreur si la date saisie n'est pas utilisable, null sinon. */
export function publishAtError(publishAt: Date | null, now: Date = new Date()): string | null {
  if (!publishAt) return "Choisissez la date et l'heure de publication"
  if (publishAt.getTime() <= now.getTime()) return "L'heure de publication est déjà passée"
  return null
}
