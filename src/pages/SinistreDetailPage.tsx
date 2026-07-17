import { useEffect, useState } from "react"
import { Link, useLocation, useParams } from "react-router-dom"
import { doc, getDoc } from "firebase/firestore"
import { toast } from "sonner"
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Send,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SinistreMediaViewer } from "@/components/SinistreMediaViewer"
import { SinistrePriorityIcon } from "@/components/SinistrePriorityIcon"
import { db } from "@/firebase"
import { useAuth } from "@/lib/auth-context"
import {
  addPostComment,
  addPostCommentReply,
  deletePostComment,
  subscribeToPostComments,
  type PostComment,
} from "@/lib/comments"
import {
  fetchSinistreReportPdf,
  subscribeToSinistre,
  subscribeToSinistreSignalements,
  updateSinistreArchived,
  updateSinistrePriority,
  updateSinistreStatut,
} from "@/lib/sinistres"
import { subscribeToUser, subscribeToUserLots, type UserLot } from "@/lib/users"
import { cn } from "@/lib/utils"
import { useAllSinistres } from "@/hooks/useAllSinistres"
import {
  SINISTRE_PRIORITIES,
  SINISTRE_STATUSES,
  sinistrePriorityLabels,
  sinistreStatusDotClass,
  sinistreStatusTextClass,
  sinistreStatusLabels,
  type SinistrePriority,
  type SinistreStatus,
} from "@/types/sinistre"
import type { Sinistre } from "@/types/sinistre"
import type { KonodalUser } from "@/types/user"

