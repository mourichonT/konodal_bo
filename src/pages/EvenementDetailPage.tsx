import { useEffect, useState } from "react"
import { Link, useLocation, useParams } from "react-router-dom"
import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore"
import { toast } from "sonner"
import { ArrowLeft, Eye, Mail, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EventFormDialog } from "@/components/EventFormDialog"
import { PostCommentsCard } from "@/components/PostCommentsCard"
import { db } from "@/firebase"
import { subscribeToEvent, updateEvent, GERANCE_PLACEHOLDER_LOGO_URL } from "@/lib/events"
import { subscribeToRapportsForEvent, type Rapport } from "@/lib/rapports"
import type { ResidenceEvent } from "@/types/event"
import { emptyAddress, type Address, type GeranceRef } from "@/types/residence"

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

// Même gabarit que les notifications de sinistre envoyées côté app mobile
// (bandeau vert #48775B, logo KONODAL, footer avec réseaux sociaux) - reçu
// une fois par mail depuis konodal-dev, reproduit ici pour que les mails
// envoyés depuis le backoffice restent visuellement cohérents avec ceux de
// l'app.
function buildInterventionEmailHtml({
  residenceName,
  address,
  event,
  link,
}: {
  residenceName: string
  address: Address
  event: ResidenceEvent
  link: string
}): string {
  const dateLabel = event.eventDate
    ? `${event.eventDate.toLocaleDateString("fr-FR")} à ${event.eventDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
    : "—"

  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
    <meta charset="UTF-8">
    <title>KONODAL - Notification</title>
    </head>
    <body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4;">
    <table align="center" width="600" style="background-color: #ffffff; border-collapse: collapse; margin-top: 20px;">
        <tr>
        <td style="background-color: #48775B; color: white; text-align: center; padding: 30px 20px;">
            <img src="${GERANCE_PLACEHOLDER_LOGO_URL}" alt="KONODAL-Logo" width="250" style="max-width: 100%;" />
            <p style="margin: 5px 0 0;font-size: 16px">Intervention programmée</p>
        </td>
        </tr>

        <tr>
        <td style="padding: 20px 20px; color: #333333;">
            <div style="text-align: center;">
                <p>Une intervention vous a été assignée dans la résidence :</p>
                <h2>${residenceName}</h2>
                <p>${address.street}<br>${address.zipCode} ${address.city}</p>
            </div>

            <p style="font-size: 16px; text-align: center; margin-top: 20px;"><strong>Intitulé : ${event.title || "Sans titre"}</strong></p>

            ${
              event.pathImage
                ? `<div style="text-align: center; margin: 20px 0;">
                <img src="${event.pathImage}" alt="Illustration Intervention" width="400" style="max-width: 100%; border-radius: 8px;" />
            </div>`
                : ""
            }
            <p><strong>Prestataire :</strong> ${event.prestaName || "—"}</p>
            <p><strong>Date d'intervention :</strong> ${dateLabel}</p>
            <p><strong>Description :</strong><br>
            ${event.description || "Aucune description."}
            </p>

        <div style="margin: 30px 0; text-align: center;">
            <p style="margin: 5px 0;">Pour plus d'informations</p>
            <a href="${link}" style="background-color: #48775B; color: white; padding: 8px 16px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Consulter l'intervention
            </a>
        </div>
        <p style="font-size: 12px; color: #666; text-align: center;">
            En cas de difficultés, merci de contacter nos services via :
            <a href="mailto:admin.konodal@gmail.com" style="color: #48775B; font-size: 12px;">
                admin.konodal@gmail.com
            </a>
        </p>
        </td>
        </tr>

        <tr>
        <td style="background-color: #e0e0e0; text-align: center; padding: 20px;">
            <p style="margin: 10px 0;">KONODAL</p>
            <div style="margin: 10px 0;">
            <a href="#"><img src="https://cdn-icons-png.flaticon.com/24/2111/2111463.png" alt="Instagram" style="margin: 0 5px;"></a>
            <a href="#"><img src="https://cdn-icons-png.flaticon.com/24/2111/2111748.png" alt="YouTube" style="margin: 0 5px;"></a>
            <a href="#"><img src="https://cdn-icons-png.flaticon.com/24/2111/2111532.png" alt="LinkedIn" style="margin: 0 5px;"></a>
            </div>
            <p style="font-size: 12px; color: #777;">Copyright © 2023</p>
        </td>
        </tr>
    </table>
    </body>
    </html>
  `
}

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
          html: buildInterventionEmailHtml({
            residenceName: residenceName ?? "",
            address: residenceAddress ?? emptyAddress,
            event,
            link,
          }),
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
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">
              {event ? event.title || "Sans titre" : loading ? "…" : "Intervention introuvable"}
            </h1>
            {event?.termine && (
              <Badge variant="outline" className="border-transparent bg-emerald-100 text-emerald-800">
                Terminé
              </Badge>
            )}
          </div>
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
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
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
              <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
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
