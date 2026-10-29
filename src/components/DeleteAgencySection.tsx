import { useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { deleteGerance, type GeranceDeletionSummary } from "@/lib/gerances"
import { cn, PANEL_CARD_CLASS } from "@/lib/utils"
import type { Gerance } from "@/types/gerance"

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count > 1 ? pluralForm : singular}`
}

// Ce qui rattache encore une résidence à l'agence, ex. « la résidence, 2 bâtiments ».
function attachmentLabel(item: GeranceDeletionSummary["attachedResidences"][number]): string {
  return [
    item.residence ? "la résidence" : "",
    item.structures ? plural(item.structures, "bâtiment", "bâtiments") : "",
    item.lots ? plural(item.lots, "lot", "lots") : "",
  ]
    .filter(Boolean)
    .join(", ")
}

// Zone de suppression de l'agence (fiche agence, superAdmin uniquement - le
// serveur revérifie le rôle). Même déroulé que DeleteResidenceSection : bilan
// demandé au serveur (dryRun), puis nom exact de l'agence. Bloquée tant
// qu'une résidence, un bâtiment ou un lot est rattaché à l'agence ;
// l'abonnement en cours, lui, est résilié immédiatement par la suppression.
export function DeleteAgencySection({ gerance }: { gerance: Gerance }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [summary, setSummary] = useState<GeranceDeletionSummary | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [confirmName, setConfirmName] = useState("")
  const [deleting, setDeleting] = useState(false)
  const name = gerance.name || "Agence"
  const blocked = !!summary && summary.attachedResidences.length > 0

  async function openDialog() {
    setOpen(true)
    setSummary(null)
    setConfirmName("")
    setLoadingSummary(true)
    try {
      setSummary(await deleteGerance(gerance.id, { dryRun: true }))
    } catch (err) {
      toast.error("Impossible de préparer la suppression : " + (err as Error).message)
      setOpen(false)
    } finally {
      setLoadingSummary(false)
    }
  }

  async function handleDelete(event: FormEvent) {
    event.preventDefault()
    if (confirmName !== name || blocked) return
    setDeleting(true)
    try {
      await deleteGerance(gerance.id, { confirmName })
      toast.success(`Agence « ${name} » supprimée`)
      navigate("/agences")
    } catch (err) {
      toast.error("Échec de la suppression : " + (err as Error).message)
      setDeleting(false)
    }
  }

  return (
    <div className={cn(PANEL_CARD_CLASS, "flex flex-col gap-2.5 border-[oklch(88%_0.05_25)] text-[12.5px]")}>
      <span className="text-[14px] font-bold text-[oklch(48%_0.17_27)]">Zone de danger</span>
      <p className="m-0 leading-normal text-muted-foreground">
        Supprime définitivement l'agence, ses comptes, son abonnement et ses réglages. Impossible tant qu'une
        résidence lui est rattachée.
      </p>
      <Button
        type="button"
        variant="outline"
        className="h-9 w-fit rounded-[10px] border-[oklch(85%_0.07_25)] bg-[oklch(98.5%_0.01_25)] px-3.5 text-[13px] font-bold text-[oklch(48%_0.17_27)] hover:bg-[oklch(96%_0.025_25)] hover:text-[oklch(42%_0.17_27)]"
        onClick={openDialog}
      >
        <Trash2 />
        Supprimer l'agence
      </Button>

      <Dialog open={open} onOpenChange={(next) => !deleting && setOpen(next)}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleDelete} className="flex max-h-[calc(100vh-3rem)] min-w-0 flex-col gap-4">
            <DialogHeader className="pb-4">
              <span className="text-[11.5px] font-bold tracking-wide text-destructive uppercase">Agence</span>
              <DialogTitle>Supprimer « {name} » ?</DialogTitle>
            </DialogHeader>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden pr-4 pl-[5px]">
              {loadingSummary || !summary ? (
                <p className="text-sm text-muted-foreground">Calcul de ce qui sera supprimé…</p>
              ) : blocked ? (
                <>
                  <p className="text-sm text-destructive">
                    Cette agence est encore rattachée à{" "}
                    {summary.attachedResidences.length === 1
                      ? "une résidence"
                      : `${summary.attachedResidences.length} résidences`}
                    . Détachez-la ou rattachez un autre syndic depuis la fiche de la résidence, puis recommencez :
                  </p>
                  <ul className="list-disc pl-5 text-sm">
                    {summary.attachedResidences.map((item) => (
                      <li key={item.id}>
                        <Link
                          to={`/residences/${item.id}`}
                          className="font-semibold underline-offset-2 hover:underline"
                        >
                          {item.name || item.id}
                        </Link>{" "}
                        <span className="text-muted-foreground">({attachmentLabel(item)})</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">Cette action est irréversible :</p>
                  <ul className="list-disc pl-5 text-sm">
                    <li>
                      {summary.subscriptionActive
                        ? "l'abonnement est résilié immédiatement, sans attendre la fin de la période payée"
                        : "aucun abonnement en cours"}
                    </li>
                    <li>
                      {summary.accountsDeleted + summary.accountsKept === 0
                        ? "aucun compte agence ou agent"
                        : `${plural(summary.accountsDeleted, "compte supprimé", "comptes supprimés")}${
                            summary.accountsKept
                              ? `, ${plural(summary.accountsKept, "compte conservé", "comptes conservés")} (utilisé ailleurs, perd seulement l'accès à l'agence)`
                              : ""
                          }`}
                    </li>
                    {summary.contacts > 0 && (
                      <li>{plural(summary.contacts, "contact détaché", "contacts détachés")} de l'agence</li>
                    )}
                    {summary.pendingInvitations > 0 && (
                      <li>
                        {plural(summary.pendingInvitations, "invitation annulée", "invitations annulées")}
                      </li>
                    )}
                    <li>la fiche, les réglages de Nodo et l'historique de facturation de l'agence</li>
                  </ul>
                  <div className="flex flex-col gap-1.5">
                    {/* Un seul bloc dans le Label : il est en flex, la phrase et le
                        nom en gras se coupaient sinon chacun de leur côté. */}
                    <Label htmlFor="delete-agency-name">
                      <span className="leading-snug">
                        Pour confirmer, saisissez le nom de l'agence : <strong>{name}</strong>
                      </span>
                    </Label>
                    <Input
                      id="delete-agency-name"
                      value={confirmName}
                      autoComplete="off"
                      onChange={(e) => setConfirmName(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" disabled={deleting} onClick={() => setOpen(false)}>
                {blocked ? "Fermer" : "Annuler"}
              </Button>
              {!blocked && (
                <Button
                  type="submit"
                  variant="destructive"
                  className="bg-destructive text-white hover:bg-destructive/90"
                  disabled={deleting || !summary || confirmName !== name}
                >
                  <Trash2 />
                  {deleting ? "Suppression…" : "Supprimer définitivement"}
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
