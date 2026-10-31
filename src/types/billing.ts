import type { ServiceType } from "@/types/gerance"

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
  "paused",
  "incomplete",
  "incomplete_expired",
] as const
export type BillingStatus = (typeof BILLING_STATUSES)[number]

export const billingStatusLabels: Record<BillingStatus, string> = {
  none: "Aucun abonnement",
  trialing: "Période d'essai",
  active: "Actif",
  past_due: "Paiement en retard",
  canceled: "Annulé",
  unpaid: "Impayé",
  paused: "Suspendu",
  incomplete: "Premier paiement en attente",
  incomplete_expired: "Premier paiement expiré",
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
  paused: "border-transparent bg-amber-100 text-amber-800",
  incomplete: "border-transparent bg-amber-100 text-amber-800",
  incomplete_expired: "border-transparent bg-red-100 text-red-800",
}

// Licences (functions_python/licence_billing.py, décision du 2026-10-22) :
// licences service (une par service souscrit, 2 au maximum) et licences
// agent (stock), deux lignes du même abonnement Stripe. "legacy" : ancienne
// formule (un prix par siège) en attente de migration.

export type GeranceBilling = {
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  status: BillingStatus
  // Total des licences (service + agent + ancienne formule).
  seatCount: number
  serviceSeatCount: number
  agentSeatCount: number
  legacySeatCount: number
  // Services souscrits (metadata de l'abonnement) et compte de chaque
  // service, tenus par le serveur.
  serviceLicences: ServiceType[]
  serviceAccounts: Partial<Record<ServiceType, string>>
  licenceModel: "v2" | "legacy" | null
  licenceMismatch: boolean
  // Agents sans licence (« Libérer la licence ») : hors des tableaux de la
  // gérance, donc sans accès, mais toujours dans l'équipe avec leurs services.
  unlicensedAgents: Record<string, ServiceType[]>
  canceledByKonodal: boolean
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd?: boolean
}

// Renvoyés par get_billing_overview (functions_python/main.py) - interrogés
// en direct chez Stripe à l'ouverture de l'onglet Abonnement, jamais
// dénormalisés en Firestore (contrairement à GeranceBilling ci-dessus).
export type BillingPaymentMethod = {
  brand: string | null
  last4: string | null
  expMonth: number | null
  expYear: number | null
  name: string | null
}

export const INVOICE_STATUSES = ["draft", "open", "paid", "uncollectible", "void"] as const
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

export const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  draft: "Brouillon",
  open: "En attente",
  paid: "Payée",
  uncollectible: "Impayée",
  void: "Annulée",
}

export type BillingInvoice = {
  id: string
  date: Date | null
  number: string | null
  totalCents: number
  totalExcludingTaxCents: number | null
  currency: string
  status: InvoiceStatus
  hostedInvoiceUrl: string | null
  invoicePdf: string | null
}

// Dernière facture encore à régler (get_billing_overview) : intentStatus
// requires_action = authentification bancaire demandée, requires_payment_method
// = prélèvement refusé (declineCode), processing = en cours.
export type BillingPaymentIssue = {
  amountDueCents: number
  attemptCount: number
  nextAttempt: Date | null
  hostedInvoiceUrl: string | null
  intentStatus: string | null
  declineCode: string | null
  errorMessage: string | null
}

export type BillingOverview = {
  paymentMethod: BillingPaymentMethod | null
  invoices: BillingInvoice[]
  customerEmail: string | null
  trialStart: Date | null
  trialEnd: Date | null
  // Prochaine facture calculée par Stripe (remises et prorata compris), en
  // centimes ; null sans facture à venir.
  upcomingTotalCents: number | null
  paymentIssue: BillingPaymentIssue | null
  servicePriceCents: number | null
  agentPriceCents: number | null
  priceCurrency: string | null
}

