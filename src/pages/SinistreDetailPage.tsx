import { useEffect, useRef, useState } from "react"
import { Link, useLocation, useParams } from "react-router-dom"
import { doc, getDoc } from "firebase/firestore"
import { toast } from "sonner"
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  CalendarPlus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { EventFormDialog } from "@/components/EventFormDialog"
import { PostCommentsCard } from "@/components/PostCommentsCard"
import { SinistreMediaViewer } from "@/components/SinistreMediaViewer"
import { SinistrePriorityIcon } from "@/components/SinistrePriorityIcon"
import { db } from "@/firebase"
import { useAuth } from "@/lib/auth-context"
import { createEvent, findInterventionEventId, KONODAL_LOGO_HORIZONTAL_URL } from "@/lib/events"
import {
  subscribeToSinistre,
  subscribeToSinistreSignalements,
  updateSinistreArchived,
  updateSinistreInterventionDate,
  updateSinistrePriority,
  updateSinistreStatut,
} from "@/lib/sinistres"
import { exportElementToPdf, waitForImagesToLoad } from "@/lib/exportPdf"
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
import type { GeranceRef } from "@/types/residence"

export default function SinistreDetailPage() {
  const { residenceId, postId } = useParams<{ residenceId: string; postId: string }>()
  const reportRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const backTo = `/sinistres/${(location.state as { from?: string } | null)?.from === "kanban" ? "kanban" : "liste"}`
  const { user } = useAuth()
  const [sinistre, setSinistre] = useState<Sinistre | null>(null)
  const [loading, setLoading] = useState(true)
  const [signalements, setSignalements] = useState<Sinistre[]>([])
  const [updating, setUpdating] = useState(false)
  const [updatingPriority, setUpdatingPriority] = useState(false)
  const [updatingArchived, setUpdatingArchived] = useState(false)
  // Sortie du statut "Non envoyé" via ce dropdown : même garde que le
  // drag-and-drop Kanban, cf. SinistresKanbanPage.tsx (pose declaredDate,
  // irréversible côté règle Firestore).
  const [pendingStatus, setPendingStatus] = useState<SinistreStatus | null>(null)
  const [residenceName, setResidenceName] = useState<string | null>(null)
  const [contactRefs, setContactRefs] = useState<Record<string, boolean> | undefined>(undefined)
  const [geranceRef, setGeranceRef] = useState<GeranceRef | undefined>(undefined)
  const [schedulingIntervention, setSchedulingIntervention] = useState(false)
  const [interventionEventId, setInterventionEventId] = useState<string | undefined>(undefined)
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
    if (!residenceId || !postId || !sinistre?.interventionDate) {
      setInterventionEventId(undefined)
      return
    }
    findInterventionEventId(residenceId, postId).then(setInterventionEventId)
  }, [residenceId, postId, sinistre?.interventionDate])

  useEffect(() => {
    if (!residenceId) return
    getDoc(doc(db, "residences", residenceId)).then((snap) => {
      setResidenceName(snap.exists() ? ((snap.data().name as string) ?? null) : null)
      setContactRefs(snap.exists() ? (snap.data().contactRefs as Record<string, boolean> | undefined) : undefined)
      setGeranceRef(snap.exists() ? (snap.data().geranceRef as GeranceRef | undefined) : undefined)
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

  if (!residenceId || !postId) return null

  const currentIndex = allSinistres.findIndex(
    (s) => s.residenceId === residenceId && s.id === postId
  )
  const previous = currentIndex > 0 ? allSinistres[currentIndex - 1] : null
  const next =
    currentIndex >= 0 && currentIndex < allSinistres.length - 1 ? allSinistres[currentIndex + 1] : null

  async function applyStatusChange(statut: SinistreStatus, options?: { markDeclared?: boolean }) {
    if (!residenceId || !postId) return
    setUpdating(true)
    try {
      await updateSinistreStatut(residenceId, postId, statut, options)
      toast.success("Statut mis à jour")
    } catch (err) {
      toast.error("Échec de la mise à jour : " + (err as Error).message)
    } finally {
      setUpdating(false)
    }
  }

  function handleStatusChange(statut: SinistreStatus) {
    if (!residenceId || !postId || !sinistre) return
    if (statut === "Non envoyé" && sinistre.declaredDate) {
      toast.error("Impossible de repasser un ticket déjà transmis en \"À venir\"")
      return
    }
    const currentStatut = sinistre.statut || "Non envoyé"
    if (currentStatut === statut) return
    if (currentStatut === "Non envoyé") {
      setPendingStatus(statut)
      return
    }
    void applyStatusChange(statut)
  }

  async function handleConfirmPendingStatus() {
    if (!pendingStatus) return
    const statut = pendingStatus
    setPendingStatus(null)
    await applyStatusChange(statut, { markDeclared: true })
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
    if (!postId) return
    setExportingPdf(true)
    try {
      // La copie hors-écran (ref) ne se monte qu'une fois exportingPdf à
      // true - attend qu'elle existe avant de continuer, la mise en page
      // visible (carrousel) n'est jamais touchée.
      while (!reportRef.current) {
        await new Promise((resolve) => requestAnimationFrame(resolve))
      }
      await waitForImagesToLoad(reportRef.current, mediaItems.length)
      await exportElementToPdf(reportRef.current, `rapport_sinistre_${postId}.pdf`)
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
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                disabled={sinistre.statut === "Terminé" || !!sinistre.interventionDate}
                title={
                  sinistre.statut === "Terminé"
                    ? "Ticket terminé : plus d'intervention à programmer"
                    : sinistre.interventionDate
                      ? "Une intervention est déjà programmée pour ce ticket"
                      : undefined
                }
                onClick={() => setSchedulingIntervention(true)}
                className="bg-sky-500 hover:bg-sky-600 dark:bg-sky-600 dark:hover:bg-sky-700"
              >
                <CalendarPlus />
                Programmer une intervention
              </Button>
              <Button
                size="sm"
                disabled={exportingPdf}
                onClick={handleExportPdf}
                className="bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-100 dark:hover:bg-slate-500"
              >
                <FileDown />
                Exporter en PDF
              </Button>
            </div>
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
                      {sinistre.creationDate ? sinistre.creationDate.toLocaleDateString("fr-FR") : "—"}
                    </div>
                    {sinistre.inProgressDate && (
                      <div>
                        <span className="text-muted-foreground">Date de prise en charge : </span>
                        {sinistre.inProgressDate.toLocaleDateString("fr-FR")}
                      </div>
                    )}
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
                            <DropdownMenuRadioItem
                              key={statut}
                              value={statut}
                              disabled={statut === "Non envoyé" && !!sinistre.declaredDate}
                              className="gap-2"
                            >
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

                  {sinistre.interventionDate && (
                    <div className="col-span-2 flex items-center justify-between gap-2 border-t pt-3">
                      <span>
                        <span className="text-muted-foreground">Date d'intervention : </span>
                        {sinistre.interventionDate.toLocaleDateString("fr-FR")}{" "}
                        {sinistre.interventionDate.toLocaleTimeString("fr-FR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {interventionEventId && (
                        <Button
                          size="sm"
                          render={<Link to={`/evenements/${residenceId}/${interventionEventId}`} />}
                          className="bg-sky-500 hover:bg-sky-600 dark:bg-sky-600 dark:hover:bg-sky-700"
                        >
                          <Eye />
                          Voir l'intervention
                        </Button>
                      )}
                    </div>
                  )}
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

              <PostCommentsCard residenceId={residenceId} postId={postId} />
            </div>
          </div>
      )}

      {/* Copie hors-écran dédiée à l'export PDF - la mise en page visible ne
          bouge jamais (pas de carrousel qui "casse" pendant l'export) ; seule
          cette copie affiche les photos en liste, capturée par html2canvas
          puis démontée une fois l'export terminé. */}
      {exportingPdf && sinistre && (
        <div
          ref={reportRef}
          style={{ position: "fixed", top: 0, left: "-10000px", width: "900px" }}
          className="flex flex-col gap-6 bg-white"
        >
          <div data-pdf-block className="flex flex-col items-center gap-5 bg-sidebar px-6 py-6">
            <img src={KONODAL_LOGO_HORIZONTAL_URL} alt="Konodal" className="h-[109px] w-auto" />
            <p className="text-2xl text-sidebar-foreground">Déclaration de sinistre</p>
          </div>

          <div className="flex flex-col gap-6 px-6">
            <Card data-pdf-block className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
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
                    {sinistre.creationDate ? sinistre.creationDate.toLocaleDateString("fr-FR") : "—"}
                  </div>
                  {sinistre.inProgressDate && (
                    <div>
                      <span className="text-muted-foreground">Date de prise en charge : </span>
                      {sinistre.inProgressDate.toLocaleDateString("fr-FR")}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Statut :</span>
                    <span className={cn("font-medium", sinistreStatusTextClass[sinistre.statut as SinistreStatus])}>
                      {sinistreStatusLabels[sinistre.statut as SinistreStatus] ?? sinistre.statut}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Priorité :</span>
                    <SinistrePriorityIcon priority={sinistre.priority} className="size-3.5" />
                    {sinistrePriorityLabels[sinistre.priority]}
                  </div>
                  {sinistre.archived && <span className="text-muted-foreground">Archivé</span>}
                </div>

                {sinistre.interventionDate && (
                  <div className="col-span-2 border-t pt-3">
                    <span className="text-muted-foreground">Date d'intervention : </span>
                    {sinistre.interventionDate.toLocaleDateString("fr-FR")}{" "}
                    {sinistre.interventionDate.toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <div data-pdf-block>
              <DeclarantCard
                title="Déclarant"
                uid={sinistre.user}
                residenceId={residenceId}
                description={sinistre.description}
              />
            </div>

            {signalements.map((signalement, i) => (
              <div key={signalement.id} data-pdf-block>
                <DeclarantCard
                  title={`Déclarant ${i + 2}`}
                  uid={signalement.user}
                  residenceId={residenceId}
                  description={signalement.description}
                />
              </div>
            ))}

            {mediaItems.map((item) => (
              <div key={item.key} data-pdf-block className="flex flex-col gap-1.5 rounded-2xl bg-white p-4 shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
                <span className="text-sm font-medium">{item.label}</span>
                <SinistreMediaViewer pathImage={item.pathImage} className="aspect-video w-full rounded-lg" />
              </div>
            ))}

            <div data-pdf-block>
              <PostCommentsCard residenceId={residenceId} postId={postId} />
            </div>
          </div>
        </div>
      )}

      <Dialog open={!!pendingStatus} onOpenChange={(open) => !open && setPendingStatus(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="pb-4">
            <DialogTitle>Déplacer ce ticket ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Êtes-vous sûr de vouloir déplacer ce ticket ? Une fois confirmé, ce ticket sera
            considéré comme déclaré.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingStatus(null)}>
              Annuler
            </Button>
            <Button onClick={handleConfirmPendingStatus}>Confirmer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EventFormDialog
        open={schedulingIntervention}
        onOpenChange={setSchedulingIntervention}
        title="Programmer une intervention"
        residences={residenceName ? [{ id: residenceId, name: residenceName, contactRefs, geranceRef }] : []}
        initialResidenceId={residenceId}
        lockResidence
        linkedSinistreId={postId}
        onSubmit={async (targetResidenceId, input) => {
          if (!user || !sinistre) return
          await createEvent(targetResidenceId, user.uid, input)
          await updateSinistreInterventionDate(residenceId, postId, input.eventDate)
          // "À traiter" -> "En cours" (prend en charge dateClosed/inProgressDate
          // via updateSinistreStatut) ; déjà "En cours" -> inchangé ; "Non
          // envoyé" -> inchangé aussi (pas de déclaration implicite du ticket).
          if (sinistre.statut === "Transmis") {
            await updateSinistreStatut(residenceId, postId, "En cours")
          }
          toast.success("Intervention programmée")
          setSchedulingIntervention(false)
        }}
      />
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
