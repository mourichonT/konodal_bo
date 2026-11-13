import { useState } from "react"
import { toast } from "sonner"
import { BellOff, BellRing, ImageIcon, Link2, Pencil, Trash2, Video } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { deleteKonodalNews, publishKonodalNews, unpublishKonodalNews, type KonodalNews } from "@/lib/konodalNews"

function formatDateTime(date: Date | null): string {
  return date ? date.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—"
}

// Communication > Chat Konodal (superAdmin) : messages de la conversation
// officielle « Konodal » de l'app, vue par tous les comptes, sans réponse.
// Données et formulaire tenus par CommunicationsPage (la vue ne se recharge
// pas quand on bascule avec le fil d'actualité).
export function KonodalNewsView({
  news,
  loading,
  error,
  onEdit,
}: {
  news: KonodalNews[]
  loading: boolean
  error: string | null
  onEdit: (item: KonodalNews) => void
}) {
  const [deleting, setDeleting] = useState<KonodalNews | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function togglePublished(item: KonodalNews) {
    setBusyId(item.id)
    try {
      if (item.published) {
        await unpublishKonodalNews(item)
        toast.success("Message retiré de la conversation")
      } else {
        await publishKonodalNews(item)
        toast.success("Message republié")
      }
    } catch (err) {
      toast.error("Échec : " + (err as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-[720px] text-[13.5px] text-muted-foreground">
        Conversation officielle « Konodal » dans la messagerie de l'app : chaque message publié est visible par tous
        les comptes, en lecture seule. Les résidents ne peuvent pas y répondre.
      </p>

      <div className="overflow-hidden rounded-[24px] border border-[oklch(93%_0.005_100)] bg-white shadow-[0_1px_2px_oklch(20%_0_0/0.03),0_14px_34px_-22px_oklch(20%_0_0/0.12)]">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead>Message</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Publié le</TableHead>
              <TableHead>Notification</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="bg-white">
            {news.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="max-w-md">
                  <div className="flex items-center gap-1.5 font-medium">
                    <span className="truncate">{item.title || "Sans titre"}</span>
                    {item.pathImage &&
                      (item.isVideo ? (
                        <Video className="size-3.5 shrink-0 text-muted-foreground" aria-label="Avec vidéo" />
                      ) : (
                        <ImageIcon className="size-3.5 shrink-0 text-muted-foreground" aria-label="Avec photo" />
                      ))}
                    {item.ctaLabel && item.ctaUrl && (
                      <Link2 className="size-3.5 shrink-0 text-muted-foreground" aria-label="Avec bouton" />
                    )}
                  </div>
                  <p className="truncate text-sm text-muted-foreground">{item.body}</p>
                </TableCell>
                <TableCell>
                  {item.published ? (
                    <Badge className="border-transparent bg-[oklch(93%_0.05_150)] text-[oklch(38%_0.09_155)]">
                      Publié
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-transparent bg-muted text-muted-foreground">
                      {item.publishedAt ? "Retiré" : "Brouillon"}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {item.published ? formatDateTime(item.publishedAt) : "—"}
                </TableCell>
                <TableCell>
                  <PushStatus item={item} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => onEdit(item)}>
                      <Pencil />
                      Modifier
                    </Button>
                    {item.publishedAt && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId === item.id}
                        onClick={() => togglePublished(item)}
                      >
                        {item.published ? "Retirer" : "Republier"}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setDeleting(item)}
                      aria-label="Supprimer"
                      title="Supprimer"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!loading && news.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  {error ? `Lecture impossible : ${error}` : "Aucun message pour l'instant."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <DeleteDialog item={deleting} onClose={() => setDeleting(null)} />
    </div>
  )
}

function PushStatus({ item }: { item: KonodalNews }) {
  if (!item.sendPush) {
    return (
      <span className="flex items-center gap-1 text-sm text-muted-foreground">
        <BellOff className="size-3.5" />
        Sans notification
      </span>
    )
  }
  if (item.pushSentAt) {
    return (
      <div className="flex flex-col text-sm">
        <span className="flex items-center gap-1">
          <BellRing className="size-3.5 text-primary" />
          Envoyée le {formatDateTime(item.pushSentAt)}
        </span>
        {item.pushStats && (
          <span className="text-xs text-muted-foreground">
            {item.pushStats.sent} envoyée{item.pushStats.sent > 1 ? "s" : ""}
            {item.pushStats.failed > 0 ? `, ${item.pushStats.failed} en échec` : ""}
          </span>
        )}
      </div>
    )
  }
  return (
    <span className="flex items-center gap-1 text-sm text-muted-foreground">
      <BellRing className="size-3.5" />
      {item.published ? "En cours d'envoi" : "À la publication"}
    </span>
  )
}

function DeleteDialog({ item, onClose }: { item: KonodalNews | null; onClose: () => void }) {
  const [busy, setBusy] = useState(false)

  async function handleDelete() {
    if (!item) return
    setBusy(true)
    try {
      await deleteKonodalNews(item)
      toast.success("Message supprimé")
      onClose()
    } catch (err) {
      toast.error("Échec de la suppression : " + (err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="pb-4">
          <DialogTitle>Supprimer ce message ?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          « {item?.title || "Sans titre"} »
          {item?.published ? " disparaît de la conversation Konodal de tous les comptes." : " est supprimé."}
          {item?.pathImage ? " Son média est supprimé aussi." : ""} Cette action est définitive.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Garder
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={busy}>
            Supprimer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
