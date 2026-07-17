import { useEffect, useState } from "react"
import { Link, useLocation, useParams } from "react-router-dom"
import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore"
import { toast } from "sonner"
import { ArrowLeft, Mail, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EventFormDialog } from "@/components/EventFormDialog"
import { db } from "@/firebase"
import { subscribeToEvent, updateEvent } from "@/lib/events"
import type { ResidenceEvent } from "@/types/event"
import type { GeranceRef } from "@/types/residence"

// Le lien reste valable jusqu'à 48h après la date d'intervention (le temps
// pour le prestataire de consulter/déclarer un compte-rendu autour de sa
// venue), pas une durée fixe depuis l'envoi - fallback 30j si jamais
// eventDate est absent (ne devrait pas arriver, EventInput l'exige).
const SHARE_LINK_GRACE_PERIOD_MS = 48 * 60 * 60 * 1000
const SHARE_LINK_FALLBACK_VALIDITY_MS = 30 * 24 * 60 * 60 * 1000

// Cherche l'email du prestataire choisi parmi les contacts de la résidence
// (contactRefs déjà chargés sur cette page) en matchant sur le nom - la
// gérance n'est pas couverte (pas d'email d'agent résolu ici), cf. plan.
async function findPrestataireMail(
  contactRefs: Record<string, boolean> | undefined,
  prestaName: string
): Promise<string | undefined> {
  if (!contactRefs || !prestaName) return undefined
  for (const contactId of Object.keys(contactRefs)) {
    const snap = await getDoc(doc(db, "contacts", contactId))
    if (snap.exists() && (snap.data().name as string) === prestaName) {
      return (snap.data().mail as string) || undefined
    }
  }
  return undefined
}

export default function EvenementDetailPage() {
  const { residenceId, postId } = useParams<{ residenceId: string; postId: string }>()
  const location = useLocation()
  const backTo = `/evenements/${(location.state as { from?: string } | null)?.from === "calendrier" ? "calendrier" : "liste"}`
  const [event, setEvent] = useState<ResidenceEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [residenceName, setResidenceName] = useState<string | null>(null)
  const [contactRefs, setContactRefs] = useState<Record<string, boolean> | undefined>(undefined)
  const [geranceRef, setGeranceRef] = useState<GeranceRef | undefined>(undefined)
  const [editing, setEditing] = useState(false)
  const [sending, setSending] = useState(false)

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
    if (!residenceId) return
    getDoc(doc(db, "residences", residenceId)).then((snap) => {
      setResidenceName(snap.exists() ? ((snap.data().name as string) ?? null) : null)
      setContactRefs(snap.exists() ? (snap.data().contactRefs as Record<string, boolean> | undefined) : undefined)
      setGeranceRef(snap.exists() ? (snap.data().geranceRef as GeranceRef | undefined) : undefined)
    })
  }, [residenceId])

  async function handleSend() {
    if (!event || !residenceId || !postId) return
    setSending(true)
    try {
      const prestataireMail = await findPrestataireMail(contactRefs, event.prestaName)
      if (!prestataireMail) {
        toast.error("Aucun email trouvé pour ce prestataire")
        return
      }

      const token = crypto.randomUUID()
      const expiresAt = event.eventDate
        ? new Date(event.eventDate.getTime() + SHARE_LINK_GRACE_PERIOD_MS)
        : new Date(Date.now() + SHARE_LINK_FALLBACK_VALIDITY_MS)
      await setDoc(doc(db, "shareTokens", token), {
        residenceId,
        postId,
        createdAt: serverTimestamp(),
        expiresAt,
      })

      const link = `${window.location.origin}/partage/${token}`
      await addDoc(collection(db, "residences", residenceId, "mail"), {
        to: [prestataireMail],
        message: {
          subject: `Intervention : ${event.title || "Sans titre"}`,
          html: `<p>Bonjour,</p><p>Une intervention vous a été assignée${
            residenceName ? ` à la résidence ${residenceName}` : ""
          }.</p><p><a href="${link}">Consulter l'intervention</a></p>`,
        },
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
          <h1 className="text-2xl font-semibold">
            {event ? event.title || "Sans titre" : loading ? "…" : "Intervention introuvable"}
          </h1>
          {event && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleSend} disabled={sending}>
                <Mail />
                Envoyer
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
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
        <Card className="max-w-2xl rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
          <CardHeader>
            <CardTitle className="text-base">Intervention</CardTitle>
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
            {event.linkedSinistreId && (
              <div>
                <span className="text-muted-foreground">Sinistre lié : </span>
                <Link
                  to={`/sinistres/${residenceId}/${event.linkedSinistreId}`}
                  className="underline hover:text-foreground"
                >
                  Voir le ticket
                </Link>
              </div>
            )}
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
        title="Modifier l'intervention"
        residences={residenceName ? [{ id: residenceId, name: residenceName, contactRefs, geranceRef }] : []}
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
              }
            : undefined
        }
        onSubmit={async (_residenceId, input) => {
          await updateEvent(residenceId, postId, input)
          toast.success("Intervention mise à jour")
          setEditing(false)
        }}
      />
    </div>
  )
}
