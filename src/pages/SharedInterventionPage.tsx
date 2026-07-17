import { useCallback, useEffect, useState, type FormEvent } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { CalendarClock, CheckCircle2, Video } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { DateInput } from "@/components/DateInput"

const GET_SHARED_INTERVENTION_URL =
  "https://us-central1-konodal-dev.cloudfunctions.net/get_shared_intervention"
const CREATE_SHARED_SIGNALEMENT_URL =
  "https://us-central1-konodal-dev.cloudfunctions.net/create_shared_signalement"
const COMPLETE_SHARED_INTERVENTION_URL =
  "https://us-central1-konodal-dev.cloudfunctions.net/complete_shared_intervention"
const RESCHEDULE_SHARED_INTERVENTION_URL =
  "https://us-central1-konodal-dev.cloudfunctions.net/reschedule_shared_intervention"

type SharedIntervention = {
  title: string
  description: string
  eventDate: string | null
  prestaName: string
  pathImage: string
}

type SharedAddress = {
  street?: string
  complement?: string
  zipCode?: string
  city?: string
}

type SharedResidence = {
  name: string
  address: SharedAddress
}

type SharedSignalement = {
  title: string
  description: string
  pathImage: string
  isVideo: boolean
  creationDate: string | null
}

type SharedSinistre = {
  title: string
  description: string
  statut: string
  locationElement: string
  locationFloor: string
  pathImage: string
  signalements: SharedSignalement[]
}

type SharedData = {
  intervention: SharedIntervention
  residence: SharedResidence
  sinistre: SharedSinistre | null
}

function formatAddress(address: SharedAddress): string {
  const line1 = [address.street, address.complement].filter(Boolean).join(", ")
  const line2 = [address.zipCode, address.city].filter(Boolean).join(" ")
  return [line1, line2].filter(Boolean).join(" — ") || "—"
}

