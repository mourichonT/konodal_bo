import { appBaseUrl } from "@/lib/utils"
import { doc, onSnapshot, type DocumentData, type DocumentSnapshot, type Unsubscribe } from "firebase/firestore"
import { httpsCallable } from "firebase/functions"
import { db, functions } from "@/firebase"
import type {
  BillingOverview,
  BillingPaymentIssue,
  BillingStatus,
  InvoiceStatus,
  GeranceBilling,
  LicenseKpiAgency,
  LicenseKpis,
} from "@/types/billing"
import type { ServiceType } from "@/types/gerance"

function billingRef(geranceId: string) {
  return doc(db, "gerances", geranceId, "billing", "current")
}

function toDateOrNull(value: unknown): Date | null {
  return value && typeof (value as { toDate?: unknown }).toDate === "function"
    ? (value as { toDate: () => Date }).toDate()
    : null
}

function toGeranceBilling(d: DocumentSnapshot<DocumentData>): GeranceBilling {
  const data = d.data() ?? {}
  return {
    stripeCustomerId: data.stripeCustomerId as string | undefined,
    stripeSubscriptionId: data.stripeSubscriptionId as string | undefined,
    status: (data.status as BillingStatus) ?? "none",
    seatCount: (data.seatCount as number) ?? 0,
    serviceSeatCount: (data.serviceSeatCount as number) ?? 0,
    agentSeatCount: (data.agentSeatCount as number) ?? 0,
    legacySeatCount: (data.legacySeatCount as number) ?? 0,
    serviceLicences: (data.serviceLicences as ServiceType[]) ?? [],
    serviceAccounts: (data.serviceAccounts as GeranceBilling["serviceAccounts"]) ?? {},
    licenceModel: (data.licenceModel as GeranceBilling["licenceModel"]) ?? null,
    licenceMismatch: (data.licenceMismatch as boolean) ?? false,
    unlicensedAgents: (data.unlicensedAgents as GeranceBilling["unlicensedAgents"]) ?? {},
    canceledByKonodal: (data.canceledByKonodal as boolean) ?? false,
    currentPeriodEnd: toDateOrNull(data.currentPeriodEnd),
    cancelAtPeriodEnd: (data.cancelAtPeriodEnd as boolean) ?? false,
  }
}

// Document jamais créé tant qu'une gérance n'a pas au moins entamé un
// Checkout - un doc absent est un statut "none" au même titre qu'un doc
// existant avec `status: "none"`, pas une erreur.
export const NO_BILLING: GeranceBilling = {
  status: "none",
  seatCount: 0,
  serviceSeatCount: 0,
  agentSeatCount: 0,
  legacySeatCount: 0,
  serviceLicences: [],
  serviceAccounts: {},
  licenceModel: null,
  licenceMismatch: false,
  unlicensedAgents: {},
  canceledByKonodal: false,
  currentPeriodEnd: null,
}

export function subscribeToGeranceBilling(
  geranceId: string,
  onData: (billing: GeranceBilling) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    billingRef(geranceId),
    (snapshot) => onData(snapshot.exists() ? toGeranceBilling(snapshot) : NO_BILLING),
    onError
  )
}

// Cloud Functions réservées à l'agence elle-même ou Super Admin
// (_require_superadmin_or_own_agence côté functions_python/main.py), même
// patron d'appel que inviteAgencyAccount/revokeAgencyAccount (lib/gerances.ts).
// `origin` (appBaseUrl(), préfixe /portail inclus) permet à la Cloud Function de construire
// les URL de retour Stripe sans dépendre d'un domaine figé côté serveur.
// Licences à souscrire : services cochés (au moins un activé sur la fiche) et
// stock de licences agent ; le serveur garde au moins les comptes en place.
export async function createCheckoutSession(
  geranceId: string,
  licences: { services?: ServiceType[]; agents?: number } = {}
): Promise<{ url: string }> {
  const call = httpsCallable<
    { geranceId: string; origin: string; services?: ServiceType[]; agents?: number },
    { url: string }
  >(functions, "create_checkout_session")
  const result = await call({ geranceId, origin: appBaseUrl(), ...licences })
  return result.data
}

