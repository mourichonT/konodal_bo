import { useState } from "react"
import { useNavigate, useOutletContext } from "react-router-dom"
import { toast } from "sonner"
import { SINISTRE_STATUSES, sinistreStatusLabels, type SinistreStatus } from "@/types/sinistre"
import { updateSinistreStatut } from "@/lib/sinistres"
import { SinistreThumbnail } from "@/components/SinistreThumbnail"
import { cn } from "@/lib/utils"
import type { SinistresOutletContext } from "@/pages/SinistresPage"
import type { SinistreWithResidence } from "@/hooks/useAllSinistres"

const columnAccent: Record<SinistreStatus, string> = {
  "Non envoyé": "border-t-slate-400",
  Transmis: "border-t-amber-400",
  "En cours": "border-t-sky-400",
  Terminé: "border-t-emerald-500",
}

export default function SinistresKanbanPage() {
  const { sinistres, loading } = useOutletContext<SinistresOutletContext>()
  const navigate = useNavigate()
  const [dragOverColumn, setDragOverColumn] = useState<SinistreStatus | null>(null)

  async function handleDrop(statut: SinistreStatus, e: React.DragEvent) {
    e.preventDefault()
    setDragOverColumn(null)
    const raw = e.dataTransfer.getData("application/json")
    if (!raw) return
    const { residenceId, id } = JSON.parse(raw) as { residenceId: string; id: string }
    try {
      await updateSinistreStatut(residenceId, id, statut)
    } catch (err) {
      toast.error("Échec du changement de statut : " + (err as Error).message)
    }
  }

  return (
    <div className="grid grid-cols-4 gap-4">
      {SINISTRE_STATUSES.map((statut) => {
        const columnSinistres = sinistres.filter((s) => (s.statut || "Non envoyé") === statut)
        return (
          <div
            key={statut}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOverColumn(statut)
            }}
            onDragLeave={() => setDragOverColumn(null)}
            onDrop={(e) => handleDrop(statut, e)}
            className={cn(
              "flex flex-col gap-3 rounded-2xl border-t-4 bg-white p-3 shadow-[0_8px_30px_rgb(0,0,0,0.06)]",
              columnAccent[statut],
              dragOverColumn === statut && "ring-2 ring-primary"
            )}
          >
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-semibold">{sinistreStatusLabels[statut]}</h2>
              <span className="text-xs text-muted-foreground">{columnSinistres.length}</span>
            </div>

            <div className="flex min-h-24 flex-col gap-2">
              {columnSinistres.map((sinistre) => (
                <KanbanCard
                  key={`${sinistre.residenceId}-${sinistre.id}`}
                  sinistre={sinistre}
                  onOpen={() => navigate(`/sinistres/${sinistre.residenceId}/${sinistre.id}`)}
                />
              ))}
              {!loading && columnSinistres.length === 0 && (
                <p className="px-1 text-sm text-muted-foreground">Aucun ticket.</p>
              )}
            </div>
          </div>
        )
      })}
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
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(
          "application/json",
          JSON.stringify({ residenceId: sinistre.residenceId, id: sinistre.id })
        )
      }}
      onClick={onOpen}
      className="flex cursor-grab items-center gap-3 rounded-lg border p-2 text-sm hover:bg-muted/50 active:cursor-grabbing"
    >
      <SinistreThumbnail pathImage={sinistre.pathImage} className="size-12 shrink-0 rounded-md" />
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-medium">{sinistre.title || "Sans titre"}</span>
        <span className="truncate text-xs text-muted-foreground">{sinistre.residenceName}</span>
      </div>
    </div>
  )
}