export default function SharedInterventionPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<SharedData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const [completing, setCompleting] = useState(false)
  const [completeError, setCompleteError] = useState<string | null>(null)

  const [rescheduling, setRescheduling] = useState(false)
  const [rescheduleDate, setRescheduleDate] = useState("")
  const [rescheduleTime, setRescheduleTime] = useState("")
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false)
  const [rescheduleError, setRescheduleError] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!token) return
    setLoading(true)
    setError(null)
    fetch(`${GET_SHARED_INTERVENTION_URL}?token=${encodeURIComponent(token)}`)
      .then(async (response) => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || "Ce lien n'est plus valide ou a expiré.")
        setData(body as SharedData)
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const isTerminated = data?.sinistre?.statut === "Terminé"

  async function handleSubmitSignalement(event: FormEvent) {
    event.preventDefault()
    if (!token) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const formData = new FormData()
      formData.append("token", token)
      formData.append("title", title)
      formData.append("description", description)
      if (file) formData.append("file", file)

      const response = await fetch(CREATE_SHARED_SIGNALEMENT_URL, {
        method: "POST",
        body: formData,
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Envoi impossible.")
      setTitle("")
      setDescription("")
      setFile(null)
      setSubmitted(true)
      load()
    } catch (err) {
      setSubmitError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleComplete() {
    if (!token) return
    setCompleting(true)
    setCompleteError(null)
    try {
      const response = await fetch(COMPLETE_SHARED_INTERVENTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Impossible de clôturer l'intervention.")
      load()
    } catch (err) {
      setCompleteError((err as Error).message)
    } finally {
      setCompleting(false)
    }
  }

  async function handleReschedule(event: FormEvent) {
    event.preventDefault()
    if (!token || !rescheduleDate) return
    setRescheduleSubmitting(true)
    setRescheduleError(null)
    try {
      const eventDate = new Date(`${rescheduleDate}T${rescheduleTime || "00:00"}`)
      const response = await fetch(RESCHEDULE_SHARED_INTERVENTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, eventDate: eventDate.toISOString() }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Impossible de reprogrammer.")
      navigate(`/partage/${body.newToken}`, { replace: true })
    } catch (err) {
      setRescheduleError((err as Error).message)
    } finally {
      setRescheduleSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-2xl flex-col gap-6 p-4 py-10">
      <h1 className="text-xl font-semibold">Konodal — Intervention</h1>

      {loading && <p className="text-muted-foreground">Chargement…</p>}
      {error && <p className="text-destructive">{error}</p>}

      {data && (
        <>
          <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
            <CardHeader>
              <CardTitle className="text-base">Intervention</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
              <div className="sm:col-span-2">
                <span className="text-muted-foreground">Titre : </span>
                {data.intervention.title || "Sans titre"}
              </div>
              <div>
                <span className="text-muted-foreground">Prestataire : </span>
                {data.intervention.prestaName || "—"}
              </div>
              <div>
                <span className="text-muted-foreground">Date : </span>
                {data.intervention.eventDate
                  ? new Date(data.intervention.eventDate).toLocaleString("fr-FR", {
                      dateStyle: "long",
                      timeStyle: "short",
                    })
                  : "—"}
              </div>
              <div className="flex flex-col sm:col-span-2">
                <span className="text-muted-foreground">Description :</span>
                <span className="mt-[10px]">{data.intervention.description || "Aucune description."}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
            <CardHeader>
              <CardTitle className="text-base">Résidence</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <div>{data.residence.name || "—"}</div>
              <div className="text-muted-foreground">{formatAddress(data.residence.address)}</div>
            </CardContent>
          </Card>

          {data.sinistre && (
            <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
              <CardHeader>
                <CardTitle className="text-base">Ticket lié</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 text-sm">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground">Titre : </span>
                    {data.sinistre.title || "Sans titre"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Statut : </span>
                    <Badge variant="outline">{data.sinistre.statut || "—"}</Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Localisation : </span>
                    {[data.sinistre.locationElement, data.sinistre.locationFloor]
                      .filter(Boolean)
                      .join(" — ") || "—"}
                  </div>
                  <div className="flex flex-col sm:col-span-2">
                    <span className="text-muted-foreground">Description :</span>
                    <span className="mt-[10px]">{data.sinistre.description || "Aucune description."}</span>
                  </div>
                </div>

                {data.sinistre.signalements.length > 0 && (
                  <div className="flex flex-col gap-3 border-t border-border pt-4">
                    <span className="text-muted-foreground">Déclarations</span>
                    {data.sinistre.signalements.map((s, i) => (
                      <div key={i} className="rounded-lg border border-border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{s.title || "Sans titre"}</span>
                          {s.isVideo && (
                            <Badge variant="outline">
                              <Video />
                              Vidéo
                            </Badge>
                          )}
                        </div>
                        {s.description && <p className="mt-1 text-muted-foreground">{s.description}</p>}
                        {s.pathImage &&
                          (s.isVideo ? (
                            <video src={s.pathImage} controls className="mt-2 max-h-64 rounded-lg" />
                          ) : (
                            <img src={s.pathImage} alt={s.title} className="mt-2 max-h-64 rounded-lg object-cover" />
                          ))}
                        {s.creationDate && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {new Date(s.creationDate).toLocaleDateString("fr-FR")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-col gap-3 border-t border-border pt-4">
                  <span className="text-muted-foreground">Ajouter une déclaration</span>
                  <form onSubmit={handleSubmitSignalement} className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="signalement-title">Titre</Label>
                      <Input
                        id="signalement-title"
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="signalement-desc">Description</Label>
                      <textarea
                        id="signalement-desc"
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full min-w-0 resize-none rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="signalement-file">Photo ou vidéo (optionnel)</Label>
                      <input
                        id="signalement-file"
                        type="file"
                        accept="image/*,video/*"
                        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                        className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm"
                      />
                    </div>
                    {submitError && <p className="text-sm text-destructive">{submitError}</p>}
                    {submitted && !submitError && (
                      <p className="text-sm text-emerald-600">Déclaration envoyée, merci.</p>
                    )}
                    <Button type="submit" disabled={submitting} className="w-fit">
                      Envoyer
                    </Button>
                  </form>
                </div>

                {!isTerminated && (
                  <div className="flex flex-col gap-3 border-t border-border pt-4">
                    <span className="text-muted-foreground">Suite de l'intervention</span>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={completing}
                        onClick={handleComplete}
                        className="w-fit"
                      >
                        <CheckCircle2 />
                        Marquer l'intervention comme terminée
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={rescheduleSubmitting}
                        onClick={() => setRescheduling((v) => !v)}
                        className="w-fit"
                      >
                        <CalendarClock />
                        Reprogrammer un passage
                      </Button>
                    </div>
                    {completeError && <p className="text-sm text-destructive">{completeError}</p>}

                    {rescheduling && (
                      <form
                        onSubmit={handleReschedule}
                        className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-3"
                      >
                        <div className="flex flex-col gap-1.5">
                          <Label>Nouvelle date</Label>
                          <DateInput value={rescheduleDate} onChange={setRescheduleDate} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="reschedule-time">Heure (optionnel)</Label>
                          <input
                            id="reschedule-time"
                            type="time"
                            value={rescheduleTime}
                            onChange={(e) => setRescheduleTime(e.target.value)}
                            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                          />
                        </div>
                        <Button type="submit" disabled={rescheduleSubmitting || !rescheduleDate}>
                          Confirmer
                        </Button>
                        {rescheduleError && <p className="w-full text-sm text-destructive">{rescheduleError}</p>}
                      </form>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