// Ajouter / Retirer des licences sur un abonnement en cours (adjust_licences,
// functions_python/licence_billing.py) : superAdmin ou l'agence elle-même.
// requestId : un double clic ne facture qu'une fois (idempotence Stripe).
export type LicenceAction =
  | { action: "addService" | "removeService"; serviceType: ServiceType }
  | { action: "addAgents" | "removeAgents"; count: number }
  | { action: "resume" }

export async function adjustLicences(geranceId: string, change: LicenceAction): Promise<void> {
  const call = httpsCallable<LicenceAction & { geranceId: string; requestId: string }, { success: boolean }>(
    functions,
    "adjust_licences"
  )
  await call({ geranceId, requestId: crypto.randomUUID(), ...change })
}

export async function createBillingPortalSession(geranceId: string): Promise<{ url: string }> {
  const call = httpsCallable<{ geranceId: string; origin: string }, { url: string }>(
    functions,
    "create_billing_portal_session"
  )
  const result = await call({ geranceId, origin: appBaseUrl() })
  return result.data
}

// Migration de l'ancienne formule (un prix par siège) vers les licences
// service et agent (admin_migrate_licences, superAdmin) : bilan à blanc
// d'abord (comptes, remises, aperçu de facture), puis migration réelle.
export type LicenceMigrationDiscount = {
  level: "abonnement" | "ligne"
  name?: string | null
  promotionCode?: string | null
  percentOff?: number | null
  amountOffCents?: number | null
  duration?: string | null
  action: string
}

export type LicenceMigrationReport = {
  geranceId: string
  name: string | null
  status: string
  alreadyMigrated?: boolean
  blocked?: boolean
  migrated?: boolean
  accounts: { email: string; licence: string }[]
  services?: ServiceType[]
  agents?: number
  legacyQuantity?: number
  discounts: LicenceMigrationDiscount[]
  warnings: string[]
  preview?: Record<string, { totalCents?: number; discountCents?: number; error?: string; note?: string }>
}

export async function migrateLicences(geranceId: string, dryRun: boolean): Promise<LicenceMigrationReport | null> {
  const call = httpsCallable<
    { geranceId: string; dryRun: boolean },
    { dryRun: boolean; agencies: LicenceMigrationReport[] }
  >(functions, "admin_migrate_licences", { timeout: 300_000 })
  const { data } = await call({ geranceId, dryRun })
  return data.agencies[0] ?? null
}

// Fin de l'essai déplacée par un superAdmin (admin_set_licence_trial_end) :
// "AAAA-MM-JJ", midi UTC, 2 ans au plus, sans prorata ; billing/current suit.
export async function setLicenceTrialEnd(geranceId: string, trialEnd: string): Promise<void> {
  const call = httpsCallable<{ geranceId: string; trialEnd: string }, { trialEnd: number; status: string }>(
    functions,
    "admin_set_licence_trial_end"
  )
  await call({ geranceId, trialEnd })
}

// Carte bancaire saisie dans l'onglet Abonnement (Stripe Elements,
// licence_billing.py) : SetupIntent créé par le serveur et confirmé par le
// navigateur, puis enregistré comme carte du client et de l'abonnement (la
// carte vient du SetupIntent, jamais d'un identifiant envoyé par le BO).
export async function createCardSetup(geranceId: string): Promise<string> {
  const call = httpsCallable<{ geranceId: string }, { clientSecret: string }>(functions, "create_card_setup")
  return (await call({ geranceId })).data.clientSecret
}

export async function saveCard(geranceId: string, setupIntentId: string): Promise<void> {
  const call = httpsCallable<{ geranceId: string; setupIntentId: string }, { success: boolean }>(
    functions,
    "save_card"
  )
  await call({ geranceId, setupIntentId })
}

