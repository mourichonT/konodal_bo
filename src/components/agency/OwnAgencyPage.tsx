import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { CreditCard, SlidersHorizontal, Users, type LucideIcon } from "lucide-react"
import { NodoMailFilterSection } from "@/components/NodoMailFilterSection"
import { InAppRepliesSection } from "@/components/InAppRepliesSection"
import { AgencyInfoCard } from "@/components/agency/AgencyInfoCard"
import { Pill, type PillTone } from "@/components/agency/agencyUi"
import {
  AddServiceCard,
  ServiceTeamCard,
  serviceHasTeam,
  type LicencePrices,
} from "@/components/agency/ServiceTeamCard"
import { SubscriptionSummaryCard } from "@/components/agency/SubscriptionSummaryCard"
import { SubscriptionTab } from "@/components/agency/SubscriptionTab"
import { TeamStats } from "@/components/agency/TeamStats"
import { useAgencyTeam } from "@/hooks/useAgencyTeam"
import { useGeranceBilling } from "@/hooks/useGeranceBilling"
import { getBillingOverview } from "@/lib/billing"
import {
  DEFAULT_AGENT_PRICE_CENTS,
  DEFAULT_SERVICE_PRICE_CENTS,
  SERVICE_TYPES,
  unlicensedAgentUids,
} from "@/lib/licences"
import { cn } from "@/lib/utils"
import { billingStatusLabels, type BillingOverview, type BillingStatus } from "@/types/billing"
import { AGENT_UID_FIELD, type Gerance } from "@/types/gerance"

type TabKey = "general" | "equipe" | "abonnement"

const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: "general", label: "Général", icon: SlidersHorizontal },
  { key: "equipe", label: "Équipe", icon: Users },
  { key: "abonnement", label: "Abonnement", icon: CreditCard },
]

const statusTones: Record<BillingStatus, PillTone> = {
  none: "grey",
  trialing: "green",
  active: "green",
  past_due: "amber",
  canceled: "red",
  unpaid: "red",
  paused: "amber",
  incomplete: "amber",
  incomplete_expired: "red",
}

