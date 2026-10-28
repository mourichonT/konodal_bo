import { useState } from "react"
import { toast } from "sonner"
import { CalendarClock, ExternalLink, Link2, MoreVertical, RotateCcw, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  createCsPaymentMethodLink,
  createCsSubscriptionLink,
  csBillingAction,
  type CsBillingAdmin,
} from "@/lib/csAvance"
import { BillingTimeline } from "./BillingTimeline"
import { ConfirmActionDialog } from "./ConfirmActionDialog"
import { formatAmount, formatDate } from "./format"

const BADGE = {
  slate: "border-transparent bg-slate-100 text-slate-800",
  sky: "border-transparent bg-sky-100 text-sky-800",
  emerald: "border-transparent bg-emerald-100 text-emerald-800",
  amber: "border-transparent bg-amber-100 text-amber-800",
  red: "border-transparent bg-red-100 text-red-800",
}

function statusOf(data: CsBillingAdmin): { label: string; className: string } {
  const { entitlements: ent, grant, subscription: sub } = data
  if (ent.mode === "read_only") return { label: "Lecture seule", className: BADGE.red }
  if (sub && ["past_due", "unpaid", "incomplete"].includes(sub.status)) {
    return { label: "Paiement en retard", className: BADGE.red }
  }
  if (ent.mode === "grace") {
    return { label: `Délai de grâce jusqu'au ${formatDate(ent.graceUntil)}`, className: BADGE.amber }
  }
  if (ent.plan === "free" || ent.mode === "none") return { label: "Offre gratuite", className: BADGE.slate }
  if (grant) {
    return {
      label: grant.until ? `Offerte jusqu'au ${formatDate(grant.until)}` : "Offerte sans fin",
      className: BADGE.sky,
    }
  }
  if (sub?.status === "trialing") return { label: "Période offerte", className: BADGE.sky }
  if (sub?.cancelAtPeriodEnd) {
    return { label: `Résiliée, active jusqu'au ${formatDate(sub.currentPeriodEnd)}`, className: BADGE.amber }
  }
  return { label: "Active", className: BADGE.emerald }
}

function paymentLabel(data: CsBillingAdmin): string {
  const pm = data.paymentMethod
  if (!data.subscription) return "—"
  if (!pm) return "Aucun moyen de paiement enregistré"
  if (pm.type === "invoice") return "Facture au syndicat (virement sous 30 jours)"
  if (pm.type === "card" && "brand" in pm) {
    const exp = pm.expMonth && pm.expYear ? ` · exp. ${String(pm.expMonth).padStart(2, "0")}/${pm.expYear}` : ""
    return `Carte ${pm.brand ?? ""} •••• ${pm.last4 ?? "----"}${exp}`
  }
  if (pm.type === "sepa_debit" && "last4" in pm) return `Prélèvement SEPA •••• ${pm.last4 ?? "----"}`
  return pm.type
}

