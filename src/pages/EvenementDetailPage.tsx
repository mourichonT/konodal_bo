import { useEffect, useState } from "react"
import { Link, useLocation, useParams } from "react-router-dom"
import { doc, getDoc } from "firebase/firestore"
import { toast } from "sonner"
import { ArrowLeft, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EventFormDialog } from "@/components/EventFormDialog"
import { db } from "@/firebase"
import { subscribeToEvent, updateEvent } from "@/lib/events"
import type { ResidenceEvent } from "@/types/event"

export default function EvenementDetailPage() {
  const { residenceId, postId } = useParams<{ residenceId: string; postId: string }>()
  const location = useLocation()
  const backTo = `/evenements/${(location.state as { from?: string } | null)?.from === "calendrier" ? "calendrier" : "liste"}`
  const [event, setEvent] = useState<ResidenceEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [residenceName, setResidenceName] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (!residenceId || !postId) return
    setLoading(true)
    return subscribeToEvent(
      residenceId,
      postId,
      (data) => {
        setEvent(data)
        setLoading(false)
      },
      (error) => {
        toast.error("Impossible de charger la prestation : " + error.message)
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

  if (!residenceId || !postId) return null

  return (
    <div className="-mt-[20px] flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Link
          to={backTo}
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Prestations
        </Link>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">
            {event ? event.title || "Sans titre" : loading ? "…" : "Prestation introuvable"}
          </h1>
          {event && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil />
              Modifier
            </Button>
          )}
        </div>
      </div>

      {!loading && !event && (
        <p className="text-muted-foreground">Cette prestation n'existe pas ou a été supprimée.</p>
      )}

      {event && (
        <Card className="max-w-2xl rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
          <CardHeader>
            <CardTitle className="text-base">Prestation</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <span className="text-muted-foreground">Résidence : </span>
              {residenceName ?? "—"}
            </div>
            <div>
              <span className="text-muted-foreground">Prestataire : </span>
              {event.prestaName || "—"}
            </div>
            <div>
              <span className="text-muted-foreground">Date : </span>
              {event.eventDate ? event.eventDate.toLocaleDateString("fr-FR") : "—"}
            </div>
            <div>
              <span className="text-muted-foreground">Heure : </span>
              {event.eventDate
                ? event.eventDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
                : "—"}
            </div>
            <div className="flex flex-col sm:col-span-2">
              <span className="text-muted-foreground">Description :</span>
              <span className="mt-[10px]">{event.description || "Aucune description."}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <EventFormDialog
        open={editing}
        onOpenChange={setEditing}
        title="Modifier la prestation"
        residences={residenceName ? [{ id: residenceId, name: residenceName }] : []}
        initialResidenceId={residenceId}
        lockResidence
        initial={
          event
            ? {
                title: event.title,
                description: event.description,
                eventDate: event.eventDate ?? new Date(),
                prestaName: event.prestaName,
              }
            : undefined
        }
        onSubmit={async (_residenceId, input) => {
          await updateEvent(residenceId, postId, input)
          toast.success("Prestation mise à jour")
          setEditing(false)
        }}
      />
    </div>
  )
}
