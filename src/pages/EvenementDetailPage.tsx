import { useEffect, useState } from "react"
import { communicationAudienceLabels } from "@/types/communication"
import { Link, useLocation, useParams } from "react-router-dom"
import { doc, getDoc } from "firebase/firestore"
import { toast } from "sonner"
import { ArrowLeft, Eye, Mail, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EventFormDialog } from "@/components/EventFormDialog"
import { PostCommentsCard } from "@/components/PostCommentsCard"
import { db } from "@/firebase"
import { subscribeToEvent, updateEvent, cancelEvent } from "@/lib/events"
import { findPrestataireMail, sendInterventionEmail } from "@/lib/interventionEmail"
import { subscribeToRapportsForEvent, type Rapport } from "@/lib/rapports"
import type { ResidenceEvent } from "@/types/event"
import { emptyAddress, type Address, type GeranceRef } from "@/types/residence"

export default function EvenementDetailPage() {
  const { residenceId, postId } = useParams<{ residenceId: string; postId: string }>()
  const location = useLocation()
  const backTo = `/evenements/${(location.state as { from?: string } | null)?.from === "calendrier" ? "calendrier" : "liste"}`
  const [event, setEvent] = useState<ResidenceEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [residenceName, setResidenceName] = useState<string | null>(null)
  const [residenceAddress, setResidenceAddress] = useState<Address | undefined>(undefined)
  const [contactRefs, setContactRefs] = useState<Record<string, boolean> | undefined>(undefined)
  const [geranceRef, setGeranceRef] = useState<GeranceRef | undefined>(undefined)
  const [csmembers, setCsmembers] = useState<string[] | undefined>(undefined)
  const [editing, setEditing] = useState(false)
  const [sending, setSending] = useState(false)
  const [rapports, setRapports] = useState<Rapport[]>([])

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
        toast.error("Impossible de charger l'intervention : " + error.message)
        setLoading(false)
      }
    )
  }, [residenceId, postId])

  useEffect(() => {
    if (!residenceId || !postId) return
    return subscribeToRapportsForEvent(
      residenceId,
      postId,
      setRapports,
      (error) => toast.error("Impossible de charger les comptes-rendus : " + error.message)
    )
  }, [residenceId, postId])

  useEffect(() => {
    if (!residenceId) return
    getDoc(doc(db, "residences", residenceId)).then((snap) => {
      setResidenceName(snap.exists() ? ((snap.data().name as string) ?? null) : null)
      setResidenceAddress(snap.exists() ? (snap.data().address as Address | undefined) : undefined)
      setContactRefs(snap.exists() ? (snap.data().contactRefs as Record<string, boolean> | undefined) : undefined)
      setGeranceRef(snap.exists() ? (snap.data().geranceRef as GeranceRef | undefined) : undefined)
      setCsmembers(snap.exists() ? (snap.data().csmembers as string[] | undefined) : undefined)
    })
  }, [residenceId])

  async function handleSend() {
    if (!event || !residenceId || !postId) return
    if (event.reporte || event.annule) return
    setSending(true)
    try {
      const prestataireMail = await findPrestataireMail(contactRefs, event.prestaName)
      if (!prestataireMail) {
        toast.error("Aucun email trouvé pour ce prestataire")
        return
      }

      await sendInterventionEmail({
        residenceId,
        postId,
        residenceName: residenceName ?? "",
        address: residenceAddress ?? emptyAddress,
        event,
        prestataireMail,
      })
      toast.success("Email envoyé au prestataire")
    } catch (error) {
      toast.error("Impossible d'envoyer l'email : " + (error as Error).message)
    } finally {
      setSending(false)
    }
  }

  if (!residenceId || !postId) return null

  return (
    <div className="-mt-[20px] flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Link
          to={backTo}
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Interventions
        </Link>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-[oklch(22%_0.01_150)]">
              {event ? event.title || "Sans titre" : loading ? "…" : "Intervention introuvable"}
            </h1>
            {event?.annule ? (
              <Badge variant="outline" className="border-transparent bg-red-100 text-red-800">
                Annulé
              </Badge>
            ) : event?.reporte ? (
              <Badge variant="outline" className="border-transparent bg-amber-100 text-amber-800">
                Reporté
              </Badge>
            ) : event?.termine ? (
              <Badge variant="outline" className="border-transparent bg-emerald-100 text-emerald-800">
                Terminé
              </Badge>
            ) : event ? (
              <Badge variant="outline" className="border-transparent bg-sky-100 text-sky-800">
                Programmé
              </Badge>
            ) : null}
          </div>
          {event && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSend}
                disabled={sending || event.reporte || event.annule}
              >
                <Mail />
                Envoyer
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(true)}
                disabled={event.annule}
              >
                <Pencil />
                Modifier
              </Button>
            </div>
          )}
        </div>
      </div>

      {!loading && !event && (
        <p className="text-muted-foreground">Cette intervention n'existe pas ou a été supprimée.</p>
      )}

      {event && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Intervention</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <span className="text-muted-foreground">Résidence : </span>
                  {residenceName ?? "—"}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Prestataire : </span>
                  {event.prestaName || "—"}
                  {event.pathImage && (
                    <img src={event.pathImage} alt="" className="size-6 shrink-0 rounded-full border object-cover" />
                  )}
                </div>
                <div>
                  <span className="text-muted-foreground">Destinataires : </span>
                  {communicationAudienceLabels[event.audience]}
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
                {event.linkedSinistreId && (
                  <div className="flex items-center justify-between gap-2 border-t pt-3 sm:col-span-2">
                    <span>
                      <span className="text-muted-foreground">Sinistre lié : </span>
                      #{event.linkedSinistreId.slice(-6).toUpperCase()}
                    </span>
                    <Button
                      size="sm"
                      render={<Link to={`/sinistres/${residenceId}/${event.linkedSinistreId}`} />}
                      className="bg-sky-500 hover:bg-sky-600 dark:bg-sky-600 dark:hover:bg-sky-700"
                    >
                      <Eye />
                      Voir le sinistre
                    </Button>
                  </div>
                )}
                <div className="flex flex-col sm:col-span-2">
                  <span className="text-muted-foreground">Description :</span>
                  <span className="mt-[10px]">{event.description || "Aucune description."}</span>
                </div>
              </CardContent>
            </Card>

            {rapports.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Comptes-rendus prestataire</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {rapports.map((r) => (
                    <div key={r.id} className="rounded-lg border border-border p-3 text-sm">
                      <span className="font-medium">{r.title || "Sans titre"}</span>
                      {r.description && <p className="mt-1 text-muted-foreground">{r.description}</p>}
                      {r.pathImage && (
                        <img
                          src={r.pathImage}
                          alt={r.title}
                          className="mt-2 max-h-64 rounded-lg object-cover"
                        />
                      )}
                      {r.creationDate && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {r.creationDate.toLocaleString("fr-FR")}
                        </p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="flex flex-col gap-6">
            <PostCommentsCard residenceId={residenceId} postId={postId} />
          </div>
        </div>
      )}

      <EventFormDialog
        open={editing}
        onOpenChange={setEditing}
        title="Modifier l'intervention"
        residences={
          residenceName ? [{ id: residenceId, name: residenceName, contactRefs, geranceRef, csmembers }] : []
        }
        initialResidenceId={residenceId}
        lockResidence
        initial={
          event
            ? {
                title: event.title,
                description: event.description,
                eventDate: event.eventDate ?? new Date(),
                prestaName: event.prestaName,
                pathImage: event.pathImage,
                contactCsMemberIds: event.contactCsMemberIds,
                audience: event.audience,
              }
            : undefined
        }
        onSubmit={async (_residenceId, input) => {
          await updateEvent(residenceId, postId, input)
          toast.success("Intervention mise à jour")
          setEditing(false)
        }}
        onCancel={async (scope) => {
          await cancelEvent(residenceId, postId, scope)
          toast.success(
            scope === "chain" ? "Interventions liées annulées" : "Intervention annulée"
          )
          setEditing(false)
        }}
        readOnly={!!event?.reporte}
      />
    </div>
  )
}
