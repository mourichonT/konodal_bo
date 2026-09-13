import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { setLotTantiemeForClef } from "@/lib/clesCharge"
import type { ClefCharge } from "@/types/clefCharge"
import { PRIMARY_CTA_CLASS } from "@/lib/utils"

type LotClefsChargeDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  residenceId: string
  lotId: string
  lotLabel: string
  clesCharge: ClefCharge[]
}

// Édite, pour CE lot, son tantième dans chacune des clés de charges dédiées
// de la résidence (ClefCharge.tantiemesParLot[lotId]) - le tantième général
// du lot (Lot.tantiemes) se règle lui directement dans le tableau des lots,
// pas ici. Même patron que les autres modales : contenu monté seulement
// quand ouverte, pour repartir des valeurs actuelles à chaque fois.
export function LotClefsChargeDialog({
  open,
  onOpenChange,
  residenceId,
  lotId,
  lotLabel,
  clesCharge,
}: LotClefsChargeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && (
          <LotClefsChargeDialogContent
            residenceId={residenceId}
            lotId={lotId}
            lotLabel={lotLabel}
            clesCharge={clesCharge}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function LotClefsChargeDialogContent({
  residenceId,
  lotId,
  lotLabel,
  clesCharge,
  onDone,
}: {
  residenceId: string
  lotId: string
  lotLabel: string
  clesCharge: ClefCharge[]
  onDone: () => void
}) {
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(clesCharge.map((c) => [c.id, c.tantiemesParLot[lotId] ?? 0]))
  )
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await Promise.all(
        clesCharge.map((c) => {
          const value = values[c.id] ?? 0
          // N'écrit que les clés dont la valeur a réellement changé - évite
          // une écriture Firestore par clé à chaque enregistrement même sans
          // modification.
          if (value === (c.tantiemesParLot[lotId] ?? 0)) return Promise.resolve()
          return setLotTantiemeForClef(residenceId, c.id, lotId, value)
        })
      )
      toast.success("Répartition enregistrée")
      onDone()
    } catch (err) {
      toast.error("Échec de l'enregistrement : " + (err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex max-h-[calc(100vh-3rem)] min-w-0 flex-col gap-4 p-[3px]">
      <DialogHeader className="border-b border-[oklch(95%_0.003_100)] pb-4">
        <span className="text-[11.5px] font-bold tracking-wide text-primary uppercase">Lots</span>
        <DialogTitle>Répartition des charges — {lotLabel}</DialogTitle>
      </DialogHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden pr-4 pl-[5px]">
        {clesCharge.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune clé de charges définie pour cette résidence. Ajoutez-en une dans la section "Clés de
            charges" avant de saisir une répartition.
          </p>
        ) : (
          clesCharge.map((c) => (
            <div key={c.id} className="flex flex-col gap-1.5">
              <Label>{c.nom || "(sans nom)"}</Label>
              <Input
                type="number"
                min={0}
                value={values[c.id] ?? 0}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [c.id]: Number(e.target.value) || 0 }))
                }
              />
            </div>
          ))
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Annuler
        </Button>
        <Button
          type="button"
          className={PRIMARY_CTA_CLASS}
          onClick={handleSave}
          disabled={saving || clesCharge.length === 0}
        >
          Enregistrer
        </Button>
      </DialogFooter>
    </div>
  )
}
