import { useState } from "react"
import { toast } from "sonner"
import { CalendarCheck, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DateInput } from "@/components/DateInput"
import { setCsTrialEnd, setResidencePlan, type CsBillingAdmin } from "@/lib/csAvance"
import { cn } from "@/lib/utils"
import { ConfirmActionDialog } from "./ConfirmActionDialog"
import { formatDate, isoInMonths, toIsoDate } from "./format"

const PRESET_MONTHS = [3, 6, 12, 24]

function Presets({ from, onPick, value }: { from: Date; onPick: (iso: string) => void; value: string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PRESET_MONTHS.map((months) => {
        const iso = isoInMonths(months, from)
        return (
          <button
            key={months}
            type="button"
            onClick={() => onPick(iso)}
            className={cn(
              "rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors",
              value === iso
                ? "border-transparent bg-[oklch(45%_0.1_155)] text-white"
                : "hover:bg-[oklch(96%_0.02_155)]"
            )}
          >
            +{months} mois
          </button>
        )
      })}
    </div>
  )
}

// Offre sans Stripe (« Offerte jusqu'au », set_residence_plan), ou fin de la
// période offerte d'un abonnement Stripe (premier paiement).
export function OfferCard({
  residenceId,
  data,
  onChanged,
}: {
  residenceId: string
  data: CsBillingAdmin
  onChanged: () => Promise<void>
}) {
  const sub = data.subscription
  const trialing = sub?.status === "trialing"
  const subscribed = sub?.subscribed ?? false
  const grant = data.grant
  const [until, setUntil] = useState(grant?.until ? toIsoDate(grant.until) : "")
  const [trialEnd, setTrialEnd] = useState(sub?.trialEnd ? toIsoDate(sub.trialEnd) : "")
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<"free" | "end_trial" | null>(null)

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

  if (subscribed && !trialing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Offre et période offerte</CardTitle>
          <CardDescription>
            Abonnement Stripe en cours : pour offrir des mois, appliquez une remise (100 %) à côté.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (trialing && sub) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Période offerte</CardTitle>
          <CardDescription>
            Abonnement souscrit, {sub.byInvoice ? "première facture" : "premier paiement"} le {formatDate(sub.trialEnd)}.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <div className="flex flex-col gap-1.5">
            <Label>Fin de la période offerte</Label>
            <div className="flex flex-wrap items-center gap-2">
              <DateInput value={trialEnd} onChange={setTrialEnd} />
              <Presets from={sub.trialEnd ?? new Date()} value={trialEnd} onPick={setTrialEnd} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy || !trialEnd || trialEnd === (sub.trialEnd ? toIsoDate(sub.trialEnd) : "")}
              onClick={() => run(() => setCsTrialEnd(residenceId, trialEnd), "Fin de la période offerte modifiée")}
            >
              <CalendarCheck />
              Enregistrer
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setConfirm("end_trial")}>
              Terminer maintenant
            </Button>
          </div>
        </CardContent>
        <ConfirmActionDialog
          open={confirm === "end_trial"}
          onOpenChange={(open) => !open && setConfirm(null)}
          title="Terminer la période offerte ?"
          description={
            sub.byInvoice
              ? "La première facture est émise et envoyée au syndicat tout de suite."
              : "Le premier paiement est prélevé tout de suite sur le moyen enregistré."
          }
          confirmLabel="Terminer"
          destructive
          onConfirm={() => run(() => setCsTrialEnd(residenceId, "now"), "Période offerte terminée")}
        />
      </Card>
    )
  }

  // Pas d'abonnement Stripe en cours : offre gérée par Konodal.
  const changed = until !== (grant?.until ? toIsoDate(grant.until) : "") || !grant
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Offre Konodal</CardTitle>
        <CardDescription>
          {grant
            ? `Offerte ${grant.until ? `jusqu'au ${formatDate(grant.until)}` : "sans date de fin"} depuis le ${formatDate(
                grant.grantedAt
              )}${grant.grantedByName ? ` par ${grant.grantedByName}` : ""}${grant.reason ? ` · ${grant.reason}` : ""}.`
            : "Toutes les fonctions CS avancé, sans paiement, jusqu'à une date. La résidence peut souscrire pendant l'offre : premier paiement à sa fin."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <div className="flex flex-col gap-1.5">
          <Label>Offerte jusqu'au</Label>
          <div className="flex flex-wrap items-center gap-2">
            <DateInput value={until} onChange={setUntil} />
            <Presets
              from={grant?.until && grant.until > new Date() ? grant.until : new Date()}
              value={until}
              onPick={setUntil}
            />
            <button
              type="button"
              onClick={() => setUntil("")}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-xs font-semibold",
                until === "" ? "border-transparent bg-[oklch(45%_0.1_155)] text-white" : "hover:bg-[oklch(96%_0.02_155)]"
              )}
            >
              Sans fin
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cs-offer-reason">Motif</Label>
          <Input
            id="cs-offer-reason"
            placeholder="Offre syndic, geste commercial, facture réglée hors Stripe…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy || !changed}
            onClick={() =>
              run(
                () =>
                  setResidencePlan({
                    residenceId,
                    plan: "cs_avance",
                    until: until || undefined,
                    reason: reason.trim() || undefined,
                  }),
                grant ? "Offre mise à jour" : "Option CS avancé offerte"
              )
            }
          >
            <CalendarCheck />
            {grant ? "Mettre à jour l'offre" : "Offrir l'option"}
          </Button>
          {grant && (
            <Button type="button" variant="outline" disabled={busy} onClick={() => setConfirm("free")}>
              <Undo2 />
              Repasser en gratuit
            </Button>
          )}
        </div>
      </CardContent>
      <ConfirmActionDialog
        open={confirm === "free"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Repasser la résidence en gratuit ?"
        description="L'offre s'arrête tout de suite : les fonctions CS avancé passent en offre gratuite."
        confirmLabel="Repasser en gratuit"
        destructive
        onConfirm={() =>
          run(
            () => setResidencePlan({ residenceId, plan: "free", reason: reason.trim() || undefined }),
            "Résidence repassée en gratuit"
          )
        }
      />
    </Card>
  )
}
