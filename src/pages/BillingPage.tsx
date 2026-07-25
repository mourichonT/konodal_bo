import { useEffect, useState } from "react"
import { Navigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { CreditCard, ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAccountRole } from "@/hooks/useAccountRole"
import { subscribeToGerance } from "@/lib/gerances"
import {
  createBillingPortalSession,
  createCheckoutSession,
  getBillingOverview,
  subscribeToGeranceBilling,
} from "@/lib/billing"
import { billingStatusBadgeClass, billingStatusLabels, invoiceStatusLabels } from "@/types/billing"
import type { BillingInvoice, BillingPaymentMethod, GeranceBilling } from "@/types/billing"
import type { Gerance } from "@/types/gerance"

function formatAmount(cents: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: currency.toUpperCase() }).format(
    cents / 100
  )
}

const NO_BILLING: GeranceBilling = { status: "none", seatCount: 0, currentPeriodEnd: null }

export default function BillingPage() {
  const { isAgence, geranceId, loading: roleLoading } = useAccountRole()
  const [searchParams, setSearchParams] = useSearchParams()
  const [gerance, setGerance] = useState<Gerance | null>(null)
  const [billing, setBilling] = useState<GeranceBilling>(NO_BILLING)
  const [paymentMethod, setPaymentMethod] = useState<BillingPaymentMethod | null>(null)
  const [invoices, setInvoices] = useState<BillingInvoice[]>([])
  const [customerEmail, setCustomerEmail] = useState<string | null>(null)
  const [pricePerSeatCents, setPricePerSeatCents] = useState<number | null>(null)
  const [priceCurrency, setPriceCurrency] = useState<string | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(true)
  const [redirecting, setRedirecting] = useState(false)

  // Retour de Stripe Checkout (success_url/cancel_url, cf.
  // create_checkout_session) - pas de page de retour dédiée : l'utilisateur
  // reste connecté au BO pendant tout l'aller-retour, le statut réel arrive
  // via subscribeToGeranceBilling (webhook Stripe) dès qu'il est traité.
  useEffect(() => {
    const checkout = searchParams.get("checkout")
    if (!checkout) return
    if (checkout === "success") {
      toast.success("Paiement en cours de confirmation…")
    } else if (checkout === "cancel") {
      toast.error("Paiement annulé")
    }
    const next = new URLSearchParams(searchParams)
    next.delete("checkout")
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!geranceId) return
    return subscribeToGerance(geranceId, setGerance, (error) =>
      toast.error("Impossible de charger l'agence : " + error.message)
    )
  }, [geranceId])

  useEffect(() => {
    if (!geranceId) return
    return subscribeToGeranceBilling(geranceId, setBilling, (error) =>
      toast.error("Impossible de charger l'abonnement : " + error.message)
    )
  }, [geranceId])

  useEffect(() => {
    if (!geranceId) return
    setOverviewLoading(true)
    getBillingOverview(geranceId)
      .then(({ paymentMethod, invoices, customerEmail, pricePerSeatCents, priceCurrency }) => {
        setPaymentMethod(paymentMethod)
        setInvoices(invoices)
        setCustomerEmail(customerEmail)
        setPricePerSeatCents(pricePerSeatCents)
        setPriceCurrency(priceCurrency)
      })
      .catch((error: Error) => toast.error("Impossible de charger les factures : " + error.message))
      .finally(() => setOverviewLoading(false))
  }, [geranceId])

  if (roleLoading) return null
  if (!isAgence) return <Navigate to="/" replace />

  const canEdit = isAgence
  const hasSubscription = billing.status !== "none"

  async function handleSubscribe() {
    if (!geranceId) return
    setRedirecting(true)
    try {
      const { url } = await createCheckoutSession(geranceId)
      window.location.href = url
    } catch (err) {
      toast.error("Échec de l'ouverture du paiement : " + (err as Error).message)
      setRedirecting(false)
    }
  }

  async function handleManage() {
    if (!geranceId) return
    setRedirecting(true)
    try {
      const { url } = await createBillingPortalSession(geranceId)
      window.location.href = url
    } catch (err) {
      toast.error("Échec de l'ouverture de la gestion de l'abonnement : " + (err as Error).message)
      setRedirecting(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Facturation</h1>
        {gerance && <p className="text-sm text-muted-foreground">{gerance.name}</p>}
      </div>

      <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle className="text-base">Abonnement</CardTitle>
            <Badge variant="outline" className={billingStatusBadgeClass[billing.status]}>
              {billingStatusLabels[billing.status]}
            </Badge>
          </div>
          {canEdit && (
            <CardAction>
              {hasSubscription ? (
                <Button type="button" variant="outline" size="sm" disabled={redirecting} onClick={handleManage}>
                  <CreditCard />
                  Gérer l'abonnement
                </Button>
              ) : (
                <Button type="button" size="sm" disabled={redirecting} onClick={handleSubscribe}>
                  <CreditCard />
                  S'abonner
                </Button>
              )}
            </CardAction>
          )}
        </CardHeader>
        {hasSubscription && (
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-muted-foreground">Email agence/agent</dt>
                <dd className="font-medium">{overviewLoading ? "…" : (customerEmail ?? "—")}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Total des sièges</dt>
                <dd className="font-medium">{billing.seatCount}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Prix / licence HT</dt>
                <dd className="font-medium">
                  {overviewLoading
                    ? "…"
                    : pricePerSeatCents != null && priceCurrency
                      ? `${formatAmount(pricePerSeatCents, priceCurrency)} / mois`
                      : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Total HT</dt>
                <dd className="font-medium">
                  {overviewLoading
                    ? "…"
                    : pricePerSeatCents != null && priceCurrency
                      ? `${formatAmount(pricePerSeatCents * billing.seatCount, priceCurrency)} / mois`
                      : "—"}
                </dd>
              </div>
              {billing.currentPeriodEnd && (
                <div>
                  <dt className="text-muted-foreground">
                    {billing.cancelAtPeriodEnd ? "Se termine le" : "Renouvellement"}
                  </dt>
                  <dd className="font-medium">{billing.currentPeriodEnd.toLocaleDateString("fr-FR")}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        )}
      </Card>

      {hasSubscription && (
        <>
          <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
            <CardHeader>
              <CardTitle className="text-base">Paiement</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-3">
              {overviewLoading ? (
                <p className="text-sm text-muted-foreground">Chargement…</p>
              ) : paymentMethod ? (
                <p className="text-sm">
                  <span className="font-medium capitalize">{paymentMethod.brand ?? "Carte"}</span>{" "}
                  <span className="text-muted-foreground">•••• {paymentMethod.last4 ?? "----"}</span>
                  {paymentMethod.expMonth && paymentMethod.expYear && (
                    <span className="text-muted-foreground">
                      {" "}
                      · exp. {String(paymentMethod.expMonth).padStart(2, "0")}/{paymentMethod.expYear}
                    </span>
                  )}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Aucun moyen de paiement enregistré.</p>
              )}
              {canEdit && (
                <Button type="button" variant="outline" size="sm" disabled={redirecting} onClick={handleManage}>
                  Mettre à jour
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
            <CardHeader>
              <CardTitle className="text-base">Factures</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="bg-white">
                    {invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="text-muted-foreground">
                          {invoice.date ? invoice.date.toLocaleDateString("fr-FR") : "—"}
                        </TableCell>
                        <TableCell>{formatAmount(invoice.totalCents, invoice.currency)}</TableCell>
                        <TableCell>{invoiceStatusLabels[invoice.status]}</TableCell>
                        <TableCell className="text-right">
                          {invoice.hostedInvoiceUrl && (
                            <Button
                              variant="outline"
                              size="sm"
                              render={<a href={invoice.hostedInvoiceUrl} target="_blank" rel="noreferrer" />}
                            >
                              <ExternalLink />
                              Voir
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!overviewLoading && invoices.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                          Aucune facture pour l'instant.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