// En-tête de l'onglet Facturation : état de l'option CS avancé, formule,
// prochaine échéance, frise de la période et actions sur l'abonnement.
export function SubscriptionCard({
  residenceId,
  data,
  onChanged,
}: {
  residenceId: string
  data: CsBillingAdmin
  onChanged: () => Promise<void>
}) {
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [busy, setBusy] = useState(false)
  const sub = data.subscription
  const status = statusOf(data)
  const subscribed = sub?.subscribed ?? false
  const discount = data.discount
    ? `${data.discount.label ?? data.discount.name ?? "Remise"}${data.discount.code ? ` (code ${data.discount.code})` : ""}${
        data.discount.end ? `, jusqu'au ${formatDate(data.discount.end)}` : ""
      }`
    : data.reservedDiscount
      ? `${data.reservedDiscount.label ?? "Remise"}, réservée pour la souscription`
      : "Aucune"

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true)
    try {
      await action()
      toast.success(success)
      await onChanged()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function openSubscriptionPage() {
    // Fenêtre ouverte tout de suite : après l'appel au serveur, le
    // navigateur la bloquerait comme une fenêtre surgissante.
    const target = window.open("", "_blank")
    try {
      const url = await createCsSubscriptionLink(residenceId)
      if (target) target.location.href = url
      else window.location.href = url
    } catch (err) {
      target?.close()
      toast.error("Impossible d'ouvrir la page de souscription : " + (err as Error).message)
    }
  }

  async function copyPaymentLink() {
    setBusy(true)
    try {
      const url = await createCsPaymentMethodLink(residenceId)
      await navigator.clipboard.writeText(url)
      toast.success("Lien copié : à envoyer au conseil syndical (valable 24 h)")
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const dashboardUrl = sub?.dashboardUrl ?? data.customer?.dashboardUrl
  const canSwitchYearly =
    subscribed && sub?.interval === "month" && !sub.byInvoice && !sub.cancelAtPeriodEnd && !sub.scheduledYearly

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-3">
          <CardTitle className="text-base">Option CS avancé</CardTitle>
          <Badge variant="outline" className={status.className}>
            {status.label}
          </Badge>
          {data.testMode && (
            <Badge variant="outline" className={BADGE.amber}>
              Stripe en mode test
            </Badge>
          )}
        </div>
        <CardAction>
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={busy}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Actions
              <MoreVertical className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={openSubscriptionPage}>
                <ExternalLink />
                {subscribed ? "Ouvrir la page de gestion" : "Ouvrir la page de souscription"}
              </DropdownMenuItem>
              {subscribed && !sub?.byInvoice && (
                <DropdownMenuItem onClick={copyPaymentLink}>
                  <Link2 />
                  Copier un lien pour changer de carte ou d'IBAN
                </DropdownMenuItem>
              )}
              {canSwitchYearly && (
                <DropdownMenuItem
                  onClick={() =>
                    run(() => csBillingAction(residenceId, "switch_yearly"), "Passage à l'annuel programmé à la prochaine échéance")
                  }
                >
                  <CalendarClock />
                  Passer à l'annuel
                </DropdownMenuItem>
              )}
              {subscribed && (sub?.cancelAtPeriodEnd || data.cancellation) && (
                <DropdownMenuItem onClick={() => run(() => csBillingAction(residenceId, "keep"), "Option conservée")}>
                  <RotateCcw />
                  Annuler la résiliation
                </DropdownMenuItem>
              )}
              {subscribed && !sub?.cancelAtPeriodEnd && (
                <DropdownMenuItem variant="destructive" onClick={() => setConfirmCancel(true)}>
                  <XCircle />
                  Résilier à la fin de la période
                </DropdownMenuItem>
              )}
              {dashboardUrl && (
                <DropdownMenuItem render={<a href={dashboardUrl} target="_blank" rel="noreferrer" />}>
                  <ExternalLink />
                  Voir dans Stripe
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Formule</dt>
            <dd className="font-medium">
              {sub?.interval === "year" ? "Annuelle" : sub?.interval === "month" ? "Mensuelle" : "—"}
              {sub?.scheduledYearly && <span className="text-muted-foreground"> · annuelle à la prochaine échéance</span>}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Paiement</dt>
            <dd className="font-medium">{paymentLabel(data)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Lots</dt>
            <dd className="font-medium">
              {sub?.billedLots != null ? `${sub.billedLots} facturés · ` : ""}
              {data.lots} dans la résidence
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Prochaine échéance</dt>
            <dd className="font-medium">
              {data.upcoming
                ? `${formatDate(data.upcoming.date)} · ${formatAmount(data.upcoming.amount, data.upcoming.currency)}`
                : "—"}
            </dd>
          </div>
          <div className="col-span-2 sm:col-span-4">
            <dt className="text-muted-foreground">Remise</dt>
            <dd className="font-medium">{discount}</dd>
          </div>
          {data.cancellation && (
            <div className="col-span-2 sm:col-span-4">
              <dt className="text-muted-foreground">Résiliation demandée</dt>
              <dd className="font-medium">
                par {data.cancellation.requestedByName}, à confirmer par un autre membre du CS avant le{" "}
                {formatDate(data.cancellation.expiresAt)}
              </dd>
            </div>
          )}
        </dl>
        <BillingTimeline data={data} />
      </CardContent>

      <ConfirmActionDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Résilier l'option CS avancé ?"
        description={
          <>
            L'option reste active jusqu'au {formatDate(sub?.currentPeriodEnd)}, puis {data.graceDays} jours de délai de
            grâce avant la lecture seule. Le conseil syndical est prévenu.
          </>
        }
        confirmLabel="Résilier"
        destructive
        onConfirm={() => run(() => csBillingAction(residenceId, "cancel"), "Option résiliée à la fin de la période")}
      />
    </Card>
  )
}
