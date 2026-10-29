import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { OUTLINE_BUTTON_CLASS } from "@/components/agency/agencyUi"
import type { LicencePrices } from "@/components/agency/ServiceTeamCard"
import type { AgencyTeamMember } from "@/lib/gerances"
import { agentUids, formatCents, isBillingActive, licenceUsage, unlicensedAgentUids } from "@/lib/licences"
import { cn, PANEL_CARD_CLASS } from "@/lib/utils"
import type { GeranceBilling } from "@/types/billing"
import type { Gerance } from "@/types/gerance"

const STAT_LABEL_CLASS = "text-[12.5px] font-semibold text-muted-foreground"
const STAT_VALUE_CLASS = "text-[22px] leading-tight font-extrabold tracking-tight text-[oklch(22%_0.01_150)]"
const STAT_HINT_CLASS = "text-[12px] text-muted-foreground"

// Bandeau de l'onglet Équipe (maquette 11b) : agents, licences agent
// utilisées sur achetées, montant mensuel des licences agent.
export function TeamStats({
  gerance,
  billing,
  team,
  prices,
  canEdit,
  onAddLicences,
}: {
  gerance: Gerance
  billing: GeranceBilling
  team: Record<string, AgencyTeamMember> | null
  prices: LicencePrices
  canEdit: boolean
  onAddLicences: () => void
}) {
  const usage = licenceUsage(gerance, billing)
  const licensed = [...agentUids(gerance, billing)]
  const unlicensed = unlicensedAgentUids(billing)
  const invited = team ? licensed.filter((uid) => team[uid] && !team[uid].lastSignInAt).length : 0
  const active = team ? licensed.filter((uid) => team[uid]?.lastSignInAt).length : licensed.length
  const { purchased, assigned, available } = usage.agents
  const detail = [
    `${active} actif${active > 1 ? "s" : ""}`,
    invited > 0 && `${invited} invitation${invited > 1 ? "s" : ""} envoyée${invited > 1 ? "s" : ""}`,
    unlicensed.length > 0 && `${unlicensed.length} sans licence`,
  ]
    .filter(Boolean)
    .join(" · ")
  // Une barre par licence tant qu'elles restent lisibles, sinon une jauge.
  const segmented = purchased > 0 && purchased <= 12

  return (
    <section className={cn(PANEL_CARD_CLASS, "grid gap-5 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-center")}>
      <div className="flex flex-col gap-1">
        <span className={STAT_LABEL_CLASS}>Agents</span>
        <span className={STAT_VALUE_CLASS}>{licensed.length + unlicensed.length}</span>
        <span className={STAT_HINT_CLASS}>{detail}</span>
      </div>
      <div className="flex flex-col gap-1 sm:border-l sm:border-[oklch(94%_0.004_100)] sm:pl-5">
        <span className={STAT_LABEL_CLASS}>Licences agent</span>
        <span className={STAT_VALUE_CLASS}>
          {assigned} sur {purchased} utilisée{assigned > 1 ? "s" : ""}
        </span>
        {segmented ? (
          <div className="flex gap-1">
            {Array.from({ length: purchased }, (_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 flex-1 rounded-full",
                  i < assigned ? "bg-[oklch(40%_0.08_155)]" : "bg-[oklch(92%_0.01_150)]"
                )}
              />
            ))}
          </div>
        ) : (
          <div className="h-1.5 overflow-hidden rounded-full bg-[oklch(92%_0.01_150)]">
            <div
              className="h-full rounded-full bg-[oklch(40%_0.08_155)]"
              style={{ width: purchased ? `${Math.min(100, (assigned / purchased) * 100)}%` : "0%" }}
            />
          </div>
        )}
        <span className={STAT_HINT_CLASS}>
          {!isBillingActive(billing)
            ? "Aucun abonnement en cours"
            : available > 0
              ? `${available} licence${available > 1 ? "s" : ""} libre${available > 1 ? "s" : ""}`
              : "Toutes utilisées : une invitation en ajoute une"}
        </span>
      </div>
      <div className="flex flex-col gap-1 sm:border-l sm:border-[oklch(94%_0.004_100)] sm:pl-5">
        <span className={STAT_LABEL_CLASS}>Total payé · licences agent</span>
        <span className={STAT_VALUE_CLASS}>{formatCents(purchased * prices.agent)} HT</span>
        <span className={STAT_HINT_CLASS}>
          par mois · {purchased} × {formatCents(prices.agent)} HT
        </span>
      </div>
      {canEdit && (
        <Button
          type="button"
          variant="outline"
          className={OUTLINE_BUTTON_CLASS}
          disabled={!isBillingActive(billing)}
          onClick={onAddLicences}
        >
          <Plus />
          Ajouter des licences
        </Button>
      )}
    </section>
  )
}