// Renvoyés par get_license_kpis (functions_python/main.py) - dashboard
// Super Admin, interrogés en direct chez Stripe (historique mensuel
// indisponible en Firestore, qui ne porte que l'état courant par gérance).
export type LicenseKpiTotals = {
  activeSeats: number
  trialingSeats: number
  pastDueSeats: number
  payingAgencies: number
  trialingAgencies: number
  pastDueAgencies: number
  cancelingAgencies: number
  cancelingSeats: number
  churnedAgencies30d: number
  newAgencies30d: number
  mrrCents: number
  arrCents: number
  arpaCents: number
  openInvoicesCents: number
  openInvoicesCount: number
  revenue30dCents: number
  // Licences attribuables (actif, essai, retard) par type.
  serviceSeats: number
  agentSeats: number
}

export type LicenseKpiMonth = {
  // "AAAA-MM"
  month: string
  seats: number
  serviceSeats: number
  agentSeats: number
  addedSeats: number
  removedSeats: number
  revenueCents: number
  newAgencies: number
}

export type LicenseKpiAgency = {
  geranceId: string
  name: string
  status: BillingStatus
  seats: number
  serviceSeats: number
  agentSeats: number
  mrrCents: number
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
}

// Option CS avancé (abonnements de résidence, cs_avance_billing.py) : bloc
// csAvance de get_license_kpis. "grant" : option offerte, sans abonnement
// Stripe.
export type CsAvanceKpiTotals = {
  activeResidences: number
  trialingResidences: number
  pastDueResidences: number
  offeredResidences: number
  billedLots: number
  offeredLots: number
  mrrCents: number
  arrCents: number
  cancelingResidences: number
  churnedResidences30d: number
  newResidences30d: number
  revenue30dCents: number
  openInvoicesCents: number
  openInvoicesCount: number
}

export type CsAvanceKpiResidence = {
  residenceId: string
  name: string
  status: BillingStatus | "grant"
  lots: number
  interval: "month" | "year" | null
  byInvoice: boolean
  mrrCents: number
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
}

export type CsAvanceKpis = {
  totals: CsAvanceKpiTotals
  // "AAAA-MM" ; résidences abonnées chez Stripe en fin de mois.
  monthly: { month: string; residences: number; revenueCents: number }[]
  residences: CsAvanceKpiResidence[]
}

export type LicenseKpis = {
  currency: string
  servicePriceCents: number | null
  agentPriceCents: number | null
  totals: LicenseKpiTotals
  monthly: LicenseKpiMonth[]
  agencies: LicenseKpiAgency[]
  // Absents tant que get_license_kpis n'est pas redéployée.
  csAvance?: CsAvanceKpis
  forecast?: RevenueForecast
  realized?: RealizedRevenue
}

// CA réalisé hors taxes (_realized_revenue) : factures payées, à leur date
// de paiement.
export type RealizedRevenue = {
  year: number
  yearCents: number
  yearLicencesCents: number
  yearCsCents: number
  monthCents: number
  last12mCents: number
}

// Prévisionnel (_revenue_forecast) : CA mensuel une fois tous les essais
// devenus payants, au prix catalogue hors remises, et activations à venir
// (une option seulement offerte, sans abonnement, ne compte pas). date null :
// abonnement en pause, reprise sans date.
export type RevenueForecastActivation = {
  type: "licences" | "cs"
  id: string
  name: string
  date: Date | null
  source: "trial" | "paused"
  serviceSeats: number
  agentSeats: number
  lots: number
  mrrCents: number
}

export type RevenueForecast = {
  totals: {
    currentMrrCents: number
    targetMrrCents: number
    targetArrCents: number
    pendingMrrCents: number
    lostMrrCents: number
    laterMrrCents: number
    pendingServiceSeats: number
    pendingAgentSeats: number
    pendingResidences: number
    pausedSubscriptions: number
    // Options offertes sans abonnement : non comptées.
    offeredResidences: number
  }
  // "AAAA-MM", à partir du mois en cours ; mrrCents = MRR prévu en fin de mois.
  monthly: {
    month: string
    licenceMrrCents: number
    csMrrCents: number
    serviceSeats: number
    agentSeats: number
    residences: number
    lostMrrCents: number
    mrrCents: number
  }[]
  activations: RevenueForecastActivation[]
}
