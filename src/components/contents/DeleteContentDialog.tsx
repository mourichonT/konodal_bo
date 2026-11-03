import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { moderateContent, type ModerationTargetRef } from "@/lib/moderation"

// Suppression par la modération (pages Contenus) : le motif est montré à
// l'auteur dans sa notification ; le serveur archive puis supprime
// (moderate_content, moderation.py).
export function DeleteContentDialog({
  target,
  targetLabel,
  defaultReason = "",
  onOpenChange,
  onDeleted,
}: {
  // null : fenêtre fermée.
  target: ModerationTargetRef | null
  targetLabel: string
  defaultReason?: string
  onOpenChange: (open: boolean) => void
  onDeleted?: () => void
}) {
  const [reason, setReason] = useState("")
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (target) setReason(defaultReason)
  }, [target, defaultReason])

  async function handleDelete() {
    if (!target) return
    setRunning(true)
    try {
      await moderateContent(target, "delete", reason.trim())
      toast.success(`${targetLabel} supprimé(e), l'auteur est prévenu`)
      onOpenChange(false)
      onDeleted?.()
    } catch (err) {
      toast.error("Suppression impossible : " + (err as Error).message)
    } finally {
      setRunning(false)
    }
  }

  return (
    <Dialog open={!!target} onOpenChange={(next) => !running && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <div className="flex max-h-[calc(100vh-3rem)] min-w-0 flex-col gap-4">
          <DialogHeader className="border-b border-[oklch(95%_0.003_100)] pb-4">
            <span className="text-[11.5px] font-bold tracking-wide text-destructive uppercase">Modération</span>
            <DialogTitle>Supprimer : {targetLabel.toLowerCase()}</DialogTitle>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden pr-4 pl-[5px] text-sm">
            <p className="text-muted-foreground">
              Le contenu est archivé puis retiré de l'app, avec ses commentaires et réponses. Son auteur reçoit une
              notification avec le motif ci-dessous.
            </p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="moderation-reason">Motif communiqué à l'auteur</Label>
              <textarea
                id="moderation-reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex. : propos insultants envers un voisin"
                className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={running} onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={running || !reason.trim()}
              onClick={handleDelete}
            >
              <Trash2 />
              {running ? "…" : "Supprimer"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
