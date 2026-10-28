import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin"
import { createCsSubscriptionLink, setResidencePlan, subscribeToCsAvance, type CsAvanceState } from "@/lib/csAvance"
import { PRIMARY_CTA_CLASS } from "@/lib/utils"

function formatDate(date: Date | null): string {
  return date ? date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : ""
}

function statusLabel(state: CsAvanceState): { label: string; variant: "default" | "secondary" | "outline" | "destructive" } {
  if (state.plan !== "cs_avance" || state.mode === "none") return { label: "Non souscrite", variant: "outline" }
  if (state.mode === "read_only") return { label: "Terminée (lecture seule)", variant: "destructive" }
  if (state.mode === "grace") return { label: "Paiement en retard", variant: "destructive" }
  if (state.source === "grant") {
    return { label: state.until ? `Offerte jusqu'au ${formatDate(state.until)}` : "Offerte", variant: "secondary" }
  }
  return { label: "Active", variant: "default" }
}

// Option CS avancé de la résidence : souscription ou gestion par le syndic
// (page konodal.com/souscription, même parcours que le conseil syndical),
// attribution manuelle par Konodal (offre, geste commercial, facture réglée
// hors Stripe).
export function CsAvanceSection({ residenceId }: { residenceId: string }) {
  const { isSuperAdmin } = useIsSuperAdmin()
  const [state, setState] = useState<CsAvanceState | null>(null)
  const [opening, setOpening] = useState(false)
  const [until, setUntil] = useState("")
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => subscribeToCsAvance(residenceId, setState), [residenceId])

  async function openSubscription() {
    // Fenêtre ouverte tout de suite : après l'appel au serveur, le
    // navigateur la bloquerait comme une fenêtre surgissante.
    const target = window.open("", "_blank")
    setOpening(true)
    try {
      const url = await createCsSubscriptionLink(residenceId)
      if (target) target.location.href = url
      else window.location.href = url
    } catch (error) {
      target?.close()
      toast.error("Impossible d'ouvrir la souscription : " + (error as Error).message)
    } finally {
      setOpening(false)
    }
  }

  async function grant(plan: "free" | "cs_avance") {
    setSaving(true)
    try {
      await setResidencePlan({
        residenceId,
        plan,
        until: plan === "cs_avance" && until ? until : undefined,
        reason: reason || undefined,
      })
      toast.success(plan === "free" ? "Résidence repassée en gratuit" : "Option CS avancé attribuée")
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (!state) return null
  const status = statusLabel(state)
  const details = [
    state.interval === "month" ? "Mensuel" : state.interval === "year" ? "Annuel" : "",
    state.source === "stripe" ? (state.byInvoice ? "sur facture au syndicat" : "carte ou prélèvement") : "",
    state.cancelAtPeriodEnd && state.currentPeriodEnd ? `résiliée, active jusqu'au ${formatDate(state.currentPeriodEnd)}` : "",
    !state.cancelAtPeriodEnd && state.source === "stripe" && state.currentPeriodEnd
      ? `prochaine échéance le ${formatDate(state.currentPeriodEnd)}`
      : "",
  ].filter(Boolean)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Option CS avancé</CardTitle>
        <CardDescription>
          Offre de la résidence : Nodo, votes et assemblées générales, mail avec le syndic, certification des
          résidents, sans publicité. Souscrite par le conseil syndical ou le syndic ; résiliée par le syndic ou par
          deux membres du conseil syndical.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={status.variant}>{status.label}</Badge>
          {details.length > 0 && <span className="text-muted-foreground">{details.join(" · ")}</span>}
        </div>
        <div>
          <Button className={PRIMARY_CTA_CLASS} disabled={opening} onClick={openSubscription}>
            {state.source === "stripe" ? "Gérer l'abonnement" : "Souscrire pour la résidence"}
          </Button>
        </div>

        {isSuperAdmin && (
          <div className="flex flex-col gap-3 border-t pt-4">
            <span className="font-semibold">Attribution manuelle (Konodal)</span>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cs-avance-until">Offerte jusqu'au</Label>
                <Input id="cs-avance-until" type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
              </div>
              <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
                <Label htmlFor="cs-avance-reason">Motif</Label>
                <Input
                  id="cs-avance-reason"
                  placeholder="Geste commercial, facture réglée hors Stripe…"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
              <Button variant="outline" disabled={saving} onClick={() => grant("cs_avance")}>
                Offrir l'option
              </Button>
              <Button variant="outline" disabled={saving} onClick={() => grant("free")}>
                Repasser en gratuit
              </Button>
            </div>
            <span className="text-xs text-muted-foreground">
              Sans date, l'option est offerte sans fin. Impossible pendant un abonnement Stripe en cours.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
