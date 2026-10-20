import { useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { deleteResidence, type ResidenceDeletionSummary } from "@/lib/residences"
import type { Residence } from "@/types/residence"

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count > 1 ? pluralForm : singular}`
}

// Zone de suppression de la résidence (onglet Information, superAdmin
// uniquement - le serveur revérifie le rôle). La fenêtre demande d'abord le
// bilan au serveur (dryRun), puis le nom exact de la résidence avant de
// lancer la suppression ; bloquée tant qu'un abonnement CS avancé est en
// cours (le serveur refuse aussi).
export function DeleteResidenceSection({ residence }: { residence: Residence }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [summary, setSummary] = useState<ResidenceDeletionSummary | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [confirmName, setConfirmName] = useState("")
  const [deleting, setDeleting] = useState(false)

  async function openDialog() {
    setOpen(true)
    setSummary(null)
    setConfirmName("")
    setLoadingSummary(true)
    try {
      setSummary(await deleteResidence(residence.id, { dryRun: true }))
    } catch (err) {
      toast.error("Impossible de préparer la suppression : " + (err as Error).message)
      setOpen(false)
    } finally {
      setLoadingSummary(false)
    }
  }

  async function handleDelete(event: FormEvent) {
    event.preventDefault()
    if (confirmName !== residence.name || summary?.subscribed) return
    setDeleting(true)
    try {
      await deleteResidence(residence.id, { confirmName })
      toast.success(`Résidence « ${residence.name} » supprimée`)
      navigate("/residences")
    } catch (err) {
      toast.error("Échec de la suppression : " + (err as Error).message)
      setDeleting(false)
    }
  }

  return (
    <Card className="ring-destructive/30">
      <CardHeader>
        <CardTitle className="text-destructive">Supprimer la résidence</CardTitle>
        <CardDescription>
          Supprime définitivement la résidence, ses lots, publications, votes, messages et documents. Les
          résidents rattachés perdent leur accès.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant="destructive"
          className="w-fit bg-destructive text-white hover:bg-destructive/90"
          onClick={openDialog}
        >
          <Trash2 />
          Supprimer la résidence
        </Button>
      </CardContent>

      <Dialog open={open} onOpenChange={(next) => !deleting && setOpen(next)}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleDelete} className="flex max-h-[calc(100vh-3rem)] min-w-0 flex-col gap-4">
            <DialogHeader className="pb-4">
              <span className="text-[11.5px] font-bold tracking-wide text-destructive uppercase">Résidence</span>
              <DialogTitle>Supprimer « {residence.name} » ?</DialogTitle>
            </DialogHeader>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden pr-4 pl-[5px]">
              {loadingSummary || !summary ? (
                <p className="text-sm text-muted-foreground">Calcul de ce qui sera supprimé…</p>
              ) : summary.subscribed ? (
                <p className="text-sm text-destructive">
                  Un abonnement CS avancé est en cours sur cette résidence. Résiliez-le avant de la supprimer :
                  sans la résidence, plus rien ne permettrait de l'arrêter.
                </p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">Cette action est irréversible. Seront supprimés :</p>
                  <ul className="list-disc pl-5 text-sm">
                    <li>{plural(summary.lots, "lot", "lots")}</li>
                    <li>{plural(summary.posts, "publication", "publications")}</li>
                    <li>{plural(summary.votes, "vote", "votes")}</li>
                    <li>{plural(summary.documents, "document", "documents")} de la copropriété</li>
                    <li>les messages, la charte, les mails et les fichiers de la résidence</li>
                  </ul>
                  <p className="text-sm text-muted-foreground">
                    {summary.accounts === 0
                      ? "Aucun compte n'est rattaché à cette résidence."
                      : `${plural(summary.accounts, "compte perd", "comptes perdent")} l'accès à la résidence (${plural(
                          summary.residents,
                          "résident",
                          "résidents"
                        )} sur un lot, ${plural(summary.csMembers, "membre", "membres")} du conseil syndical).${
                          summary.residents > 0 ? " Les lots des résidents sont archivés dans leur historique." : ""
                        }`}
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {/* Un seul bloc dans le Label : il est en flex, la phrase et le
                        nom en gras se coupaient sinon chacun de leur côté. */}
                    <Label htmlFor="delete-residence-name">
                      <span className="leading-snug">
                        Pour confirmer, saisissez le nom de la résidence : <strong>{residence.name}</strong>
                      </span>
                    </Label>
                    <Input
                      id="delete-residence-name"
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
                Annuler
              </Button>
              <Button
                type="submit"
                variant="destructive"
                className="bg-destructive text-white hover:bg-destructive/90"
                disabled={deleting || !summary || summary.subscribed || confirmName !== residence.name}
              >
                <Trash2 />
                {deleting ? "Suppression…" : "Supprimer définitivement"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
