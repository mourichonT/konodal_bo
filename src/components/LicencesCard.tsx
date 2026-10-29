import { useState, type ReactNode } from "react"
import { toast } from "sonner"
import { AlertTriangle, Check, CreditCard, KeyRound, Landmark, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { LicenceMigrationDialog } from "@/components/LicenceMigrationDialog"
import { LicenceTrialDialog } from "@/components/LicenceTrialDialog"
import { useAccountRole } from "@/hooks/useAccountRole"
import { adjustLicences, createBillingPortalSession, type LicenceAction } from "@/lib/billing"
import {
  DEFAULT_AGENT_PRICE_CENTS,
  DEFAULT_SERVICE_PRICE_CENTS,
  formatCents,
  isLegacyBilling,
  licenceUsage,
  MAX_AGENT_LICENCES,
  SERVICE_TYPES,
  type ServiceLicenceState,
} from "@/lib/licences"
import { cn, ICON_TILE_CLASS, ICON_TILE_OFF_CLASS, ICON_TILE_ON_CLASS, PANEL_CARD_CLASS, PRIMARY_CTA_CLASS } from "@/lib/utils"
import { billingStatusLabels, type GeranceBilling } from "@/types/billing"
import { AGENT_UID_FIELD, serviceTypeLabels, type Gerance, type ServiceType } from "@/types/gerance"

const serviceIcons = { serviceSyndic: Landmark, geranceLocative: KeyRound } as const

const stateLabels: Record<ServiceLicenceState, string> = {
  assigned: "Attribuée",
  unassigned: "Non attribuée",
  none: "Non souscrite",
}

const LINK_CLASS =
  "text-[12.5px] font-bold text-[oklch(38%_0.09_155)] hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline"

type PendingChange = { change: LicenceAction; title: string; description: ReactNode }

// Carte « Abonnement » de la maquette (fiche agence, page Facturation) :
// licences service (une par service, 2 au maximum) et licences agent
// (stock : achetées / attribuées / disponibles), Ajouter / Retirer et portail
// Stripe. Règles : functions_python/licence_billing.py (le serveur revérifie).
export function LicencesCard({
  gerance,
  billing,
  servicePriceCents = DEFAULT_SERVICE_PRICE_CENTS,
  agentPriceCents = DEFAULT_AGENT_PRICE_CENTS,
  emptyAction,
}: {
  gerance: Gerance
  billing: GeranceBilling
  servicePriceCents?: number | null
  agentPriceCents?: number | null
  // Sans abonnement : action proposée sous le message (ex. S'abonner).
  emptyAction?: ReactNode
}) {
  const { isSuperAdmin, isAgence } = useAccountRole()
  const canEdit = isSuperAdmin || isAgence
  const [pending, setPending] = useState<PendingChange | null>(null)
  const [agentDialog, setAgentDialog] = useState<"add" | "remove" | null>(null)
  const [agentCount, setAgentCount] = useState("1")
  const [busy, setBusy] = useState(false)

  const subscribed = ["active", "trialing", "past_due"].includes(billing.status)
  const legacy = isLegacyBilling(billing)
  const editable = canEdit && subscribed && !legacy
  const trialing = billing.status === "trialing"
  const usage = licenceUsage(gerance, billing)
  const proration = trialing
    ? "Pendant l'essai, rien n'est facturé avant la fin de l'essai."
    : "Facturé au prorata sur la prochaine facture."

  async function run(change: LicenceAction, success: string) {
    setBusy(true)
    try {
      await adjustLicences(gerance.id, change)
      toast.success(success)
      setPending(null)
      setAgentDialog(null)
    } catch (err) {
      toast.error("Modification impossible : " + (err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function openPortal() {
    setBusy(true)
    try {
      window.location.assign((await createBillingPortalSession(gerance.id)).url)
    } catch (err) {
      toast.error("Ouverture impossible : " + (err as Error).message)
      setBusy(false)
    }
  }

  if (!subscribed && billing.status !== "paused" && billing.status !== "unpaid") {
    return (
      <div className={cn(PANEL_CARD_CLASS, "flex flex-col gap-3 text-[12.5px]")}>
        <div className="flex items-center gap-3">
          <div className={cn(ICON_TILE_CLASS, ICON_TILE_OFF_CLASS)}>
            <CreditCard />
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[14px] font-bold text-[oklch(22%_0.01_150)]">
              {billing.status === "canceled" ? "Abonnement annulé" : "Aucun abonnement"}
            </span>
            <span className="leading-snug text-muted-foreground">Aucune licence achetée pour l'instant.</span>
          </div>
        </div>
        {emptyAction}
      </div>
    )
  }

  const agentPercent =
    usage.agents.purchased > 0 ? Math.min(100, Math.round((usage.agents.assigned / usage.agents.purchased) * 100)) : 0
  const count = Math.max(0, Math.min(MAX_AGENT_LICENCES, Number(agentCount) || 0))

  return (
    <div className={cn(PANEL_CARD_CLASS, "flex flex-col gap-3.5 text-[12.5px]")}>
      <div className="flex items-start gap-3">
        <div className={cn(ICON_TILE_CLASS, billing.status === "active" || trialing ? ICON_TILE_ON_CLASS : ICON_TILE_OFF_CLASS)}>
          <CreditCard />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[14px] font-bold text-[oklch(22%_0.01_150)]">Abonnement</span>
          <span className="leading-snug text-muted-foreground">Licences service et licences agent</span>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold",
            billing.status === "active" || trialing
              ? "bg-[oklch(93%_0.05_150)] text-[oklch(32%_0.09_155)]"
              : "bg-amber-100 text-amber-800"
          )}
        >
          {(billing.status === "active" || trialing) && <Check className="size-3.5" />}
          {billingStatusLabels[billing.status]}
        </span>
      </div>

      {trialing && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] bg-[oklch(97%_0.008_155)] p-2.5">
          <span className="font-semibold text-[oklch(32%_0.09_155)]">
            Essai gratuit
            {billing.currentPeriodEnd ? ` jusqu'au ${billing.currentPeriodEnd.toLocaleDateString("fr-FR")}` : ""}
          </span>
          {isSuperAdmin && (
            <LicenceTrialDialog geranceId={gerance.id} trialEnd={billing.currentPeriodEnd} className={LINK_CLASS} />
          )}
        </div>
      )}

      {billing.cancelAtPeriodEnd && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] bg-amber-50 p-2.5 text-amber-900">
          <span>
            Résiliation programmée
            {billing.currentPeriodEnd ? ` le ${billing.currentPeriodEnd.toLocaleDateString("fr-FR")}` : ""}.
          </span>
          {editable && (
            <button type="button" className={LINK_CLASS} disabled={busy} onClick={() => run({ action: "resume" }, "Abonnement repris")}>
              Reprendre
            </button>
          )}
        </div>
      )}

      {legacy && (
        <div className="flex flex-col gap-2 rounded-[12px] bg-amber-50 p-2.5 leading-snug text-amber-900">
          <p className="m-0 flex gap-2">
            <AlertTriangle className="mt-px size-4 shrink-0" />
            Ancienne formule ({billing.legacySeatCount} licence{billing.legacySeatCount > 1 ? "s" : ""} par siège) : la
            migration vers les licences service et agent est à faire par un administrateur Konodal.
          </p>
          {isSuperAdmin && <LicenceMigrationDialog geranceId={gerance.id} />}
        </div>
      )}
      {billing.licenceMismatch && isSuperAdmin && (
        <p className="m-0 flex gap-2 rounded-[12px] bg-amber-50 p-2.5 leading-snug text-amber-900">
          <AlertTriangle className="mt-px size-4 shrink-0" />
          Écart entre les services souscrits et la quantité facturée dans Stripe : à vérifier.
        </p>
      )}

      {!legacy && (
        <>
          <section className="flex flex-col gap-2.5 rounded-[16px] bg-[oklch(97%_0.008_155)] p-3.5">
            <div className="flex items-start gap-2.5">
              <Landmark className="mt-0.5 size-4 shrink-0 text-[oklch(38%_0.09_155)]" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-[13.5px] font-bold text-[oklch(22%_0.01_150)]">Licences service</span>
                <span className="text-muted-foreground">
                  Une licence par service · 2 maximum · {formatCents(servicePriceCents)} HT/mois
                </span>
              </div>
              <span className="text-[14px] font-extrabold text-[oklch(22%_0.01_150)]">
                {usage.subscribed.length} <span className="text-muted-foreground">/ 2</span>
              </span>
            </div>
            {SERVICE_TYPES.map((type, index) => (
              <ServiceLicenceRow
                key={type}
                type={type}
                state={usage.services[type]}
                separated={index > 0}
                editable={editable}
                busy={busy}
                serviceEnabled={!!gerance.services[type]}
                serviceHasAccounts={(gerance[AGENT_UID_FIELD[type]] ?? []).length > 0}
                onAdd={() =>
                  setPending({
                    change: { action: "addService", serviceType: type },
                    title: `Ajouter la licence ${serviceTypeLabels[type]}`,
                    description: (
                      <>
                        Une licence service de plus : <strong>{formatCents(servicePriceCents)} HT/mois</strong>.{" "}
                        {proration}
                      </>
                    ),
                  })
                }
                onRemove={() =>
                  setPending({
                    change: { action: "removeService", serviceType: type },
                    title: `Retirer la licence ${serviceTypeLabels[type]}`,
                    description:
                      usage.subscribed.length === 1
                        ? "C'est la dernière licence service : l'abonnement sera résilié à la fin de la période en cours."
                        : `La licence n'est plus facturée (${formatCents(servicePriceCents)} HT/mois en moins, au prorata).`,
                  })
                }
              />
            ))}
          </section>

          <section className="flex flex-col gap-2.5 rounded-[16px] bg-[oklch(97%_0.008_155)] p-3.5">
            <div className="flex items-start gap-2.5">
              <Users className="mt-0.5 size-4 shrink-0 text-[oklch(38%_0.09_155)]" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-[13.5px] font-bold text-[oklch(22%_0.01_150)]">Licences agent</span>
                <span className="text-muted-foreground">Une par agent invité · {formatCents(agentPriceCents)} HT/mois</span>
              </div>
              {editable && (
                <div className="flex items-center gap-3">
                  {usage.agents.available > 0 && (
                    <button
                      type="button"
                      className={LINK_CLASS}
                      disabled={busy}
                      onClick={() => {
                        setAgentCount("1")
                        setAgentDialog("remove")
                      }}
                    >
                      Retirer
                    </button>
                  )}
                  <button
                    type="button"
                    className={LINK_CLASS}
                    disabled={busy || usage.subscribed.length === 0}
                    title={usage.subscribed.length === 0 ? "Souscrivez d'abord une licence service" : undefined}
                    onClick={() => {
                      setAgentCount("1")
                      setAgentDialog("add")
                    }}
                  >
                    Ajouter
                  </button>
                </div>
              )}
            </div>
            <dl className="m-0 grid grid-cols-3 gap-2">
              {(
                [
                  ["Achetées", usage.agents.purchased, false],
                  ["Attribuées", usage.agents.assigned, false],
                  ["Disponibles", usage.agents.available, true],
                ] as const
              ).map(([label, value, accent]) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <dt className="font-semibold text-muted-foreground">{label}</dt>
                  <dd
                    className={cn(
                      "m-0 text-[18px] leading-none font-extrabold",
                      accent ? "text-[oklch(38%_0.09_155)]" : "text-[oklch(22%_0.01_150)]"
                    )}
                  >
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="h-1.5 overflow-hidden rounded-full bg-[oklch(92%_0.008_150)]">
              <div className="h-full bg-[oklch(45%_0.1_155)]" style={{ width: `${agentPercent}%` }} />
            </div>
          </section>
        </>
      )}

      {canEdit && billing.stripeCustomerId && (
        <Button
          type="button"
          variant="outline"
          className="h-10 w-full rounded-[12px] bg-white font-bold"
          disabled={busy}
          onClick={openPortal}
        >
          Gérer l'abonnement
        </Button>
      )}

      <Dialog open={!!pending} onOpenChange={(open) => !open && !busy && setPending(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{pending?.title}</DialogTitle>
          </DialogHeader>
          <DialogDescription>{pending?.description}</DialogDescription>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setPending(null)}>
              Annuler
            </Button>
            <Button
              type="button"
              className={PRIMARY_CTA_CLASS}
              disabled={busy}
              onClick={() => pending && run(pending.change, "Licences mises à jour")}
            >
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!agentDialog} onOpenChange={(open) => !open && !busy && setAgentDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{agentDialog === "add" ? "Ajouter des licences agent" : "Retirer des licences agent"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input
              type="number"
              min={1}
              max={agentDialog === "remove" ? usage.agents.available : MAX_AGENT_LICENCES}
              value={agentCount}
              aria-label="Nombre de licences agent"
              onChange={(e) => setAgentCount(e.target.value)}
              className="h-10 w-28 rounded-[10px]"
            />
            <DialogDescription>
              {agentDialog === "add" ? (
                <>
                  {count} licence{count > 1 ? "s" : ""} agent de plus :{" "}
                  <strong>{formatCents((agentPriceCents ?? 0) * count)} HT/mois</strong>. {proration}
                </>
              ) : (
                <>
                  Seules les licences disponibles (non attribuées) peuvent être retirées : {usage.agents.available} au
                  maximum.
                </>
              )}
            </DialogDescription>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setAgentDialog(null)}>
              Annuler
            </Button>
            <Button
              type="button"
              className={PRIMARY_CTA_CLASS}
              disabled={
                busy || count < 1 || (agentDialog === "remove" && count > usage.agents.available)
              }
              onClick={() =>
                run(
                  { action: agentDialog === "add" ? "addAgents" : "removeAgents", count },
                  agentDialog === "add" ? "Licences agent ajoutées" : "Licences agent retirées"
                )
              }
            >
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ServiceLicenceRow({
  type,
  state,
  separated,
  editable,
  busy,
  serviceEnabled,
  serviceHasAccounts,
  onAdd,
  onRemove,
}: {
  type: ServiceType
  state: ServiceLicenceState
  separated: boolean
  editable: boolean
  busy: boolean
  serviceEnabled: boolean
  serviceHasAccounts: boolean
  onAdd: () => void
  onRemove: () => void
}) {
  const Icon = serviceIcons[type]
  return (
    <div className={cn("flex items-center gap-2.5", separated && "border-t border-[oklch(92%_0.006_150)] pt-2.5")}>
      <div className={cn(ICON_TILE_CLASS, "size-9 rounded-[10px]", state === "none" ? ICON_TILE_OFF_CLASS : ICON_TILE_ON_CLASS)}>
        <Icon />
      </div>
      <span className="min-w-0 flex-1 text-[13px] font-bold text-[oklch(22%_0.01_150)]">{serviceTypeLabels[type]}</span>
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold",
          state === "assigned"
            ? "bg-[oklch(93%_0.05_150)] text-[oklch(32%_0.09_155)]"
            : "bg-[oklch(94%_0.004_100)] text-[oklch(45%_0.01_150)]"
        )}
      >
        {state === "assigned" && <Check className="size-3.5" />}
        {stateLabels[state]}
      </span>
      {editable && state === "none" && (
        <button
          type="button"
          className={LINK_CLASS}
          disabled={busy || !serviceEnabled}
          title={serviceEnabled ? undefined : "Activez d'abord ce service sur la fiche de l'agence"}
          onClick={onAdd}
        >
          Ajouter
        </button>
      )}
      {editable && state === "unassigned" && (
        <button
          type="button"
          className={LINK_CLASS}
          disabled={busy || serviceHasAccounts}
          title={serviceHasAccounts ? "Révoquez d'abord les comptes de ce service" : undefined}
          onClick={onRemove}
        >
          Retirer
        </button>
      )}
    </div>
  )
}
