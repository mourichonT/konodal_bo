import { collection, doc, limit, onSnapshot, orderBy, query, type Unsubscribe } from "firebase/firestore"
import { httpsCallable } from "firebase/functions"
import { db, functions } from "@/firebase"

// Option CS avancé d'une résidence (konodal_app/functions_python/
// entitlements.py et cs_avance_billing.py) : droits recopiés sur
// residences/{id}.entitlements, abonnement dans residences/{id}/billing/current.

export type CsAvanceState = {
  plan: string // "free" ou "cs_avance"
  mode: string // "none", "active", "grace" ou "read_only"
  until: Date | null
  source: string | null // "grant" (offert) ou "stripe"
  interval: string | null // "month" ou "year"
  byInvoice: boolean
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: Date | null
}

function toDate(value: unknown): Date | null {
  return value && typeof (value as { toDate?: unknown }).toDate === "function"
    ? (value as { toDate: () => Date }).toDate()
    : null
}

export function subscribeToCsAvance(residenceId: string, onChange: (state: CsAvanceState) => void): Unsubscribe {
  let entitlements: Record<string, unknown> = {}
  let billing: Record<string, unknown> = {}
  const emit = () =>
    onChange({
      plan: (entitlements.plan as string) ?? "free",
      mode: (entitlements.mode as string) ?? "none",
      until: toDate(entitlements.until),
      source: (entitlements.source as string) ?? null,
      interval: (billing.interval as string) ?? null,
      byInvoice: billing.collectionMethod === "send_invoice",
      cancelAtPeriodEnd: billing.cancelAtPeriodEnd === true,
      currentPeriodEnd: toDate(billing.currentPeriodEnd),
    })
  const unsubResidence = onSnapshot(doc(db, "residences", residenceId), (snap) => {
    entitlements = (snap.data()?.entitlements as Record<string, unknown>) ?? {}
    emit()
  })
  // Lecture réservée au CS, au syndic et à Konodal (firestore.rules) : en cas
  // de refus, l'état se limite aux droits de la résidence.
  const unsubBilling = onSnapshot(
    doc(db, "residences", residenceId, "billing", "current"),
    (snap) => {
      billing = snap.data() ?? {}
      emit()
    },
    () => undefined
  )
  return () => {
    unsubResidence()
    unsubBilling()
  }
}

/** Lien vers la page de souscription et de gestion (konodal.com/souscription). */
export async function createCsSubscriptionLink(residenceId: string): Promise<string> {
  const call = httpsCallable<{ residenceId: string }, { url: string }>(functions, "create_cs_subscription_link")
  return (await call({ residenceId })).data.url
}

/** Attribution manuelle (superAdmin) : option offerte jusqu'à une date, ou retour au gratuit. */
export async function setResidencePlan(params: {
  residenceId: string
  plan: "free" | "cs_avance"
  until?: string
  reason?: string
}): Promise<void> {
  const call = httpsCallable<typeof params, unknown>(functions, "set_residence_plan")
  await call(params)
}

// --- Onglet Facturation de la fiche résidence (superAdmin) ---
// konodal_app/functions_python/cs_avance_admin.py : get_cs_billing_admin et
// les actions cs_admin_* ; dates reçues en millisecondes.

type Ms = number | null

export type CsInvoiceState = "paid" | "processing" | "pending" | "failed" | "due" | "credit"

export type CsBillingInvoice = {
  id: string
  number: string | null
  date: Date | null
  periodStart: Date | null
  periodEnd: Date | null
  amount: number
  currency: string
  state: CsInvoiceState
  paidAt: Date | null
  dueDate: Date | null
  pdfUrl: string | null
  payUrl: string | null
  hostedUrl: string | null
  byInvoice: boolean
  canSend: boolean
}

export type CsBillingDiscount = {
  code: string | null
  name: string | null
  label: string | null
  start: Date | null
  end: Date | null
}

export type CsBillingAddress = {
  line1: string | null
  line2: string | null
  postal_code: string | null
  city: string | null
  country: string | null
}

export type CsBillingAdmin = {
  lots: number
  graceDays: number
  entitlements: { plan: string; mode: string; source: string | null; until: Date | null; graceUntil: Date | null }
  grant: { until: Date | null; reason: string | null; grantedAt: Date | null; grantedByName: string | null } | null
  subscription: {
    status: string
    subscribed: boolean
    interval: "month" | "year" | null
    billedLots: number | null
    byInvoice: boolean
    scheduledYearly: boolean
    cancelAtPeriodEnd: boolean
    startDate: Date | null
    trialStart: Date | null
    trialEnd: Date | null
    currentPeriodStart: Date | null
    currentPeriodEnd: Date | null
    canceledAt: Date | null
    endedAt: Date | null
    pastDueSince: Date | null
    dashboardUrl: string
  } | null
  reservedDiscount: { label: string | null; code: string | null; at: Date | null; byName: string | null } | null
  discount: CsBillingDiscount | null
  cancellation: { requestedByName: string; expiresAt: Date | null } | null
  upcoming: { date: Date | null; amount: number; currency: string } | null
  invoices: CsBillingInvoice[]
  paymentMethod:
    | { type: "card"; brand: string | null; last4: string | null; expMonth: number | null; expYear: number | null }
    | { type: "sepa_debit"; last4: string | null; country: string | null }
    | { type: "invoice" }
    | { type: string }
    | null
  customer: {
    id: string
    name: string | null
    email: string | null
    address: CsBillingAddress
    siret: string | null
    dashboardUrl: string
  } | null
  testMode: boolean | null
}