// « Réessayer le paiement » de la dernière facture ouverte avec la carte
// enregistrée (retry_payment) ; requiresAction : la banque demande une
// authentification, à faire sur la page de facture Stripe.
export async function retryPayment(
  geranceId: string
): Promise<{ paid: boolean; message?: string | null; requiresAction?: boolean; hostedInvoiceUrl?: string | null }> {
  const call = httpsCallable<
    { geranceId: string },
    { paid: boolean; message?: string | null; requiresAction?: boolean; hostedInvoiceUrl?: string | null }
  >(functions, "retry_payment")
  return (await call({ geranceId })).data
}

export async function deleteCard(geranceId: string): Promise<void> {
  const call = httpsCallable<{ geranceId: string }, { success: boolean }>(functions, "delete_card")
  await call({ geranceId })
}

// Moyen de paiement + historique de factures - un seul appel côté serveur
// (get_billing_overview), pas un listener temps réel : interrogé chez
// Stripe à la demande (onglet Abonnement), pas dénormalisé en Firestore.
type BillingOverviewResponse = {
  paymentMethod: {
    brand: string | null
    last4: string | null
    expMonth: number | null
    expYear: number | null
    name: string | null
  } | null
  invoices: {
    id: string
    date: number | null
    number: string | null
    totalCents: number
    totalExcludingTaxCents: number | null
    currency: string
    status: string
    hostedInvoiceUrl: string | null
    invoicePdf: string | null
  }[]
  customerEmail: string | null
  trialStart: number | null
  trialEnd: number | null
  upcomingTotalCents?: number | null
  paymentIssue?: (Omit<BillingPaymentIssue, "nextAttempt"> & { nextAttempt: number | null }) | null
  servicePriceCents: number | null
  agentPriceCents: number | null
  priceCurrency: string | null
}

export async function getBillingOverview(geranceId: string): Promise<BillingOverview> {
  const call = httpsCallable<{ geranceId: string }, BillingOverviewResponse>(
    functions,
    "get_billing_overview"
  )
  const { data } = await call({ geranceId })
  return {
    paymentMethod: data.paymentMethod,
    invoices: data.invoices.map((inv) => ({
      id: inv.id,
      date: inv.date ? new Date(inv.date * 1000) : null,
      number: inv.number ?? null,
      totalCents: inv.totalCents,
      totalExcludingTaxCents: inv.totalExcludingTaxCents ?? null,
      currency: inv.currency,
      status: inv.status as InvoiceStatus,
      hostedInvoiceUrl: inv.hostedInvoiceUrl,
      invoicePdf: inv.invoicePdf ?? null,
    })),
    customerEmail: data.customerEmail,
    trialStart: data.trialStart ? new Date(data.trialStart * 1000) : null,
    trialEnd: data.trialEnd ? new Date(data.trialEnd * 1000) : null,
    upcomingTotalCents: data.upcomingTotalCents ?? null,
    paymentIssue: data.paymentIssue
      ? {
          ...data.paymentIssue,
          nextAttempt: data.paymentIssue.nextAttempt ? new Date(data.paymentIssue.nextAttempt * 1000) : null,
        }
      : null,
    servicePriceCents: data.servicePriceCents,
    agentPriceCents: data.agentPriceCents,
    priceCurrency: data.priceCurrency,
  }
}

// KPI licences du dashboard (Super Admin uniquement, _require_superadmin
// côté get_license_kpis) - même principe que getBillingOverview : appel
// ponctuel chez Stripe, pas de listener.
type LicenseKpisResponse = Omit<LicenseKpis, "agencies"> & {
  agencies: (Omit<LicenseKpiAgency, "currentPeriodEnd"> & { currentPeriodEnd: number | null })[]
}

export async function getLicenseKpis(): Promise<LicenseKpis> {
  const call = httpsCallable<void, LicenseKpisResponse>(functions, "get_license_kpis")
  const { data } = await call()
  return {
    ...data,
    agencies: data.agencies.map((agency) => ({
      ...agency,
      currentPeriodEnd: agency.currentPeriodEnd ? new Date(agency.currentPeriodEnd * 1000) : null,
    })),
  }
}