export default function SinistreDetailPage() {
  const { residenceId, postId } = useParams<{ residenceId: string; postId: string }>()
  const location = useLocation()
  const backTo = `/sinistres/${(location.state as { from?: string } | null)?.from === "kanban" ? "kanban" : "liste"}`
  const { user } = useAuth()
  const [sinistre, setSinistre] = useState<Sinistre | null>(null)
  const [loading, setLoading] = useState(true)
  const [signalements, setSignalements] = useState<Sinistre[]>([])
  const [updating, setUpdating] = useState(false)
  const [updatingPriority, setUpdatingPriority] = useState(false)
  const [updatingArchived, setUpdatingArchived] = useState(false)
  const [residenceName, setResidenceName] = useState<string | null>(null)
  const [comments, setComments] = useState<PostComment[]>([])
  const [authorNames, setAuthorNames] = useState<Record<string, string>>({})
  const [commentText, setCommentText] = useState("")
  const [replyingTo, setReplyingTo] = useState<{ docId: string; fieldId: string; label: string } | null>(
    null
  )
  const [submittingComment, setSubmittingComment] = useState(false)
  const [mediaIndex, setMediaIndex] = useState(0)
  const [exportingPdf, setExportingPdf] = useState(false)

  const { sinistres: allSinistres } = useAllSinistres((message) => toast.error(message))

  useEffect(() => {
    if (!residenceId || !postId) return
    setLoading(true)
    return subscribeToSinistre(
      residenceId,
      postId,
      (data) => {
        setSinistre(data)
        setLoading(false)
      },
      (error) => {
        toast.error("Impossible de charger le sinistre : " + error.message)
        setLoading(false)
      }
    )
  }, [residenceId, postId])

  useEffect(() => {
    if (!residenceId) return
    getDoc(doc(db, "residences", residenceId)).then((snap) => {
      setResidenceName(snap.exists() ? ((snap.data().name as string) ?? null) : null)
    })
  }, [residenceId])

  useEffect(() => {
    if (!residenceId || !postId) return
    return subscribeToSinistreSignalements(
      residenceId,
      postId,
      (data) => setSignalements(data),
      (error) => toast.error("Impossible de charger les déclarations associées : " + error.message)
    )
  }, [residenceId, postId])

  useEffect(() => {
    if (!residenceId || !postId) return
    return subscribeToPostComments(
      residenceId,
      postId,
      setComments,
      (error) => toast.error("Impossible de charger les commentaires : " + error.message)
    )
  }, [residenceId, postId])

  useEffect(() => {
    const uids = new Set<string>()
    for (const c of comments) {
      uids.add(c.user)
      for (const r of c.replies) uids.add(r.user)
    }
    const missing = [...uids].filter((uid) => uid !== user?.uid && !(uid in authorNames))
    if (missing.length === 0) return
    missing.forEach((uid) => {
      getDoc(doc(db, "users", uid)).then((snap) => {
        if (!snap.exists()) return
        const data = snap.data()
        const userGroup = (data.user as Record<string, unknown>) ?? {}
        const name = [userGroup.surname, userGroup.name].filter(Boolean).join(" ")
        setAuthorNames((prev) => ({ ...prev, [uid]: name || uid }))
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comments, user?.uid])

  function authorLabel(uid: string) {
    if (uid === user?.uid) return "Vous"
    return authorNames[uid] ?? uid
  }

  async function handleSubmitComment() {
    if (!residenceId || !postId || !user || !commentText.trim()) return
    setSubmittingComment(true)
    try {
      if (replyingTo) {
        await addPostCommentReply(residenceId, postId, replyingTo, user.uid, commentText.trim())
      } else {
        await addPostComment(residenceId, postId, user.uid, commentText.trim())
      }
      setCommentText("")
      setReplyingTo(null)
    } catch (err) {
      toast.error("Échec de l'envoi du commentaire : " + (err as Error).message)
    } finally {
      setSubmittingComment(false)
    }
  }

  async function handleDeleteComment(segments: string[]) {
    if (!residenceId || !postId) return
    try {
      await deletePostComment(residenceId, postId, segments)
    } catch (err) {
      toast.error("Échec de la suppression du commentaire : " + (err as Error).message)
    }
  }

  if (!residenceId || !postId) return null

  const currentIndex = allSinistres.findIndex(
    (s) => s.residenceId === residenceId && s.id === postId
  )
  const previous = currentIndex > 0 ? allSinistres[currentIndex - 1] : null
  const next =
    currentIndex >= 0 && currentIndex < allSinistres.length - 1 ? allSinistres[currentIndex + 1] : null

  async function handleStatusChange(statut: SinistreStatus) {
    if (!residenceId || !postId) return
    setUpdating(true)
    try {
      await updateSinistreStatut(residenceId, postId, statut)
      toast.success("Statut mis à jour")
    } catch (err) {
      toast.error("Échec de la mise à jour : " + (err as Error).message)
    } finally {
      setUpdating(false)
    }
  }

  async function handlePriorityChange(priority: SinistrePriority) {
    if (!residenceId || !postId) return
    setUpdatingPriority(true)
    try {
      await updateSinistrePriority(residenceId, postId, priority)
      toast.success("Priorité mise à jour")
    } catch (err) {
      toast.error("Échec de la mise à jour : " + (err as Error).message)
    } finally {
      setUpdatingPriority(false)
    }
  }

  async function handleToggleArchived() {
    if (!residenceId || !postId || !sinistre) return
    setUpdatingArchived(true)
    try {
      await updateSinistreArchived(residenceId, postId, !sinistre.archived)
      toast.success(sinistre.archived ? "Ticket désarchivé" : "Ticket archivé")
    } catch (err) {
      toast.error("Échec de l'archivage : " + (err as Error).message)
    } finally {
      setUpdatingArchived(false)
    }
  }

  async function handleExportPdf() {
    if (!residenceId || !postId) return
    setExportingPdf(true)
    try {
      const blob = await fetchSinistreReportPdf(residenceId, postId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `rapport_signalements_${postId}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error("Échec de l'export PDF : " + (err as Error).message)
    } finally {
      setExportingPdf(false)
    }
  }

  const mediaItems = sinistre
    ? [
        { key: sinistre.id, pathImage: sinistre.pathImage, label: "Déclaration principale" },
        ...signalements.map((s, i) => ({
          key: s.id,
          pathImage: s.pathImage,
          label: `Déclaration ${i + 2}`,
        })),
      ]
    : []
  const activeMediaIndex = Math.min(mediaIndex, Math.max(mediaItems.length - 1, 0))

  return (
    <div className="-mt-[20px] flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <Link
            to={backTo}
            className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Sinistres
          </Link>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!previous}
              render={
                previous ? (
                  <Link to={`/sinistres/${previous.residenceId}/${previous.id}`} state={location.state} />
                ) : undefined
              }
            >
              <ChevronLeft />
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!next}
              render={
                next ? (
                  <Link to={`/sinistres/${next.residenceId}/${next.id}`} state={location.state} />
                ) : undefined
              }
            >
              Suivant
              <ChevronRight />
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">
            {sinistre ? sinistre.title || "Sans titre" : loading ? "…" : "Sinistre introuvable"}
          </h1>
          {sinistre && (
            <Button variant="outline" size="sm" disabled={exportingPdf} onClick={handleExportPdf}>
              <FileDown />
              Exporter en PDF
            </Button>
          )}
        </div>
      </div>

      {!loading && !sinistre && (
        <p className="text-muted-foreground">Ce sinistre n'existe pas ou a été supprimé.</p>
      )}

      {sinistre && (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-6">
              <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
                <CardHeader>
                  <CardTitle className="text-base">Ticket</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex flex-col gap-3">
                    <div>
                      <span className="text-muted-foreground">N° ticket : </span>
                      #{sinistre.id.slice(-6).toUpperCase()}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Résidence : </span>
                      {residenceName ?? "—"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Date de la 1ère déclaration : </span>
                      {sinistre.timeStamp ? sinistre.timeStamp.toLocaleDateString("fr-FR") : "—"}
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        disabled={updating}
                        className="flex w-fit items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <span className="text-muted-foreground">Statut :</span>
                        <span className={cn("font-medium", sinistreStatusTextClass[sinistre.statut as SinistreStatus])}>
                          {sinistreStatusLabels[sinistre.statut as SinistreStatus] ?? sinistre.statut}
                        </span>
                        <ChevronDown className="size-4 text-muted-foreground" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-48">
                        <DropdownMenuRadioGroup
                          value={sinistre.statut}
                          onValueChange={(value) => handleStatusChange(value as SinistreStatus)}
                        >
                          <DropdownMenuLabel>Statut</DropdownMenuLabel>
                          {SINISTRE_STATUSES.map((statut) => (
                            <DropdownMenuRadioItem key={statut} value={statut} className="gap-2">
                              <span className={cn("size-2 shrink-0 rounded-full", sinistreStatusDotClass[statut])} />
                              {sinistreStatusLabels[statut]}
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                      <DropdownMenuTrigger
                        disabled={updatingPriority}
                        className="flex w-fit items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <span className="text-muted-foreground">Priorité :</span>
                        <SinistrePriorityIcon priority={sinistre.priority} className="size-3.5" />
                        {sinistrePriorityLabels[sinistre.priority]}
                        <ChevronDown className="size-4 text-muted-foreground" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-48">
                        <DropdownMenuRadioGroup
                          value={sinistre.priority}
                          onValueChange={(value) => handlePriorityChange(value as SinistrePriority)}
                        >
                          <DropdownMenuLabel>Priorité</DropdownMenuLabel>
                          {SINISTRE_PRIORITIES.map((priority) => (
                            <DropdownMenuRadioItem key={priority} value={priority} className="gap-2">
                              <SinistrePriorityIcon priority={priority} className="size-3.5" />
                              {sinistrePriorityLabels[priority]}
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    {(sinistre.statut === "Terminé" || sinistre.archived) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-fit"
                        disabled={updatingArchived}
                        onClick={handleToggleArchived}
                      >
                        {sinistre.archived ? <ArchiveRestore /> : <Archive />}
                        {sinistre.archived ? "Désarchiver" : "Archiver"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <DeclarantCard
                title="Déclarant"
                uid={sinistre.user}
                residenceId={residenceId}
                description={sinistre.description}
              />

              {signalements.map((signalement, i) => (
                <DeclarantCard
                  key={signalement.id}
                  title={`Déclarant ${i + 2}`}
                  uid={signalement.user}
                  residenceId={residenceId}
                  description={signalement.description}
                />
              ))}
            </div>

            <div className="flex flex-col gap-6">
              <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
                <CardHeader>
                  <CardTitle className="text-base">Photo / vidéo</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <SinistreMediaViewer
                    pathImage={mediaItems[activeMediaIndex]?.pathImage ?? ""}
                    className="aspect-video w-full rounded-lg"
                  />
                  {mediaItems.length > 1 && (
                    <>
                      <div className="flex items-center justify-between">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={activeMediaIndex === 0}
                          onClick={() => setMediaIndex(activeMediaIndex - 1)}
                        >
                          <ChevronLeft />
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          {mediaItems[activeMediaIndex]?.label} ({activeMediaIndex + 1}/{mediaItems.length})
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={activeMediaIndex === mediaItems.length - 1}
                          onClick={() => setMediaIndex(activeMediaIndex + 1)}
                        >
                          <ChevronRight />
                        </Button>
                      </div>
                      <div className="flex justify-center gap-1.5">
                        {mediaItems.map((item, i) => (
                          <button
                            key={item.key}
                            type="button"
                            aria-label={item.label}
                            onClick={() => setMediaIndex(i)}
                            className={cn(
                              "size-1.5 rounded-full",
                              i === activeMediaIndex ? "bg-foreground" : "bg-muted-foreground/30"
                            )}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
                <CardHeader>
                  <CardTitle className="text-base">Commentaires</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-[40px]">
                  {comments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucun commentaire.</p>
                  ) : (
                    <div className="flex flex-col gap-[20px]">
                      {comments.map((c) => (
                        <div key={c.docId} className="flex flex-col gap-2">
                          <CommentRow
                            comment={c}
                            authorLabel={authorLabel(c.user)}
                            onReply={() =>
                              setReplyingTo({ docId: c.docId, fieldId: c.fieldId, label: authorLabel(c.user) })
                            }
                            onDelete={
                              c.user === user?.uid
                                ? () => handleDeleteComment(["comments", c.docId])
                                : undefined
                            }
                          />
                          {c.replies.length > 0 && (
                            <div className="flex flex-col gap-2 border-l pl-4">
                              {c.replies.map((r) => (
                                <CommentRow
                                  key={r.docId}
                                  comment={r}
                                  authorLabel={authorLabel(r.user)}
                                  onDelete={
                                    r.user === user?.uid
                                      ? () => handleDeleteComment(["comments", c.docId, "replies", r.docId])
                                      : undefined
                                  }
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    {replyingTo && (
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Réponse à {replyingTo.label}</span>
                        <button
                          type="button"
                          className="underline hover:text-foreground"
                          onClick={() => setReplyingTo(null)}
                        >
                          Annuler
                        </button>
                      </div>
                    )}
                    <textarea
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Ajouter un commentaire..."
                      rows={2}
                      className="w-full min-w-0 resize-none rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        disabled={!commentText.trim() || submittingComment}
                        onClick={handleSubmitComment}
                      >
                        <Send />
                        Envoyer
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
      )}
    </div>
  )
}

function DeclarantCard({
  title,
  uid,
  residenceId,
  description,
}: {
  title: string
  uid: string
  residenceId: string
  description: string
}) {
  const [declarant, setDeclarant] = useState<KonodalUser | null>(null)
  const [lots, setLots] = useState<UserLot[]>([])
  const [lotInfo, setLotInfo] = useState<{ refLot: string; batiment: string; lot: string } | null>(null)

  useEffect(() => {
    if (!uid) return
    return subscribeToUser(
      uid,
      setDeclarant,
      (error) => toast.error("Impossible de charger le déclarant : " + error.message)
    )
  }, [uid])

  useEffect(() => {
    if (!uid) return
    return subscribeToUserLots(
      uid,
      setLots,
      (error) => toast.error("Impossible de charger le lot du déclarant : " + error.message)
    )
  }, [uid])

  const lot = lots.find((l) => l.residenceId === residenceId) ?? null

  useEffect(() => {
    setLotInfo(null)
    if (!lot) return
    // `lot.nameLot` n'est qu'un surnom optionnel choisi par le résident,
    // souvent vide - refLot/batiment/lot identifient le lot sans ambiguïté et
    // vivent sur le document résidence, cf. même pattern dans ResidentDetailPage.
    getDoc(doc(db, "residences", residenceId, "lots", lot.id)).then((snap) => {
      if (!snap.exists()) return
      const data = snap.data()
      setLotInfo({
        refLot: (data.refLot as string) ?? "",
        batiment: (data.batiment as string) ?? "",
        lot: (data.lot as string) ?? "",
      })
    })
  }, [residenceId, lot])

  return (
    <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <span className="text-muted-foreground">Nom : </span>
          {declarant?.surname || "—"}
        </div>
        <div>
          <span className="text-muted-foreground">Prénom : </span>
          {declarant?.name || "—"}
        </div>
        <div>
          <span className="text-muted-foreground">N° de lot : </span>
          {lotInfo?.refLot || lot?.nameLot || "—"}
        </div>
        <div>
          <span className="text-muted-foreground">Dénomination lot : </span>
          {lotInfo?.batiment || lotInfo?.lot ? `${lotInfo.batiment}-${lotInfo.lot}` : "—"}
        </div>
        <div>
          <span className="text-muted-foreground">Téléphone : </span>
          {declarant?.phone || "—"}
        </div>
        <div>
          <span className="text-muted-foreground">Email : </span>
          {declarant?.email || "—"}
        </div>
        <div>
          <span className="text-muted-foreground">Statut résident : </span>
          {lot?.statutResident || "—"}
        </div>
        <div className="flex flex-col sm:col-span-2">
          <span className="text-muted-foreground">Description :</span>
          <span className="mt-[10px]">{description || "Aucune description."}</span>
        </div>
      </CardContent>
    </Card>
  )
}

function CommentRow({
  comment,
  authorLabel,
  onReply,
  onDelete,
}: {
  comment: PostComment
  authorLabel: string
  onReply?: () => void
  onDelete?: () => void
}) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <div className="flex items-center gap-2">
        <span className="font-medium">{authorLabel}</span>
        <span className="text-xs text-muted-foreground">
          {comment.timestamp ? comment.timestamp.toLocaleString("fr-FR") : ""}
        </span>
      </div>
      <p>{comment.comment}</p>
      <div className="flex items-center gap-3">
        {onReply && (
          <button
            type="button"
            className="w-fit text-xs text-muted-foreground underline hover:text-foreground"
            onClick={onReply}
          >
            Répondre
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            className="w-fit text-xs text-destructive underline hover:text-destructive/80"
            onClick={onDelete}
          >
            Supprimer
          </button>
        )}
      </div>
    </div>
  )
}
