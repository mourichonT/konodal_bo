import { useState, type FormEvent } from "react"
import { toast } from "sonner"
import { Gift, TicketPercent, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { applyCsDiscount, removeCsDiscount, type CsBillingAdmin } from "@/lib/csAvance"
import { ConfirmActionDialog } from "./ConfirmActionDialog"
import { formatDate } from "./format"

const OFFERED_MONTHS = [3, 6, 12, 24]

// Code promo ou mois offerts : appliqués à l'abonnement en cours, ou
// réservés à la résidence pour sa souscription (le code ne sert alors
// qu'à elle).
export function DiscountCard({
  residenceId,
  data,
  onChanged,
}: {
  residenceId: string
  data: CsBillingAdmin
  onChanged: () => Promise<void>
}) {
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<{ months: number } | "remove" | null>(null)
  const subscribed = data.subscription?.subscribed ?? false
  const current = data.discount ?? data.reservedDiscount

  async function apply(discount: { code: string } | { months: number }) {
    setBusy(true)
    try {
      const { applied } = await applyCsDiscount(residenceId, discount)
      toast.success(applied === "subscription" ? "Remise appliquée à l'abonnement" : "Remise réservée pour la souscription")
      setCode("")
      await onChanged()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function submitCode(event: FormEvent) {
    event.preventDefault()
    if (code.trim()) await apply({ code: code.trim() })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Remise et code promo</CardTitle>
        <CardDescription>
          {subscribed
            ? "S'applique tout de suite à l'abonnement en cours et remplace sa remise actuelle."
            : "Réservée à cette résidence : appliquée d'office à sa souscription, en ligne ou sur facture."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        {current ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[oklch(96%_0.02_155)] px-3 py-2.5">
            <div className="flex flex-col">
              <span className="font-semibold">
                {data.discount
                  ? `${data.discount.label ?? data.discount.name ?? "Remise"}${data.discount.code ? ` · code ${data.discount.code}` : ""}`
                  : `${data.reservedDiscount?.label ?? "Remise"} · réservée`}
              </span>
              <span className="text-xs text-muted-foreground">
                {data.discount
                  ? data.discount.end
                    ? `Du ${formatDate(data.discount.start)} au ${formatDate(data.discount.end)}`
                    : `Depuis le ${formatDate(data.discount.start)}`
                  : `Ajoutée le ${formatDate(data.reservedDiscount?.at)}${
                      data.reservedDiscount?.byName ? ` par ${data.reservedDiscount.byName}` : ""
                    }`}
              </span>
            </div>
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setConfirm("remove")}>
              <Trash2 />
              Retirer
            </Button>
          </div>
        ) : (
          <p className="text-muted-foreground">Aucune remise.</p>
        )}

        <form onSubmit={submitCode} className="flex flex-wrap items-end gap-2">
          <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
            <Label htmlFor="cs-promo-code">Code promo Stripe</Label>
            <Input
              id="cs-promo-code"
              placeholder="OFFERT12MOIS"
              value={code}
              autoComplete="off"
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
          </div>
          <Button type="submit" variant="outline" disabled={busy || !code.trim()}>
            <TicketPercent />
            Appliquer
          </Button>
        </form>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Offrir des mois (100 %)</span>
          <div className="flex flex-wrap gap-2">
            {OFFERED_MONTHS.map((months) => (
              <Button
                key={months}
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => setConfirm({ months })}
              >
                <Gift />
                {months} mois
              </Button>
            ))}
          </div>
          {data.subscription?.status === "trialing" && (
            <span className="text-xs text-muted-foreground">
              Pendant la période offerte, les mois de remise s'écoulent déjà : pour décaler le premier paiement,
              déplacez plutôt la fin de la période offerte.
            </span>
          )}
        </div>
      </CardContent>

      <ConfirmActionDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm === "remove" ? "Retirer la remise ?" : `Offrir ${typeof confirm === "object" && confirm ? confirm.months : ""} mois ?`}
        description={
          confirm === "remove"
            ? subscribed
              ? "Les prochaines factures seront au plein tarif."
              : "La souscription de la résidence se fera au plein tarif, sauf code saisi sur la page de paiement."
            : subscribed
              ? "Remise de 100 % sur l'option CS avancé à partir d'aujourd'hui, à la place de la remise actuelle."
              : "Remise de 100 % réservée à cette résidence, appliquée d'office à sa souscription."
        }
        confirmLabel={confirm === "remove" ? "Retirer" : "Offrir"}
        destructive={confirm === "remove"}
        onConfirm={async () => {
          if (confirm === "remove") {
            setBusy(true)
            try {
              await removeCsDiscount(residenceId)
              toast.success("Remise retirée")
              await onChanged()
            } catch (err) {
              toast.error((err as Error).message)
            } finally {
              setBusy(false)
            }
          } else if (confirm) {
            await apply({ months: confirm.months })
          }
        }}
      />
    </Card>
  )
}
