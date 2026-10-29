import { useState, type ReactNode } from "react"
import { toast } from "sonner"
import { Download, ExternalLink, Minus, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Avatar,
  CAPS_LABEL_CLASS,
  formatLongDate,
  LINK_BUTTON_CLASS,
  Pill,
  ROW_BORDER_CLASS,
  TINT_BG_CLASS,
  TITLE_CLASS,
  type PillTone,
} from "@/components/agency/agencyUi"
import { PaymentMethodCard } from "@/components/agency/PaymentMethodCard"
import type { LicencePrices } from "@/components/agency/ServiceTeamCard"
import { billingStatusSentence } from "@/components/agency/SubscriptionSummaryCard"
import { adjustLicences, createBillingPortalSession, createCheckoutSession } from "@/lib/billing"
import type { AgencyTeamMember } from "@/lib/gerances"
import {
  agentUids,
  emailInitials,
  formatCents,
  isLegacyBilling,
  licenceUsage,
  MAX_AGENT_LICENCES,
  SERVICE_TYPES,
} from "@/lib/licences"
import { cn, PANEL_CARD_CLASS, PRIMARY_CTA_CLASS } from "@/lib/utils"
import {
  invoiceStatusLabels,
  type BillingOverview,
  type BillingPaymentMethod,
  type GeranceBilling,
  type InvoiceStatus,
} from "@/types/billing"
import { serviceTypeLabels, type Gerance, type ServiceType } from "@/types/gerance"

const DAY_MS = 86_400_000

const invoiceTones: Record<InvoiceStatus, PillTone> = {
  draft: "grey",
  open: "amber",
  paid: "green",
  uncollectible: "red",
  void: "grey",
}

const TABLE_COLS = "grid grid-cols-[minmax(0,1.7fr)_minmax(0,0.8fr)_minmax(0,1fr)] items-center gap-3"

