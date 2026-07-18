import { useEffect, useState } from "react"
import { useNavigate, useOutletContext } from "react-router-dom"
import { toast } from "sonner"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { Archive, ArchiveRestore, MessageSquare, TriangleAlert, Users } from "lucide-react"
import {
  SINISTRE_PRIORITIES,
  SINISTRE_STATUSES,
  sinistrePriorityLabels,
  sinistreStatusLabels,
  type SinistrePriority,
  type SinistreStatus,
} from "@/types/sinistre"
import { updateSinistreArchived, updateSinistrePriority, updateSinistreStatut } from "@/lib/sinistres"
import { SinistreThumbnail } from "@/components/SinistreThumbnail"
import { SinistrePriorityIcon } from "@/components/SinistrePriorityIcon"
import { useCommentStats } from "@/hooks/useCommentCount"
import { useSignalementCount } from "@/hooks/useSignalementCount"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type { SinistresOutletContext } from "@/pages/SinistresPage"
import type { SinistreWithResidence } from "@/hooks/useAllSinistres"

const columnAccent: Record<SinistreStatus, string> = {
  "Non envoyé": "border-t-slate-400",
  Transmis: "border-t-amber-400",
  "En cours": "border-t-sky-400",
  Terminé: "border-t-emerald-500",
}

function cardKey(sinistre: Pick<SinistreWithResidence, "residenceId" | "id">) {
  return `${sinistre.residenceId}:${sinistre.id}`
}