const msToDate = (value: Ms | undefined): Date | null => (value ? new Date(value) : null)

// Convertit récursivement les champs de date connus (ms) en Date.
const DATE_KEYS = new Set([
  "until", "graceUntil", "grantedAt", "startDate", "trialStart", "trialEnd", "currentPeriodStart",
  "currentPeriodEnd", "canceledAt", "endedAt", "pastDueSince", "at", "start", "end", "expiresAt", "date",
  "periodStart", "periodEnd", "paidAt", "dueDate",
])

function withDates<T>(value: unknown): T {
  if (Array.isArray(value)) return value.map((item) => withDates(item)) as T
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        DATE_KEYS.has(key) && (typeof item === "number" || item === null) ? msToDate(item as Ms) : withDates(item),
      ])
    ) as T
  }
  return value as T
}

async function callAdmin<T>(name: string, params: Record<string, unknown>): Promise<T> {
  const call = httpsCallable<Record<string, unknown>, T>(functions, name)
  return (await call(params)).data
}

export async function getCsBillingAdmin(residenceId: string): Promise<CsBillingAdmin> {
  return withDates<CsBillingAdmin>(await callAdmin("get_cs_billing_admin", { residenceId }))
}

/** Code promo Stripe, ou `months` mois offerts (100 %). */
export async function applyCsDiscount(residenceId: string, discount: { code: string } | { months: number }) {
  return callAdmin<{ applied: "subscription" | "reserved" }>("cs_admin_discount", {
    residenceId,
    action: "apply",
    ...discount,
  })
}

export async function removeCsDiscount(residenceId: string) {
  await callAdmin("cs_admin_discount", { residenceId, action: "remove" })
}

/** Fin de la période offerte Stripe : "AAAA-MM-JJ" ou "now". */
export async function setCsTrialEnd(residenceId: string, trialEnd: string) {
  await callAdmin("cs_admin_set_trial_end", { residenceId, trialEnd })
}

export type CsCustomerInput = {
  name: string
  email: string
  address: { line1: string; line2: string; postal_code: string; city: string }
  siret: string
}

export async function updateCsCustomer(residenceId: string, input: CsCustomerInput) {
  await callAdmin("cs_admin_update_customer", { residenceId, ...input })
}

export async function createCsInvoiceSubscription(residenceId: string) {
  return callAdmin<{ status: string; invoiceUrl: string | null }>("cs_admin_invoice_subscription", { residenceId })
}

export async function sendCsInvoice(residenceId: string, invoiceId: string) {
  await callAdmin("cs_admin_send_invoice", { residenceId, invoiceId })
}

/** Résilier, garder l'option ou passer à l'annuel (cs_billing_action). */
export async function csBillingAction(residenceId: string, action: "cancel" | "keep" | "switch_yearly") {
  return callAdmin<{ state: string }>("cs_billing_action", { residenceId, action })
}

/** Lien Stripe (24 h) pour enregistrer une nouvelle carte ou un nouvel IBAN. */
export async function createCsPaymentMethodLink(residenceId: string): Promise<string> {
  const { url } = await callAdmin<{ url: string }>("create_cs_payment_method_session", {
    residenceId,
    origin: window.location.origin,
  })
  return url
}

export type CsBillingEvent = { id: string; type: string; label: string; at: Date | null; by: string | null }

const MODE_LABELS: Record<string, string> = {
  none: "offre gratuite",
  active: "actives",
  grace: "délai de grâce",
  read_only: "lecture seule",
}

/** Historique (residences/{id}/billingEvents, lisible par les superAdmin). */
export function subscribeToCsBillingEvents(
  residenceId: string,
  onChange: (events: CsBillingEvent[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "residences", residenceId, "billingEvents"), orderBy("at", "desc"), limit(100)),
    (snap) =>
      onChange(
        snap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            type: (data.type as string) ?? "",
            // Événements antérieurs à l'onglet : pas de phrase enregistrée.
            label:
              (data.label as string) ??
              (data.type === "entitlements_changed"
                ? `Fonctions CS avancé : ${MODE_LABELS[data.from as string] ?? data.from} → ${
                    MODE_LABELS[data.to as string] ?? data.to
                  }`
                : String(data.type ?? "")),
            at: toDate(data.at),
            by: (data.by as string) ?? null,
          }
        })
      ),
    onError
  )
}
