import { useState } from "react"
import { toast } from "sonner"
import { DateInput } from "@/components/DateInput"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { setLicenceTrialEnd } from "@/lib/billing"
import { PRIMARY_CTA_CLASS } from "@/lib/utils"

const DAY_MS = 86_400_000
// Limite de Stripe : 2 ans à partir d'aujourd'hui. Un jour de marge, le
// serveur plaçant la fin d'essai à midi UTC.
const MAX_DAYS = 729

function isoDay(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function frenchDay(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("fr-FR")
}

// Prolonger l'essai d'une agence (superAdmin, admin_set_licence_trial_end) :
// nouvelle date après la fin actuelle, 2 ans au plus, sans facture ni
// prorata. Proposée par défaut : un an de plus.
export function LicenceTrialDialog({
  geranceId,
  trialEnd,
  className,
}: {
  geranceId: string
  trialEnd: Date | null
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState("")
  const [busy, setBusy] = useState(false)

  const now = Date.now()
  const min = isoDay(new Date(Math.max(now, trialEnd?.getTime() ?? 0) + DAY_MS))
  const max = isoDay(new Date(now + MAX_DAYS * DAY_MS))
  const valid = value >= min && value <= max

  function openDialog() {
    const next = new Date(Math.max(now, trialEnd?.getTime() ?? 0))
    next.setFullYear(next.getFullYear() + 1)
    setValue(isoDay(new Date(Math.min(next.getTime(), now + MAX_DAYS * DAY_MS))))
    setOpen(true)
  }

  async function submit() {
    setBusy(true)
    try {
      await setLicenceTrialEnd(geranceId, value)
      toast.success(`Essai prolongé jusqu'au ${frenchDay(value)}`)
      setOpen(false)
    } catch (err) {
      toast.error("Prolongation impossible : " + (err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={openDialog}>
        Prolonger l'essai
      </button>
      <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <DialogContent className="sm:max-w-md">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
            className="flex max-h-[calc(100vh-3rem)] min-w-0 flex-col gap-4"
          >
            <DialogHeader className="pb-4">
              <DialogTitle>Prolonger l'essai</DialogTitle>
            </DialogHeader>
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden pr-4 pl-[5px]">
              <div className="flex flex-col gap-2">
                <Label>Nouvelle fin d'essai</Label>
                <DateInput value={value} onChange={setValue} min={min} max={max} className="h-10 w-40 rounded-[10px]" />
                {trialEnd && (
                  <span className="text-xs text-muted-foreground">
                    Fin actuelle : {trialEnd.toLocaleDateString("fr-FR")}
                  </span>
                )}
              </div>
              {min > max ? (
                <p className="m-0 rounded-[10px] bg-amber-50 p-2.5 text-sm text-amber-900">
                  L'essai finit déjà à la limite de Stripe (2 ans à partir d'aujourd'hui).
                </p>
              ) : (
                value &&
                !valid && (
                  <p className="m-0 text-sm text-destructive">
                    Choisissez une date entre le {frenchDay(min)} et le {frenchDay(max)}.
                  </p>
                )
              )}
              <DialogDescription>
                Rien n'est facturé avant cette date, sans prorata. À la fin de l'essai, Stripe émet la première facture ;
                sans moyen de paiement, l'abonnement se met en pause.
              </DialogDescription>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={busy || !valid} className={PRIMARY_CTA_CLASS}>
                {busy ? "Enregistrement…" : "Prolonger"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
