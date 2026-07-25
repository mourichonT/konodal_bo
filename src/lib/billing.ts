import { doc, onSnapshot, type DocumentData, type DocumentSnapshot, type Unsubscribe } from "firebase/firestore"
import { httpsCallable } from "firebase/functions"
import { db, functions } from "@/firebase"
import type { BillingOverview, BillingStatus, InvoiceStatus, GeranceBilling } from "@/types/billing"

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
    stripeSubscriptionItemId: data.stripeSubscriptionItemId as string | undefined,
    status: (data.status as BillingStatus) ?? "none",
    seatCount: (data.seatCount as number) ?? 0,
    currentPeriodEnd: toDateOrNull(data.currentPeriodEnd),
    cancelAtPeriodEnd: (data.cancelAtPeriodEnd as boolean) ?? false,
  }
}

// Document jamais créé tant qu'une gérance n'a pas au moins entamé un
// Checkout - un doc absent est un statut "none" au même titre qu'un doc
// existant avec `status: "none"`, pas une erreur.
const NO_BILLING: GeranceBilling = {
  status: "none",
  seatCount: 0,
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
// `origin` (window.location.origin) permet à la Cloud Function de construire
// les URL de retour Stripe sans dépendre d'un domaine figé côté serveur.
export async function createCheckoutSession(geranceId: string): Promise<{ url: string }> {
  const call = httpsCallable<{ geranceId: string; origin: string }, { url: string }>(
    functions,
    "create_checkout_session"
  )
  const result = await call({ geranceId, origin: window.location.origin })
  return result.data
}

export async function createBillingPortalSession(geranceId: string): Promise<{ url: string }> {
  const call = httpsCallable<{ geranceId: string; origin: string }, { url: string }>(
    functions,
    "create_billing_portal_session"
  )
  const result = await call({ geranceId, origin: window.location.origin })
  return result.data
}

// Moyen de paiement + historique de factures - un seul appel côté serveur
// (get_billing_overview), pas un listener temps réel : interrogé chez
// Stripe à la demande (page /facturation), pas dénormalisé en Firestore.
type BillingOverviewResponse = {
  paymentMethod: {
    brand: string | null
    last4: string | null
    expMonth: number | null
    expYear: number | null
  } | null
  invoices: {
    id: string
    date: number | null
    totalCents: number
    currency: string
    status: string
    hostedInvoiceUrl: string | null
  }[]
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
      totalCents: inv.totalCents,
      currency: inv.currency,
      status: inv.status as InvoiceStatus,
      hostedInvoiceUrl: inv.hostedInvoiceUrl,
    })),
  }
}
