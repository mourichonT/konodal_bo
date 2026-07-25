// Statuts d'un abonnement Stripe (gerances/{id}/billing/current) - miroir
// direct de `subscription.status` côté Stripe, plus "none" (jamais souscrit,
// document absent côté BO) qui n'existe pas comme valeur Stripe elle-même.
export const BILLING_STATUSES = [
  "none",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
] as const
export type BillingStatus = (typeof BILLING_STATUSES)[number]

export const billingStatusLabels: Record<BillingStatus, string> = {
  none: "Aucun abonnement",
  trialing: "Période d'essai",
  active: "Actif",
  past_due: "Paiement en retard",
  canceled: "Annulé",
  unpaid: "Impayé",
}

// Même pattern que statusBadgeClass (SinistresListPage.tsx) : un
// Record<Statut, classes> + fallback sur "none" côté appelant.
export const billingStatusBadgeClass: Record<BillingStatus, string> = {
  none: "border-transparent bg-slate-100 text-slate-800",
  trialing: "border-transparent bg-sky-100 text-sky-800",
  active: "border-transparent bg-emerald-100 text-emerald-800",
  past_due: "border-transparent bg-amber-100 text-amber-800",
  canceled: "border-transparent bg-red-100 text-red-800",
  unpaid: "border-transparent bg-red-100 text-red-800",
}

export type GeranceBilling = {
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  stripeSubscriptionItemId?: string
  status: BillingStatus
  seatCount: number
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd?: boolean
}