// Page « Agence » d'un compte agence ou agent (maquette « Agence Gestion
// Compte Konodal ») : onglets Général (fiche, services et leurs agents, Nodo,
// résumé de l'abonnement), Équipe (licences agent) et Abonnement (lignes,
// factures, essai, carte - compte agence seulement). Un agent consulte sans
// rien modifier. L'onglet est dans l'URL (?onglet=) : /facturation et les
// retours Stripe arrivent sur Abonnement.
export function OwnAgencyPage({
  gerance,
  loading,
  canEdit,
}: {
  gerance: Gerance | null
  loading: boolean
  canEdit: boolean
}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const billing = useGeranceBilling(gerance?.id)
  const [overview, setOverview] = useState<BillingOverview | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(true)
  const tabs = canEdit ? TABS : TABS.filter((t) => t.key !== "abonnement")
  const tab = tabs.find((t) => t.key === searchParams.get("onglet"))?.key ?? "general"

  function selectTab(key: TabKey) {
    const next = new URLSearchParams(searchParams)
    if (key === "general") next.delete("onglet")
    else next.set("onglet", key)
    setSearchParams(next, { replace: true })
  }

  // Retour de Stripe Checkout (success_url / cancel_url de
  // create_checkout_session) : le statut réel arrive par le webhook.
  useEffect(() => {
    const checkout = searchParams.get("checkout")
    if (!checkout) return
    if (checkout === "success") toast.success("Paiement en cours de confirmation…")
    else if (checkout === "cancel") toast.error("Paiement annulé")
    const next = new URLSearchParams(searchParams)
    next.delete("checkout")
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Prix, factures, carte et période d'essai : lus chez Stripe pour le
  // compte agence seulement (get_billing_overview lui est réservé).
  const geranceId = gerance?.id
  const loadOverview = useCallback(() => {
    if (!geranceId || !canEdit) {
      setOverviewLoading(false)
      return
    }
    setOverviewLoading(true)
    getBillingOverview(geranceId)
      .then(setOverview)
      .catch((error: Error) => toast.error("Impossible de charger la facturation : " + error.message))
      .finally(() => setOverviewLoading(false))
  }, [geranceId, canEdit])
  useEffect(loadOverview, [loadOverview, billing.stripeCustomerId])

  const teamUids = useMemo(
    () =>
      gerance
        ? [
            ...new Set([
              ...SERVICE_TYPES.flatMap((type) => gerance[AGENT_UID_FIELD[type]] ?? []),
              ...unlicensedAgentUids(billing),
            ]),
          ]
        : [],
    [gerance, billing]
  )
  const team = useAgencyTeam(gerance?.id, teamUids)

  const prices: LicencePrices = {
    service: overview?.servicePriceCents ?? DEFAULT_SERVICE_PRICE_CENTS,
    agent: overview?.agentPriceCents ?? DEFAULT_AGENT_PRICE_CENTS,
  }

  if (!gerance) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-[26px] font-extrabold tracking-tight text-[oklch(22%_0.01_150)]">
          {loading ? "…" : "Agence introuvable"}
        </h1>
        {!loading && (
          <p className="text-muted-foreground">Aucune agence n'est rattachée à votre compte pour l'instant.</p>
        )}
      </div>
    )
  }

  const serviceCards = SERVICE_TYPES.map((type) =>
    serviceHasTeam(gerance, billing, type) ? (
      <ServiceTeamCard
        key={type}
        gerance={gerance}
        billing={billing}
        type={type}
        team={team}
        canEdit={canEdit}
        prices={prices}
      />
    ) : (
      <AddServiceCard
        key={type}
        gerance={gerance}
        billing={billing}
        type={type}
        canEdit={canEdit}
        prices={prices}
        onSubscribe={() => selectTab("abonnement")}
      />
    )
  )

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[26px] font-extrabold tracking-tight text-[oklch(22%_0.01_150)]">{gerance.name}</h1>
        {billing.status !== "none" && (
          <Pill tone={statusTones[billing.status] ?? "grey"} className="text-[12px]">
            {billing.cancelAtPeriodEnd
              ? "Résiliation programmée"
              : billing.status === "active"
                ? "Abonnement actif"
                : billingStatusLabels[billing.status]}
          </Pill>
        )}
      </div>

      <div
        role="tablist"
        aria-label="Sections de l'agence"
        className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-[20px] bg-[oklch(92%_0.004_100)] p-1.5 [scrollbar-width:none]"
      >
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => selectTab(key)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-[15px] px-4 py-2 text-[14px] font-bold whitespace-nowrap transition-colors",
              tab === key
                ? "bg-[oklch(38%_0.07_152)] text-white shadow-[0_8px_18px_-10px_oklch(30%_0.07_152/0.8)]"
                : "text-[oklch(38%_0.01_150)] hover:bg-white/60"
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "general" && (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-w-0 flex-col gap-5">
            <AgencyInfoCard gerance={gerance} canEdit={canEdit} />
            {serviceCards}
          </div>
          <aside className="flex flex-col gap-4">
            {/* Options de l'agence, cachées aux agents. */}
            <NodoMailFilterSection geranceId={gerance.id} />
            <InAppRepliesSection gerance={gerance} />
            <SubscriptionSummaryCard
              billing={billing}
              prices={prices}
              trialEnd={overview?.trialEnd}
              canEdit={canEdit}
              onOpen={() => selectTab("abonnement")}
            />
          </aside>
        </div>
      )}

      {tab === "equipe" && (
        <div className="flex flex-col gap-5">
          <TeamStats
            gerance={gerance}
            billing={billing}
            team={team}
            prices={prices}
            canEdit={canEdit}
            onAddLicences={() => selectTab("abonnement")}
          />
          {serviceCards}
        </div>
      )}

      {tab === "abonnement" && canEdit && (
        <SubscriptionTab
          gerance={gerance}
          billing={billing}
          team={team}
          overview={overview}
          overviewLoading={overviewLoading}
          prices={prices}
          onOverviewChanged={loadOverview}
        />
      )}
    </div>
  )
}
