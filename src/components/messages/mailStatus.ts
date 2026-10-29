import type { PillTone } from "@/components/agency/agencyUi"
import type { MailCategory, MailStatus } from "@/lib/messages"

// Statut d'un mail dans la boîte (liste et volet de lecture).
export const MAIL_STATUS: Record<MailStatus, { label: string; tone: PillTone }> = {
  nodo_pending: { label: "Lecture par Nodo", tone: "grey" },
  nodo_answered: { label: "Répondu par Nodo", tone: "green" },
  nodo_forwarded: { label: "Transmis par Nodo", tone: "grey" },
  resident_forwarded: { label: "Retransmis par le résident", tone: "amber" },
  sent: { label: "Envoyé au syndic", tone: "grey" },
  sending: { label: "Envoi en cours", tone: "grey" },
  error: { label: "Échec d'envoi", tone: "red" },
  reply: { label: "Réponse du syndic", tone: "green" },
  outgoing: { label: "Message du syndic", tone: "green" },
}

export const MAIL_CATEGORY_LABELS: Record<MailCategory, string> = {
  travaux: "Travaux et équipements",
  sinistre: "Sinistre",
  charges: "Charges et paiements",
  ag: "Assemblée générale",
  nuisances: "Nuisances et voisinage",
  administratif: "Administratif et documents",
  autre: "Autre",
}

// Onglets et filtres de la liste.
export type MailboxTab = "inbox" | "nodo"
export type MailboxFilter =
  "all" | "urgent" | "residents" | "syndic" | "errors" | "answered" | "forwarded" | "retransmitted" | "pending"

export const TAB_FILTERS: Record<MailboxTab, { key: MailboxFilter; label: string }[]> = {
  inbox: [
    { key: "all", label: "Tous" },
    { key: "urgent", label: "Urgents" },
    { key: "residents", label: "Des résidents" },
    { key: "syndic", label: "Du syndic" },
    { key: "errors", label: "Échecs" },
  ],
  nodo: [
    { key: "all", label: "Tous" },
    { key: "urgent", label: "Urgents" },
    { key: "answered", label: "Répondus" },
    { key: "forwarded", label: "Transmis" },
    { key: "retransmitted", label: "Retransmis" },
    { key: "pending", label: "En cours" },
  ],
}

export const FILTER_STATUSES: Partial<Record<MailboxFilter, MailStatus[]>> = {
  errors: ["error"],
  answered: ["nodo_answered"],
  forwarded: ["nodo_forwarded"],
  retransmitted: ["resident_forwarded"],
  pending: ["nodo_pending"],
}

// « 14:32 » aujourd'hui, « 12 oct. » cette année, « 12/10/2025 » sinon.
export function formatListDate(date: Date | null, now = new Date()): string {
  if (!date) return ""
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  }
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
  }
  return date.toLocaleDateString("fr-FR")
}

export function formatFullDate(date: Date | null): string {
  if (!date) return ""
  return date.toLocaleString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}