// Onglet Abonnement de la vue Agence (maquettes 11c à 11k) : lignes de
// l'abonnement avec −/+ sur les licences agent (confirmées avant l'envoi),
// factures, période d'essai puis prochaine facturation, et carte bancaire.
// Sans abonnement : choix des licences puis paiement Stripe Checkout.
export function SubscriptionTab({
  gerance,
  billing,
  team,
  overview,
  overviewLoading,
  prices,
  onOverviewChanged,
}: {
  gerance: Gerance
  billing: GeranceBilling
  team: Record<string, AgencyTeamMember> | null
  overview: BillingOverview | null
  overviewLoading: boolean
  prices: LicencePrices
  onOverviewChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const none = billing.status === "none" || billing.status === "canceled"
  const monthly = billing.serviceLicences.length * prices.service + billing.agentSeatCount * prices.agent
  const trialing = billing.status === "trialing"
  const nextDate = trialing ? overview?.trialEnd : billing.currentPeriodEnd
  // Montant calculé par Stripe (remises, prorata), sinon prix catalogue.
  const nextCents = overview?.upcomingTotalCents ?? monthly

  async function openPortal() {
    setBusy(true)
    try {
      const { url } = await createBillingPortalSession(gerance.id)
      window.location.href = url
    } catch (err) {
      toast.error("Ouverture impossible : " + (err as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-5">
        {none ? (
          <SubscribeCard gerance={gerance} billing={billing} prices={prices} />
        ) : (
          <SubscriptionCard
            gerance={gerance}
            billing={billing}
            team={team}
            prices={prices}
            trialEnd={overview?.trialEnd}
          />
        )}
        <InvoicesCard overview={overview} loading={overviewLoading} />
      </div>
      <aside className="flex flex-col gap-4">
        {trialing && overview?.trialEnd && <TrialCard trialStart={overview.trialStart} trialEnd={overview.trialEnd} />}
        {!none && !trialing && (
          <NextBillingCard
            billing={billing}
            cents={nextCents}
            paymentMethod={overview?.paymentMethod ?? null}
            loading={overviewLoading}
          />
        )}
        {billing.stripeCustomerId && (
          <PaymentMethodCard
            geranceId={gerance.id}
            agencyName={gerance.name}
            billingStatus={billing.status}
            paymentMethod={overview?.paymentMethod ?? null}
            paymentIssue={overview?.paymentIssue ?? null}
            trialEnd={overview?.trialEnd ?? null}
            loading={overviewLoading}
            nextCharge={!none && !billing.cancelAtPeriodEnd && nextDate ? { cents: nextCents, date: nextDate } : null}
            onChanged={onOverviewChanged}
          />
        )}
        {billing.stripeCustomerId && (
          <button
            type="button"
            className={cn(LINK_BUTTON_CLASS, "self-start px-1")}
            disabled={busy}
            onClick={openPortal}
          >
            <ExternalLink className="mr-1 inline size-3.5" />
            Résilier ou modifier l'adresse de facturation
          </button>
        )}
      </aside>
    </div>
  )
}

function SubscriptionCard({
  gerance,
  billing,
  team,
  prices,
  trialEnd,
}: {
  gerance: Gerance
  billing: GeranceBilling
  team: Record<string, AgencyTeamMember> | null
  prices: LicencePrices
  trialEnd?: Date | null
}) {
  const [draft, setDraft] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const usage = licenceUsage(gerance, billing)
  const legacy = isLegacyBilling(billing)
  const editable = !legacy && ["active", "trialing", "past_due"].includes(billing.status)
  const services = SERVICE_TYPES.filter((type) => usage.subscribed.includes(type))
  const { purchased, assigned } = usage.agents
  const target = draft ?? purchased
  const diff = target - purchased
  const free = purchased - assigned
  const removed = Math.max(-diff, 0)
  const added = Math.max(diff, 0)
  const servicesTotal = services.length * prices.service
  const current = servicesTotal + purchased * prices.agent
  const next = servicesTotal + target * prices.agent
  const trialing = billing.status === "trialing"
  const late = ["past_due", "unpaid", "paused"].includes(billing.status)

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true)
    try {
      await action()
      toast.success(success)
      setDraft(null)
    } catch (err) {
      toast.error("Modification impossible : " + (err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const confirmChange = () =>
    run(
      () => adjustLicences(gerance.id, { action: diff > 0 ? "addAgents" : "removeAgents", count: Math.abs(diff) }),
      diff > 0
        ? `${diff} licence${diff > 1 ? "s" : ""} agent ajoutée${diff > 1 ? "s" : ""}`
        : `${-diff} licence${diff < -1 ? "s" : ""} agent retirée${diff < -1 ? "s" : ""}`
    )

  return (
    <section className={cn(PANEL_CARD_CLASS, "overflow-hidden p-0")}>
      <div className="px-[22px] pt-[18px] pb-3.5">
        <h2 className={cn(TITLE_CLASS, "p-0 font-sans")}>Votre abonnement</h2>
        <p className="m-0 mt-0.5 text-[12.5px] text-muted-foreground">Facturé chaque mois, hors taxes.</p>
      </div>

      {billing.cancelAtPeriodEnd && (
        <Banner tone="amber">
          <span className="flex-1">{billingStatusSentence(billing)}</span>
          <button
            type="button"
            className={LINK_BUTTON_CLASS}
            disabled={busy}
            onClick={() => run(() => adjustLicences(gerance.id, { action: "resume" }), "Abonnement repris")}
          >
            Reprendre
          </button>
        </Banner>
      )}
      {late && <Banner tone="amber">{billingStatusSentence(billing, trialEnd)}</Banner>}

      {legacy ? (
        <p className={cn(ROW_BORDER_CLASS, "m-0 px-[22px] py-4 text-[13px] text-muted-foreground")}>
          Votre abonnement est encore à l'ancienne formule ({billing.legacySeatCount} licence
          {billing.legacySeatCount > 1 ? "s" : ""}). Konodal le passe bientôt aux licences service et agent.
        </p>
      ) : (
        <>
          <div className={cn(ROW_BORDER_CLASS, TABLE_COLS, "bg-[oklch(98%_0.004_100)] px-[22px] py-2")}>
            <span className={CAPS_LABEL_CLASS}>Désignation</span>
            <span className={CAPS_LABEL_CLASS}>Prix unitaire</span>
            <span className={cn(CAPS_LABEL_CLASS, "text-right")}>Total / mois</span>
          </div>
          {services.map((type) => (
            <div key={type} className={cn(ROW_BORDER_CLASS, TABLE_COLS, "px-[22px] py-3 text-[13.5px]")}>
              <span className="font-bold text-[oklch(22%_0.01_150)]">Service {serviceTypeLabels[type]}</span>
              <span className="text-muted-foreground">{formatCents(prices.service)} HT</span>
              <span className="text-right font-extrabold text-[oklch(22%_0.01_150)]">
                {formatCents(prices.service)} HT
              </span>
            </div>
          ))}

          <div className={cn(ROW_BORDER_CLASS, TINT_BG_CLASS, "flex flex-col gap-3 px-[22px] py-3.5")}>
            <div className={cn(TABLE_COLS, "text-[13.5px]")}>
              <div className="min-w-0">
                <div className="font-bold text-[oklch(22%_0.01_150)]">Licences agent</div>
                <div className="text-[12px] text-muted-foreground">
                  Une licence par agent. {assigned} utilisée{assigned > 1 ? "s" : ""} · {free} libre
                  {free > 1 ? "s" : ""}
                </div>
              </div>
              <span className="text-muted-foreground">{formatCents(prices.agent)} HT</span>
              <div className="flex justify-end">
                {editable ? (
                  <div
                    className={cn(
                      "flex h-9 items-center rounded-[11px] border bg-white",
                      diff !== 0
                        ? "border-[oklch(40%_0.08_155)] ring-2 ring-[oklch(40%_0.08_155/0.15)]"
                        : "border-input"
                    )}
                  >
                    <button
                      type="button"
                      aria-label="Retirer une licence libre"
                      className="flex h-full w-9 items-center justify-center disabled:opacity-30"
                      disabled={busy || target <= assigned}
                      onClick={() => setDraft(target - 1)}
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <span className="w-9 border-x text-center text-[14px] font-extrabold tabular-nums">{target}</span>
                    <button
                      type="button"
                      aria-label="Ajouter une licence"
                      className="flex h-full w-9 items-center justify-center disabled:opacity-30"
                      disabled={busy || target >= Math.max(MAX_AGENT_LICENCES, purchased)}
                      onClick={() => setDraft(target + 1)}
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                ) : (
                  <span className="font-extrabold">{purchased}</span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {[...agentUids(gerance, billing)].map((uid) => (
                <LicenceChip
                  key={uid}
                  initials={emailInitials(team?.[uid]?.email)}
                  title={team?.[uid]?.email ?? undefined}
                >
                  Utilisée
                </LicenceChip>
              ))}
              {Array.from({ length: Math.max(free - removed, 0) }, (_, i) => (
                <LicenceChip key={`free-${i}`} variant="free">
                  Libre
                </LicenceChip>
              ))}
              {Array.from({ length: removed }, (_, i) => (
                <LicenceChip key={`removed-${i}`} variant="removed">
                  Retirée
                </LicenceChip>
              ))}
              {Array.from({ length: added }, (_, i) => (
                <LicenceChip key={`added-${i}`} variant="added">
                  Nouvelle
                </LicenceChip>
              ))}
            </div>
            {editable && (
              <p className="m-0 text-[12px] text-muted-foreground">
                + pour ajouter une licence, − pour retirer une licence libre. Pour retirer une licence utilisée,
                supprimez d'abord l'agent ou libérez sa licence (onglet Équipe).
              </p>
            )}
            <div className="text-right text-[13.5px] font-extrabold text-[oklch(22%_0.01_150)]">
              {formatCents(target * prices.agent)} HT
            </div>
            {diff !== 0 && (
              <div className="flex flex-wrap items-center gap-3 rounded-[12px] border border-[oklch(90%_0.03_160)] bg-white p-3">
                <p className="m-0 min-w-[200px] flex-1 text-[12.5px] leading-snug">
                  {diff > 0 ? (
                    <>
                      <strong>
                        +{diff} licence{diff > 1 ? "s" : ""} agent
                      </strong>{" "}
                      : +{formatCents(diff * prices.agent)} HT / mois
                      {trialing ? ", gratuites jusqu'à la fin de l'essai." : ", au prorata sur la prochaine facture."}
                    </>
                  ) : (
                    <>
                      <strong>
                        −{-diff} licence{diff < -1 ? "s" : ""} libre{diff < -1 ? "s" : ""}
                      </strong>{" "}
                      : −{formatCents(-diff * prices.agent)} HT / mois
                      {trialing ? "." : ", crédité au prorata sur la prochaine facture."}
                    </>
                  )}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-[11px]"
                  disabled={busy}
                  onClick={() => setDraft(null)}
                >
                  Annuler
                </Button>
                <Button
                  type="button"
                  className={cn(PRIMARY_CTA_CLASS, "h-9 rounded-[11px] font-bold")}
                  disabled={busy}
                  onClick={confirmChange}
                >
                  Confirmer
                </Button>
              </div>
            )}
          </div>

          <div
            className={cn(ROW_BORDER_CLASS, TINT_BG_CLASS, "flex items-center justify-between gap-3 px-[22px] py-4")}
          >
            <span className="text-[14px] font-extrabold text-[oklch(22%_0.01_150)]">Estimation mensuelle</span>
            <span className="flex items-baseline gap-2">
              {diff !== 0 && (
                <span className="text-[13px] text-muted-foreground line-through">{formatCents(current)} HT</span>
              )}
              <span className="text-[20px] font-extrabold tracking-tight text-[oklch(22%_0.01_150)]">
                {formatCents(next)} HT
              </span>
            </span>
          </div>
        </>
      )}
    </section>
  )
}

function LicenceChip({
  initials,
  title,
  variant = "used",
  children,
}: {
  initials?: string
  title?: string
  variant?: "used" | "free" | "added" | "removed"
  children: string
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-full border bg-white py-1 pr-3.5 pl-1 text-[12.5px] font-bold",
        variant === "used" && "border-[oklch(92%_0.01_150)] text-[oklch(22%_0.01_150)]",
        variant === "free" && "border-[oklch(92%_0.01_150)] font-semibold text-muted-foreground",
        variant === "added" && "border-[oklch(80%_0.06_155)] text-[oklch(35%_0.09_155)]",
        variant === "removed" && "border-[oklch(88%_0.05_25)] text-[oklch(48%_0.15_27)] line-through"
      )}
    >
      {variant === "used" ? (
        <Avatar initials={initials ?? "?"} className="size-7 bg-[oklch(93%_0.05_150)] text-[10.5px]" />
      ) : (
        <span
          className={cn(
            "flex size-7 items-center justify-center rounded-full border-[1.5px] border-dashed",
            variant === "added" ? "border-[oklch(55%_0.08_155)]" : "border-[oklch(80%_0.01_150)]"
          )}
        >
          {variant === "added" && <Plus className="size-3" />}
          {variant === "removed" && <X className="size-3" />}
        </span>
      )}
      {children}
    </span>
  )
}

function Banner({ tone, children }: { tone: "amber"; children: ReactNode }) {
  return (
    <div
      className={cn(
        ROW_BORDER_CLASS,
        "flex items-center gap-3 px-[22px] py-2.5 text-[12.5px] font-semibold",
        tone === "amber" && "bg-[oklch(97%_0.04_85)] text-[oklch(42%_0.1_65)]"
      )}
    >
      {children}
    </div>
  )
}

// Sans abonnement : services à souscrire (activés sur la fiche), stock de
// licences agent, total, puis Stripe Checkout (create_checkout_session).
function SubscribeCard({
  gerance,
  billing,
  prices,
}: {
  gerance: Gerance
  billing: GeranceBilling
  prices: LicencePrices
}) {
  const enabled = SERVICE_TYPES.filter((type) => gerance.services[type])
  const [services, setServices] = useState<ServiceType[]>(enabled)
  const usage = licenceUsage(gerance, billing)
  const minAgents = usage.agents.assigned
  const [agents, setAgents] = useState(minAgents)
  const [redirecting, setRedirecting] = useState(false)
  const count = Math.max(agents, minAgents)
  const total = services.length * prices.service + count * prices.agent

  async function handleSubscribe() {
    setRedirecting(true)
    try {
      const { url } = await createCheckoutSession(gerance.id, { services, agents: count })
      window.location.href = url
    } catch (err) {
      toast.error("Échec de l'ouverture du paiement : " + (err as Error).message)
      setRedirecting(false)
    }
  }

  return (
    <section className={cn(PANEL_CARD_CLASS, "overflow-hidden p-0")}>
      <div className="px-[22px] pt-[18px] pb-3.5">
        <h2 className={cn(TITLE_CLASS, "p-0 font-sans")}>Choisir vos licences</h2>
        <p className="m-0 mt-0.5 text-[12.5px] text-muted-foreground">
          {billing.status === "canceled" ? "Votre abonnement est terminé. " : ""}Facturé chaque mois, hors taxes.
        </p>
      </div>
      {enabled.length === 0 ? (
        <p className={cn(ROW_BORDER_CLASS, "m-0 px-[22px] py-4 text-[13px] text-muted-foreground")}>
          Aucun service n'est encore activé pour votre agence : contactez Konodal.
        </p>
      ) : (
        <>
          {enabled.map((type) => (
            <label
              key={type}
              className={cn(ROW_BORDER_CLASS, TABLE_COLS, "cursor-pointer px-[22px] py-3 text-[13.5px]")}
            >
              <span className="flex items-center gap-2.5 font-bold text-[oklch(22%_0.01_150)]">
                <input
                  type="checkbox"
                  className="size-4 accent-[oklch(40%_0.08_155)]"
                  checked={services.includes(type)}
                  onChange={(e) =>
                    setServices(
                      e.target.checked
                        ? SERVICE_TYPES.filter((t) => t === type || services.includes(t))
                        : services.filter((t) => t !== type)
                    )
                  }
                />
                Service {serviceTypeLabels[type]}
              </span>
              <span className="text-muted-foreground">{formatCents(prices.service)} HT</span>
              <span className="text-right font-extrabold">
                {services.includes(type) ? `${formatCents(prices.service)} HT` : "—"}
              </span>
            </label>
          ))}
          <div className={cn(ROW_BORDER_CLASS, TINT_BG_CLASS, TABLE_COLS, "px-[22px] py-3 text-[13.5px]")}>
            <div>
              <div className="font-bold text-[oklch(22%_0.01_150)]">Licences agent</div>
              <div className="text-[12px] text-muted-foreground">
                Une licence par agent, en plus du compte du service.
              </div>
            </div>
            <span className="text-muted-foreground">{formatCents(prices.agent)} HT</span>
            <div className="flex justify-end">
              <div className="flex h-9 items-center rounded-[11px] border border-input bg-white">
                <button
                  type="button"
                  aria-label="Une licence de moins"
                  className="flex h-full w-9 items-center justify-center disabled:opacity-30"
                  disabled={count <= minAgents}
                  onClick={() => setAgents(count - 1)}
                >
                  <Minus className="size-3.5" />
                </button>
                <span className="w-9 border-x text-center text-[14px] font-extrabold tabular-nums">{count}</span>
                <button
                  type="button"
                  aria-label="Une licence de plus"
                  className="flex h-full w-9 items-center justify-center disabled:opacity-30"
                  disabled={count >= MAX_AGENT_LICENCES}
                  onClick={() => setAgents(count + 1)}
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
            </div>
          </div>
          <div className={cn(ROW_BORDER_CLASS, "flex flex-wrap items-center justify-between gap-3 px-[22px] py-4")}>
            <span className="text-[14px] font-extrabold">Total : {formatCents(total)} HT / mois</span>
            <Button
              type="button"
              disabled={redirecting || services.length === 0}
              onClick={handleSubscribe}
              className={cn(PRIMARY_CTA_CLASS, "h-10 rounded-[12px] px-5 font-bold")}
            >
              S'abonner
            </Button>
          </div>
        </>
      )}
    </section>
  )
}

function InvoicesCard({ overview, loading }: { overview: BillingOverview | null; loading: boolean }) {
  const invoices = overview?.invoices ?? []
  const cols = "grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_auto] items-center gap-3"
  return (
    <section className={cn(PANEL_CARD_CLASS, "overflow-hidden p-0")}>
      <h2 className={cn(TITLE_CLASS, "px-[22px] pt-[18px] pb-3.5 font-sans")}>Factures</h2>
      <div className="overflow-x-auto">
        <div className="min-w-[520px]">
          <div className={cn(ROW_BORDER_CLASS, cols, "bg-[oklch(98%_0.004_100)] px-[22px] py-2")}>
            <span className={CAPS_LABEL_CLASS}>Date</span>
            <span className={CAPS_LABEL_CLASS}>Numéro</span>
            <span className={CAPS_LABEL_CLASS}>Montant HT</span>
            <span className={CAPS_LABEL_CLASS}>Statut</span>
            <span className="w-12" />
          </div>
          {loading ? (
            <p className={cn(ROW_BORDER_CLASS, "m-0 px-[22px] py-4 text-[13px] text-muted-foreground")}>Chargement…</p>
          ) : invoices.length === 0 ? (
            <p className={cn(ROW_BORDER_CLASS, "m-0 px-[22px] py-4 text-[13px] text-muted-foreground")}>
              Aucune facture pour l'instant.
            </p>
          ) : (
            invoices.map((invoice) => {
              const link = invoice.invoicePdf ?? invoice.hostedInvoiceUrl
              return (
                <div key={invoice.id} className={cn(ROW_BORDER_CLASS, cols, "px-[22px] py-3 text-[13px]")}>
                  <span className="font-bold text-[oklch(22%_0.01_150)]">
                    {invoice.date?.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) ??
                      "—"}
                  </span>
                  <span className="text-muted-foreground">{invoice.number ?? "—"}</span>
                  <span className="font-bold">{formatCents(invoice.totalExcludingTaxCents ?? invoice.totalCents)}</span>
                  <span>
                    <Pill tone={invoiceTones[invoice.status] ?? "grey"}>
                      {invoiceStatusLabels[invoice.status] ?? invoice.status}
                    </Pill>
                  </span>
                  {link ? (
                    <a
                      href={link}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(LINK_BUTTON_CLASS, "inline-flex w-12 items-center justify-end gap-1")}
                    >
                      <Download className="size-3.5" />
                      PDF
                    </a>
                  ) : (
                    <span className="w-12" />
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </section>
  )
}

// Prochaine facturation (maquette 11k, après la période d'essai) : date,
// montant et carte utilisée ; fin de l'abonnement s'il est résilié.
function NextBillingCard({
  billing,
  cents,
  paymentMethod,
  loading,
}: {
  billing: GeranceBilling
  cents: number
  paymentMethod: BillingPaymentMethod | null
  loading: boolean
}) {
  const ending = billing.cancelAtPeriodEnd
  const late = ["past_due", "unpaid", "paused"].includes(billing.status)
  const pill: { label: string; tone: PillTone } = ending
    ? { label: "Résilié", tone: "red" }
    : billing.status === "paused"
      ? { label: "Suspendu", tone: "amber" }
      : late
        ? { label: "Paiement en retard", tone: "amber" }
        : { label: "Abonnement actif", tone: "green" }
  const rows = [
    {
      label: ending ? "Fin le" : "Date",
      value: billing.currentPeriodEnd ? formatLongDate(billing.currentPeriodEnd) : "—",
    },
    ...(ending
      ? []
      : [
          { label: "Montant estimé", value: loading ? "…" : `${formatCents(cents)} HT` },
          {
            label: "Moyen de paiement",
            value: loading
              ? "…"
              : paymentMethod
                ? `${paymentMethod.brand ? paymentMethod.brand[0].toUpperCase() + paymentMethod.brand.slice(1) : "Carte"} •••• ${paymentMethod.last4}`
                : "Aucune carte",
            warn: !loading && !paymentMethod,
          },
        ]),
  ]
  return (
    <section className={cn(PANEL_CARD_CLASS, "overflow-hidden p-0")}>
      <div className="flex items-center justify-between gap-3 px-[22px] pt-[18px] pb-3.5">
        <h2 className={cn(TITLE_CLASS, "p-0 font-sans")}>{ending ? "Fin de l'abonnement" : "Prochaine facturation"}</h2>
        <Pill tone={pill.tone}>{pill.label}</Pill>
      </div>
      {rows.map((row) => (
        <div
          key={row.label}
          className={cn(ROW_BORDER_CLASS, "flex items-center justify-between gap-3 px-[22px] py-2.5 text-[13px]")}
        >
          <span className="text-muted-foreground">{row.label}</span>
          <span
            className={cn(
              "text-right font-extrabold",
              "warn" in row && row.warn ? "text-[oklch(48%_0.17_27)]" : "text-[oklch(22%_0.01_150)]"
            )}
          >
            {row.value}
          </span>
        </div>
      ))}
    </section>
  )
}

// Période d'essai (maquette 11c) : jours restants et jauge du temps restant,
// qui se vide jusqu'à la fin de l'essai (ambre la dernière semaine).
function TrialCard({ trialStart, trialEnd }: { trialStart: Date | null; trialEnd: Date }) {
  const now = Date.now()
  const total = trialStart ? Math.max(1, Math.round((trialEnd.getTime() - trialStart.getTime()) / DAY_MS)) : null
  const remaining = Math.max(0, Math.ceil((trialEnd.getTime() - now) / DAY_MS))
  const share = total ? Math.min(1, remaining / total) : null
  const ending = remaining <= 7
  return (
    <section className={cn(PANEL_CARD_CLASS, "flex flex-col gap-3")}>
      <div className="flex items-center justify-between gap-3">
        <h2 className={cn(TITLE_CLASS, "p-0 font-sans")}>Période d'essai</h2>
        <Pill tone={ending ? "amber" : "green"}>{ending ? "Se termine bientôt" : "En cours"}</Pill>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-[26px] leading-none font-extrabold tracking-tight text-[oklch(22%_0.01_150)]">
          {remaining} jour{remaining > 1 ? "s" : ""}
        </span>
        <span className="text-[13px] text-muted-foreground">
          restant{remaining > 1 ? "s" : ""}
          {total ? ` sur ${total}` : ""}
        </span>
      </div>
      {share !== null && (
        <div
          role="progressbar"
          aria-label="Temps restant de la période d'essai"
          aria-valuemin={0}
          aria-valuemax={total ?? undefined}
          aria-valuenow={remaining}
          className="h-2 overflow-hidden rounded-full bg-[oklch(92%_0.01_150)]"
        >
          <div
            className={cn("h-full rounded-full", ending ? "bg-[oklch(70%_0.14_70)]" : "bg-[oklch(40%_0.08_155)]")}
            style={{ width: `${share * 100}%` }}
          />
        </div>
      )}
      <p className="m-0 text-[13px] leading-normal text-[oklch(35%_0.01_150)]">
        Fin de l'essai le <strong>{trialEnd.toLocaleDateString("fr-FR")}</strong>. Vous ne payez rien d'ici là ;
        ensuite, l'abonnement démarre avec les services et licences ci-contre.
      </p>
    </section>
  )
}
