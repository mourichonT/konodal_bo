import { CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { OUTLINE_BUTTON_CLASS, ROW_BORDER_CLASS, TITLE_CLASS } from "@/components/agency/agencyUi"
import type { LicencePrices } from "@/components/agency/ServiceTeamCard"
import { formatCents, isLegacyBilling, SERVICE_TYPES } from "@/lib/licences"
import { cn, PANEL_CARD_CLASS } from "@/lib/utils"
import type { GeranceBilling } from "@/types/billing"
import { serviceTypeLabels } from "@/types/gerance"

// Phrase d'état de l'abonnement, partagée par le résumé et l'onglet
// Abonnement.
export function billingStatusSentence(billing: GeranceBilling, trialEnd?: Date | null): string {
  const end = billing.currentPeriodEnd?.toLocaleDateString("fr-FR")
  if (billing.cancelAtPeriodEnd && end) return `Résilié : prend fin le ${end}.`
  switch (billing.status) {
    case "trialing":
      return trialEnd
        ? `Période d'essai jusqu'au ${trialEnd.toLocaleDateString("fr-FR")}.`
        : "Période d'essai en cours."
    case "active":
      return end ? `Actif, renouvelé le ${end}.` : "Abonnement actif."
    case "past_due":
    case "unpaid":
      return "Paiement en retard : vérifiez votre carte."
    case "paused":
      return "Suspendu : ajoutez une carte pour le relancer."
    case "canceled":
      return "Abonnement terminé."
    default:
      return "Aucun abonnement."
  }
}

// Résumé « Abonnement et facturation » de l'onglet Général (maquette 11a) :
// lignes souscrites et estimation mensuelle ; le détail est dans l'onglet
// Abonnement.
export function SubscriptionSummaryCard({
  billing,
  prices,
  trialEnd,
  canEdit,
  onOpen,
}: {
  billing: GeranceBilling
  prices: LicencePrices
  trialEnd?: Date | null
  canEdit: boolean
  onOpen: () => void
}) {
  const none = billing.status === "none" || billing.status === "canceled"
  const legacy = isLegacyBilling(billing)
  const services = SERVICE_TYPES.filter((type) => billing.serviceLicences.includes(type))
  const total = services.length * prices.service + billing.agentSeatCount * prices.agent
  const rows = legacy
    ? [{ label: "Licences (ancienne formule)", value: String(billing.legacySeatCount) }]
    : [
        ...services.map((type) => ({
          label: `Service ${serviceTypeLabels[type]}`,
          value: `${formatCents(prices.service)} HT / mois`,
        })),
        { label: "Licences agent", value: `${billing.agentSeatCount} × ${formatCents(prices.agent)} HT / mois` },
        { label: "Estimation mensuelle", value: `${formatCents(total)} HT`, strong: true },
      ]

  return (
    <section className={cn(PANEL_CARD_CLASS, "overflow-hidden p-0")}>
      <div className="flex items-start gap-3 px-[22px] pt-[18px] pb-3.5">
        <div className="min-w-0 flex-1">
          <h2 className={cn(TITLE_CLASS, "p-0 font-sans")}>Abonnement et facturation</h2>
          <p className="m-0 mt-0.5 text-[12.5px] text-muted-foreground">{billingStatusSentence(billing, trialEnd)}</p>
        </div>
        {canEdit && (
          <Button type="button" variant="outline" className={OUTLINE_BUTTON_CLASS} onClick={onOpen}>
            <CreditCard />
            {none ? "S'abonner" : "Gérer la facturation"}
          </Button>
        )}
      </div>
      {!none &&
        rows.map((row) => (
          <div
            key={row.label}
            className={cn(ROW_BORDER_CLASS, "flex items-center justify-between gap-3 px-[22px] py-2.5 text-[13px]")}
          >
            <span className="text-muted-foreground">{row.label}</span>
            <span
              className={cn(
                "text-right font-semibold text-[oklch(22%_0.01_150)]",
                "strong" in row && row.strong && "font-extrabold"
              )}
            >
              {row.value}
            </span>
          </div>
        ))}
    </section>
  )
}
