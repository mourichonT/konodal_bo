import { doc, onSnapshot, type Unsubscribe } from "firebase/firestore"
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
