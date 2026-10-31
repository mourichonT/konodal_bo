import { useEffect, useMemo, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { Unlink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { SearchableSelect } from "@/components/SearchableSelect"
import { detachLot, linkLot, subscribeToLots } from "@/lib/lots"
import { resolveUserLabels } from "@/lib/users"
import { cn, PRIMARY_CTA_CLASS } from "@/lib/utils"
import type { Lot } from "@/types/lot"

const label = (lot: Pick<Lot, "batiment" | "lot" | "refLot">) =>
  `${lot.batiment}${lot.lot ? ` — ${lot.lot}` : ""}${lot.refLot ? ` · Réf. ${lot.refLot}` : ""}`

// Détacher un lot dépendant (parking, cave…) rattaché à tort (superAdmin) :
// soit le laisser libre (detachLot : propriétaires et locataires hérités
// retirés), soit le rattacher à un autre lot principal (linkLot :
// sync_lot_tenants lui donne alors le propriétaire de ce lot). Propositions :
// les lots principaux qui n'ont encore aucune dépendance du même type (ex. un
// appartement sans place de parking), ceux qui ont un propriétaire d'abord -
// comme les appartements laissés sans place par la feuille de présence.
export function DetachLotDialog({
  residenceId,
  lotId,
  open,
  onOpenChange,
  onDone,
}: {
  residenceId: string
  lotId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  // Après un détachement réussi (liste à relire chez l'appelant).
  onDone?: () => void
}) {
  const [lots, setLots] = useState<Lot[]>([])
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const [mode, setMode] = useState<"free" | "attach">("free")
  const [target, setTarget] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setMode("free")
    setTarget("")
    return subscribeToLots(residenceId, setLots, (err) => toast.error("Lots illisibles : " + err.message))
  }, [open, residenceId])

  const lot = lots.find((l) => l.id === lotId)
  const parent = lot?.parentLotId ? lots.find((l) => l.id === lot.parentLotId) : undefined
  const candidates = useMemo(
    () => lots.filter((l) => l.id !== lotId && l.id !== lot?.parentLotId && !l.isLinkable && !l.parentLotId),
    [lots, lotId, lot?.parentLotId]
  )
  const suggestions = useMemo(() => {
    if (!lot) return []
    const withSameType = new Set(
      lots.filter((l) => l.parentLotId && l.id !== lotId && l.typeLot === lot.typeLot).map((l) => l.parentLotId)
    )
    return candidates
      .filter((c) => !withSameType.has(c.id))
      .sort((a, b) => Number(b.idProprietaire.length > 0) - Number(a.idProprietaire.length > 0))
      .slice(0, 6)
  }, [candidates, lots, lot, lotId])

  const uidsKey = [...new Set([...(lot?.idProprietaire ?? []), ...suggestions.flatMap((s) => s.idProprietaire),
    ...candidates.find((c) => c.id === target)?.idProprietaire ?? []])].sort().join(",")
  useEffect(() => {
    if (!uidsKey) return
    resolveUserLabels(uidsKey.split(",")).then(setNames).catch(() => {})
  }, [uidsKey])
  const owners = (uids: string[]) => uids.map((uid) => names.get(uid) ?? "…").join(", ")

  const targetLot = candidates.find((c) => c.id === target)
  const inherited = lot && parent ? lot.idProprietaire.filter((uid) => parent.idProprietaire.includes(uid)) : []

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (mode === "attach" && !targetLot) return
    setSaving(true)
    try {
      if (mode === "free") await detachLot(residenceId, lotId)
      else await linkLot(residenceId, lotId, target)
      toast.success(mode === "free" ? "Lot détaché et libéré" : `Lot rattaché à ${targetLot ? label(targetLot) : ""}`)
      onOpenChange(false)
      onDone?.()
    } catch (err) {
      toast.error("Échec : " + (err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const choiceClass = (active: boolean) =>
    cn(
      "flex cursor-pointer items-start gap-2.5 rounded-[12px] border p-3 text-sm",
      active ? "border-primary bg-primary/5" : "border-input hover:bg-muted/50"
    )

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="flex max-h-[calc(100vh-3rem)] min-w-0 flex-col gap-4">
          <DialogHeader className="pb-4">
            <DialogTitle>Détacher {lot ? label(lot) : "ce lot"}</DialogTitle>
            <DialogDescription>
              {parent ? `Rattaché aujourd'hui à ${label(parent)}` : "Rattaché aujourd'hui à un autre lot"}
              {inherited.length ? `, avec pour propriétaire ${owners(inherited)}.` : "."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden pr-4 pl-[5px]">
            <label className={choiceClass(mode === "free")}>
              <input type="radio" className="mt-0.5" checked={mode === "free"} onChange={() => setMode("free")} />
              <span>
                <span className="font-semibold">Laisser le lot libre</span>
                <span className="block text-xs text-muted-foreground">
                  Les propriétaires et locataires hérités en sont retirés. Son propriétaire pourra le demander dans
                  l'app, ou être ajouté depuis la fiche du lot.
                </span>
              </span>
            </label>

            <label className={choiceClass(mode === "attach")}>
              <input type="radio" className="mt-0.5" checked={mode === "attach"} onChange={() => setMode("attach")} />
              <span>
                <span className="font-semibold">Le rattacher à un autre lot</span>
                <span className="block text-xs text-muted-foreground">
                  Il prend le propriétaire (et le locataire) du lot choisi.
                </span>
              </span>
            </label>

            {mode === "attach" && (
              <div className="flex min-w-0 flex-col gap-2">
                {suggestions.length > 0 && (
                  <>
                    <span className="text-xs font-semibold text-muted-foreground">
                      Propositions : lots sans {lot?.typeLot ? lot.typeLot.toLowerCase() : "dépendance de ce type"}
                    </span>
                    {suggestions.map((s) => (
                      <label key={s.id} className={choiceClass(target === s.id)}>
                        <input
                          type="radio"
                          className="mt-0.5"
                          checked={target === s.id}
                          onChange={() => setTarget(s.id)}
                        />
                        <span>
                          {label(s)}
                          <span className="block text-xs text-muted-foreground">
                            {s.idProprietaire.length ? owners(s.idProprietaire) : "Sans propriétaire"}
                          </span>
                        </span>
                      </label>
                    ))}
                  </>
                )}
                <span className="text-xs font-semibold text-muted-foreground">Ou un autre lot de la résidence</span>
                <SearchableSelect
                  value={target}
                  onChange={setTarget}
                  emptyLabel="Choisir un lot…"
                  groups={[{ options: candidates.map((c) => ({ value: c.id, label: label(c) })) }]}
                />
                {targetLot && (
                  <p className="text-xs text-muted-foreground">
                    Nouveau propriétaire : {targetLot.idProprietaire.length ? owners(targetLot.idProprietaire) : "aucun"}
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={saving || !lot || (mode === "attach" && !targetLot)}
              className={PRIMARY_CTA_CLASS}
            >
              <Unlink />
              {mode === "free" ? "Détacher et libérer" : "Rattacher"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