export default function SinistresKanbanPage() {
  const { sinistres, loading, filters } = useOutletContext<SinistresOutletContext>()
  const { search, residenceFilter, dateFrom, dateTo, showNonDeclares, showArchived } = filters
  const normalizedSearch = search.trim().toLowerCase()
  const navigate = useNavigate()
  const [activeId, setActiveId] = useState<string | null>(null)
  // Déplace la carte instantanément vers la colonne cible au drop, sans
  // attendre l'aller-retour Firestore (le listener met un instant à refléter
  // l'écriture) - purgé dès que le statut confirmé rejoint l'override, ou en
  // cas d'échec de l'écriture.
  const [statusOverrides, setStatusOverrides] = useState<Record<string, SinistreStatus>>({})
  // Sortie du statut "Non envoyé" (App: déclaration/transmission) : demande
  // confirmation avant d'appliquer le déplacement, car ça pose declaredDate
  // (irréversible côté règle Firestore).
  const [pendingDrop, setPendingDrop] = useState<{
    residenceId: string
    id: string
    key: string
    statut: SinistreStatus
  } | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  useEffect(() => {
    setStatusOverrides((prev) => {
      const next = { ...prev }
      let changed = false
      for (const s of sinistres) {
        const key = cardKey(s)
        if (key in next && next[key] === (s.statut || "Non envoyé")) {
          delete next[key]
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [sinistres])

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  async function applyStatusChange(
    residenceId: string,
    id: string,
    key: string,
    statut: SinistreStatus,
    options?: { markDeclared?: boolean }
  ) {
    setStatusOverrides((prev) => ({ ...prev, [key]: statut }))
    try {
      await updateSinistreStatut(residenceId, id, statut, options)
    } catch (err) {
      toast.error("Échec du changement de statut : " + (err as Error).message)
      setStatusOverrides((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over) return
    const statut = over.id as SinistreStatus
    const [residenceId, id] = String(active.id).split(":")
    const key = String(active.id)
    const current = sinistres.find((s) => cardKey(s) === key)
    const currentStatut = current?.statut || "Non envoyé"
    if (currentStatut === statut) return
    if (statut === "Non envoyé" && current?.declaredDate) {
      toast.error("Impossible de repasser un ticket déjà transmis en \"À venir\"")
      return
    }

    if (currentStatut === "Non envoyé") {
      setPendingDrop({ residenceId, id, key, statut })
      return
    }

    await applyStatusChange(residenceId, id, key, statut)
  }

  async function handleConfirmPendingDrop() {
    if (!pendingDrop) return
    const { residenceId, id, key, statut } = pendingDrop
    setPendingDrop(null)
    await applyStatusChange(residenceId, id, key, statut, { markDeclared: true })
  }

  const activeSinistre = activeId ? (sinistres.find((s) => cardKey(s) === activeId) ?? null) : null

  return (
    <div className="flex flex-col gap-4">
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div
          className={cn(
            "grid gap-4",
            showNonDeclares ? "grid-cols-4" : "grid-cols-3"
          )}
        >
          {SINISTRE_STATUSES.filter((statut) => showNonDeclares || statut !== "Non envoyé").map((statut) => {
            const fromDate = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null
            const toDate = dateTo ? new Date(`${dateTo}T23:59:59`) : null
            const columnSinistres = sinistres.filter((s) => {
              const effectiveStatut = statusOverrides[cardKey(s)] ?? (s.statut || "Non envoyé")
              if (effectiveStatut !== statut) return false
              if (!showArchived && s.archived) return false
              if (residenceFilter !== "all" && s.residenceId !== residenceFilter) return false
              if (fromDate && (!s.creationDate || s.creationDate < fromDate)) return false
              if (toDate && (!s.creationDate || s.creationDate > toDate)) return false
              if (!normalizedSearch) return true
              return (
                s.title.toLowerCase().includes(normalizedSearch) ||
                s.description.toLowerCase().includes(normalizedSearch) ||
                s.id.slice(-6).toLowerCase().includes(normalizedSearch)
              )
            })
            return (
              <KanbanColumn
                key={statut}
                statut={statut}
                sinistres={columnSinistres}
                loading={loading}
                onOpen={(sinistre) =>
                  navigate(`/sinistres/${sinistre.residenceId}/${sinistre.id}`, {
                    state: { from: "kanban" },
                  })
                }
              />
            )
          })}
        </div>

        <DragOverlay>
          {activeSinistre && <KanbanCardContent sinistre={activeSinistre} dragging />}
        </DragOverlay>
      </DndContext>

      <Dialog open={!!pendingDrop} onOpenChange={(open) => !open && setPendingDrop(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="pb-4">
            <DialogTitle>Déplacer ce ticket ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Êtes-vous sûr de vouloir déplacer ce ticket ? Une fois confirmé, ce ticket sera
            considéré comme déclaré.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDrop(null)}>
              Annuler
            </Button>
            <Button onClick={handleConfirmPendingDrop}>Confirmer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function KanbanColumn({
  statut,
  sinistres,
  loading,
  onOpen,
}: {
  statut: SinistreStatus
  sinistres: SinistreWithResidence[]
  loading: boolean
  onOpen: (sinistre: SinistreWithResidence) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: statut })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col gap-3 rounded-2xl border-t-4 bg-white p-3 shadow-[0_8px_30px_rgb(0,0,0,0.06)]",
        columnAccent[statut],
        isOver && "ring-2 ring-primary"
      )}
    >
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm">{sinistreStatusLabels[statut]}</h2>
        <span className="text-xs text-muted-foreground">{sinistres.length}</span>
      </div>

      <div className="flex min-h-24 flex-col gap-2">
        {sinistres.map((sinistre) => (
          <KanbanCard
            key={cardKey(sinistre)}
            sinistre={sinistre}
            onOpen={() => onOpen(sinistre)}
          />
        ))}
        {!loading && sinistres.length === 0 && (
          <p className="px-1 text-sm text-muted-foreground">Aucun ticket.</p>
        )}
      </div>
    </div>
  )
}

function KanbanCard({
  sinistre,
  onOpen,
}: {
  sinistre: SinistreWithResidence
  onOpen: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: cardKey(sinistre),
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onOpen}
      style={
        transform
          ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
          : undefined
      }
      className={cn("cursor-grab active:cursor-grabbing", isDragging && "opacity-0")}
    >
      <KanbanCardContent sinistre={sinistre} />
    </div>
  )
}

function KanbanCardContent({
  sinistre,
  dragging,
}: {
  sinistre: SinistreWithResidence
  dragging?: boolean
}) {
  const commentStats = useCommentStats(sinistre.residenceId, sinistre.id)
  const signalementCount = useSignalementCount(sinistre.residenceId, sinistre.id)

  async function handlePriorityChange(priority: SinistrePriority) {
    try {
      await updateSinistrePriority(sinistre.residenceId, sinistre.id, priority)
    } catch (err) {
      toast.error("Échec de la mise à jour de la priorité : " + (err as Error).message)
    }
  }

  async function handleToggleArchived() {
    try {
      await updateSinistreArchived(sinistre.residenceId, sinistre.id, !sinistre.archived)
    } catch (err) {
      toast.error("Échec de l'archivage : " + (err as Error).message)
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border bg-white p-[20px] text-sm shadow-[0_8px_30px_rgb(0,0,0,0.06)]",
        dragging ? "shadow-lg" : "hover:bg-muted/50"
      )}
    >
      <div className="flex items-center gap-4">
        <SinistreThumbnail pathImage={sinistre.pathImage} className="size-14 shrink-0 rounded-md" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-medium">{sinistre.title || "Sans titre"}</span>
          <span className="truncate text-xs text-muted-foreground">{sinistre.residenceName}</span>
          <span className="truncate text-xs text-muted-foreground">
            {sinistre.creationDate ? sinistre.creationDate.toLocaleDateString("fr-FR") : "—"}
          </span>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex shrink-0 items-center rounded-full p-1 hover:bg-muted">
              <SinistrePriorityIcon priority={sinistre.priority} className="size-[25px]" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
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
        </div>
        {(sinistre.statut === "Terminé" || sinistre.archived) && (
          <button
            type="button"
            title={sinistre.archived ? "Désarchiver" : "Archiver"}
            onClick={(e) => {
              e.stopPropagation()
              handleToggleArchived()
            }}
            className="flex shrink-0 items-center rounded-full p-1 text-muted-foreground hover:bg-muted"
          >
            {sinistre.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
          </button>
        )}
      </div>
      <div className="mt-[5px] flex items-center justify-between border-t pt-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <TriangleAlert className="size-3.5" />
          {signalementCount + 1}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Users className="size-3.5" />
            {commentStats.uniqueUserCount}
          </div>
          <div className="flex items-center gap-1">
            <MessageSquare className="size-3.5" />
            {commentStats.count}
          </div>
        </div>
      </div>
    </div>
  )
}
