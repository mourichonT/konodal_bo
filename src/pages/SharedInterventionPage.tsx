import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { CalendarClock, FileText, Video } from "lucide-react"
import logoHorizontalWhite from "@/assets/logo-horizontal.png"
import { DateInput } from "@/components/DateInput"
import { DESCRIPTION_MAX_LENGTH } from "@/components/DescriptionTextarea"
import { useManropeFont } from "@/hooks/useManropeFont"
import { CARD_SHADOW, CTA_GRADIENT, CTA_SHADOW } from "@/lib/utils"

const FUNCTIONS_BASE = `https://europe-west9-${import.meta.env.VITE_FIREBASE_PROJECT_ID}.cloudfunctions.net`
const GET_SHARED_INTERVENTION_URL = `${FUNCTIONS_BASE}/get_shared_intervention`
const CREATE_SHARED_RAPPORT_URL = `${FUNCTIONS_BASE}/create_shared_rapport`
const RESCHEDULE_SHARED_INTERVENTION_URL = `${FUNCTIONS_BASE}/reschedule_shared_intervention`
const REVOKE_SHARED_TOKEN_URL = `${FUNCTIONS_BASE}/revoke_shared_token`

type SharedIntervention = {
  title: string
  description: string
  eventDate: string | null
  previousEventDate: string | null
  prestaName: string
  pathImage: string
}

function formatEventDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })
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
  isVideo: boolean
  creationDate: string | null
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

const EYEBROW_CLASS = "mb-3.5 text-xs font-bold tracking-wide text-[oklch(52%_0.01_150)] uppercase"
const CARD_CLASS = "rounded-[20px] border border-[oklch(93%_0.005_100)] bg-white p-5 sm:p-6"
const FIELD_LABEL_CLASS = "mb-1.5 block text-[12.5px] font-bold text-[oklch(38%_0.09_155)]"
const FIELD_CLASS =
  "w-full box-border rounded-[11px] border border-[oklch(88%_0.01_150)] px-3.5 py-2.5 text-[13.5px] text-[oklch(24%_0.01_150)] outline-none focus:border-[oklch(55%_0.1_155)] focus:ring-3 focus:ring-[oklch(55%_0.1_155/0.14)]"
const SUB_CARD_CLASS = "rounded-2xl border border-[oklch(92%_0.005_100)] p-4"

export default function SharedInterventionPage() {
  useManropeFont()
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<SharedData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [rescheduling, setRescheduling] = useState(false)
  const [rescheduleDate, setRescheduleDate] = useState("")
  const [rescheduleTime, setRescheduleTime] = useState("")
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false)
  const [rescheduleError, setRescheduleError] = useState<string | null>(null)

  const [rapportTitle, setRapportTitle] = useState("")
  const [rapportDescription, setRapportDescription] = useState("")
  const [rapportFile, setRapportFile] = useState<File | null>(null)
  const [rapportSubmitting, setRapportSubmitting] = useState(false)
  const [rapportError, setRapportError] = useState<string | null>(null)
  const [rapportSubmitted, setRapportSubmitted] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  // Une fois le rapport transmis, il n'y a plus rien à faire sur cette page
  // - on révoque le lien dès sa fermeture pour qu'il ne soit pas réutilisable
  // ensuite. sendBeacon (pas fetch) : seul moyen fiable d'envoyer une requête
  // depuis un handler pagehide/beforeunload (un fetch normal peut être
  // annulé avant d'aboutir si la page se ferme entre-temps). Le token est
  // envoyé en texte brut (pas un Blob JSON) : "text/plain" fait partie des
  // content-types CORS "simples", donc pas de préflight OPTIONS - un Blob
  // "application/json" en déclenche un, peu fiable dans la fenêtre de temps
  // très courte d'un beacon envoyé pendant la fermeture de la page.
  useEffect(() => {
    if (!rapportSubmitted || !token) return
    function revokeToken() {
      navigator.sendBeacon(REVOKE_SHARED_TOKEN_URL, token)
    }
    window.addEventListener("pagehide", revokeToken)
    window.addEventListener("beforeunload", revokeToken)
    return () => {
      window.removeEventListener("pagehide", revokeToken)
      window.removeEventListener("beforeunload", revokeToken)
    }
  }, [rapportSubmitted, token])

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

  async function handleSubmitRapport(event: FormEvent) {
    event.preventDefault()
    if (!token) return
    if (!rapportFile) {
      setRapportError("Une photo est requise.")
      return
    }
    setRapportSubmitting(true)
    setRapportError(null)
    try {
      const formData = new FormData()
      formData.append("token", token)
      formData.append("title", rapportTitle)
      formData.append("description", rapportDescription)
      formData.append("file", rapportFile)

      const response = await fetch(CREATE_SHARED_RAPPORT_URL, {
        method: "POST",
        body: formData,
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Envoi impossible.")
      setRapportTitle("")
      setRapportDescription("")
      setRapportFile(null)
      setRapportSubmitted(true)
    } catch (err) {
      setRapportError((err as Error).message)
    } finally {
      setRapportSubmitting(false)
    }
  }

  return (
    <div
      className="flex min-h-svh justify-center px-4 py-6 pb-16 sm:px-6"
      style={{ background: "oklch(97% 0.005 100)", fontFamily: "'Manrope', system-ui, sans-serif" }}
    >
      <div className="flex w-full max-w-[480px] flex-col gap-4">
        <div
          className="relative overflow-hidden rounded-[20px] px-6 py-6 sm:px-7"
          style={{
            background:
              "linear-gradient(150deg, oklch(30% 0.05 155) 0%, oklch(42% 0.075 152) 55%, oklch(48% 0.09 148) 100%)",
            boxShadow: "0 16px 40px -16px oklch(30% 0.05 155 / 0.45)",
          }}
        >
          <div
            className="pointer-events-none absolute -top-[50px] -right-[50px] h-[180px] w-[180px] rounded-full"
            style={{ background: "radial-gradient(circle, oklch(70% 0.1 145 / 0.18), transparent 70%)" }}
          />
          <div className="relative flex items-center">
            <img src={logoHorizontalWhite} alt="Konodal" className="block h-6 w-auto" />
          </div>
          <h1 className="relative mt-[30px] mb-0 text-[26px] leading-none font-extrabold tracking-tight text-white">
            Intervention
          </h1>
        </div>

        {loading && <p className="text-center text-sm text-[oklch(55%_0.01_150)]">Chargement…</p>}
        {error && (
          <div className={CARD_CLASS} style={{ boxShadow: CARD_SHADOW }}>
            <p className="m-0 text-sm text-destructive">{error}</p>
          </div>
        )}

        {data && (
          <>
            <div className={CARD_CLASS} style={{ boxShadow: CARD_SHADOW }}>
              <h2 className="mt-0 mb-3.5 text-[15.5px] font-bold text-[oklch(38%_0.09_155)]">
                {data.intervention.title || "Sans titre"}
              </h2>
              <div className="mb-2.5 text-[13px] font-semibold text-[oklch(38%_0.01_150)]">
                {data.residence.name || "—"} — {formatAddress(data.residence.address)}
              </div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-semibold text-[oklch(52%_0.01_150)]">Prestataire : </span>
                  <span className="text-[13px] font-bold text-[oklch(24%_0.01_150)]">
                    {data.intervention.prestaName || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-[oklch(52%_0.01_150)]">Date : </span>
                  {data.intervention.previousEventDate && (
                    <span className="mr-1 text-[13px] font-bold text-[oklch(60%_0.005_100)] line-through">
                      {formatEventDateTime(data.intervention.previousEventDate)}
                    </span>
                  )}
                  <span className="text-[13px] font-bold text-[oklch(24%_0.01_150)]">
                    {data.intervention.eventDate ? formatEventDateTime(data.intervention.eventDate) : "—"}
                  </span>
                </div>
              </div>
              <div className="mb-1 text-xs font-semibold text-[oklch(52%_0.01_150)]">Description :</div>
              <div className="text-[13px] text-[oklch(65%_0.005_100)] italic">
                {data.intervention.description || "Aucune description."}
              </div>
            </div>

            {data.sinistre && (
              <div className={CARD_CLASS} style={{ boxShadow: CARD_SHADOW }}>
                <div className={EYEBROW_CLASS}>Ticket lié</div>
                <div className="mb-3.5 text-[15px] font-bold text-[oklch(22%_0.01_150)]">
                  {data.sinistre.title || "Sans titre"}
                </div>

                <div className="mb-4 flex flex-wrap items-center gap-6">
                  <div>
                    <div className="mb-1 text-[11.5px] font-semibold text-[oklch(52%_0.01_150)]">Statut</div>
                    <span className="rounded-full bg-[oklch(93%_0.06_235)] px-2.5 py-1 text-xs font-bold text-[oklch(38%_0.13_235)]">
                      {data.sinistre.statut || "—"}
                    </span>
                  </div>
                  <div>
                    <div className="mb-1 text-[11.5px] font-semibold text-[oklch(52%_0.01_150)]">Localisation</div>
                    <div className="text-[13px] font-bold text-[oklch(24%_0.01_150)]">
                      {[data.sinistre.locationElement, data.sinistre.locationFloor].filter(Boolean).join(" — ") ||
                        "—"}
                    </div>
                  </div>
                </div>

                {(data.sinistre.pathImage || data.sinistre.creationDate || data.sinistre.description) && (
                  <div className={`${SUB_CARD_CLASS} mb-4`}>
                    <div className="mb-2 text-sm font-bold text-[oklch(22%_0.01_150)]">Déclaration principale</div>
                    {data.sinistre.description && (
                      <p className="m-0 mb-3 text-[13px] leading-relaxed text-[oklch(48%_0.01_150)]">
                        {data.sinistre.description}
                      </p>
                    )}
                    {data.sinistre.pathImage &&
                      (data.sinistre.isVideo ? (
                        <video src={data.sinistre.pathImage} controls className="block w-full rounded-[10px]" />
                      ) : (
                        <img
                          src={data.sinistre.pathImage}
                          alt={data.sinistre.title}
                          className="block w-full rounded-[10px] object-cover"
                        />
                      ))}
                    {data.sinistre.creationDate && (
                      <div className="mt-2 text-[11.5px] font-semibold text-[oklch(60%_0.005_100)]">
                        {new Date(data.sinistre.creationDate).toLocaleDateString("fr-FR")}
                      </div>
                    )}
                  </div>
                )}

                {data.sinistre.signalements.map((s, i) => (
                  <div key={i} className={`${SUB_CARD_CLASS} mb-4`}>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-[oklch(22%_0.01_150)]">{s.title || "Sans titre"}</span>
                      {s.isVideo && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[oklch(93%_0.06_235)] px-2.5 py-0.5 text-xs font-bold text-[oklch(38%_0.13_235)]">
                          <Video className="h-3 w-3" />
                          Vidéo
                        </span>
                      )}
                    </div>
                    {s.description && (
                      <p className="m-0 mb-3 text-[13px] leading-relaxed text-[oklch(48%_0.01_150)]">
                        {s.description}
                      </p>
                    )}
                    {s.pathImage &&
                      (s.isVideo ? (
                        <video src={s.pathImage} controls className="block w-full rounded-[10px]" />
                      ) : (
                        <img
                          src={s.pathImage}
                          alt={s.title}
                          className="block w-full rounded-[10px] object-cover"
                        />
                      ))}
                    {s.creationDate && (
                      <div className="mt-2 text-[11.5px] font-semibold text-[oklch(60%_0.005_100)]">
                        {new Date(s.creationDate).toLocaleDateString("fr-FR")}
                      </div>
                    )}
                  </div>
                ))}

                <p className="m-0 text-xs leading-relaxed text-[oklch(55%_0.01_150)]">
                  La déclaration et la clôture de ce ticket se font désormais via le compte-rendu ci-dessous.
                </p>
              </div>
            )}

            {rapportSubmitted ? (
              <div className={CARD_CLASS} style={{ boxShadow: CARD_SHADOW }}>
                <p className="m-0 text-sm text-[oklch(52%_0.01_150)]">Compte-rendu transmis, merci.</p>
              </div>
            ) : (
              <>
                <div className={CARD_CLASS} style={{ boxShadow: CARD_SHADOW }}>
                  <div className={EYEBROW_CLASS}>Suite de l'intervention</div>

                  {data.intervention.previousEventDate && (
                    <div className={`${SUB_CARD_CLASS} mb-4 bg-[oklch(97.5%_0.005_100)]`}>
                      <p className="m-0 text-[13px]">
                        <span className="mr-1 text-[oklch(60%_0.005_100)] line-through">
                          {formatEventDateTime(data.intervention.previousEventDate)}
                        </span>
                        {data.intervention.eventDate && (
                          <span className="font-bold text-[oklch(24%_0.01_150)]">
                            {formatEventDateTime(data.intervention.eventDate)}
                          </span>
                        )}
                      </p>
                      <p className="mt-1 mb-0 text-xs text-[oklch(55%_0.01_150)]">
                        Ce lien correspond à cette nouvelle date : conservez-le, c'est celui à utiliser pour la suite
                        (compte-rendu, nouvelle reprogrammation).
                      </p>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={rescheduleSubmitting}
                    onClick={() => setRescheduling((v) => !v)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-[oklch(88%_0.01_150)] bg-white px-4 py-3 text-[13.5px] font-bold text-[oklch(35%_0.01_150)] disabled:opacity-60"
                  >
                    <CalendarClock className="h-[15px] w-[15px]" />
                    {data.intervention.previousEventDate ? "Modifier le nouvel horaire" : "Reprogrammer un passage"}
                  </button>

                  {rescheduling && (
                    <form onSubmit={handleReschedule} className="mt-3 flex flex-wrap items-end gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className={FIELD_LABEL_CLASS}>Nouvelle date</label>
                        <DateInput value={rescheduleDate} onChange={setRescheduleDate} className={FIELD_CLASS} />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="reschedule-time" className={FIELD_LABEL_CLASS}>
                          Heure (optionnel)
                        </label>
                        <input
                          id="reschedule-time"
                          type="time"
                          value={rescheduleTime}
                          onChange={(e) => setRescheduleTime(e.target.value)}
                          className={FIELD_CLASS}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={rescheduleSubmitting || !rescheduleDate}
                        className="rounded-xl px-5 py-2.5 text-[13.5px] font-bold text-white disabled:opacity-60"
                        style={{ background: CTA_GRADIENT, boxShadow: CTA_SHADOW }}
                      >
                        Confirmer
                      </button>
                      {rescheduleError && <p className="m-0 w-full text-sm text-destructive">{rescheduleError}</p>}
                    </form>
                  )}
                </div>

                <div className={CARD_CLASS} style={{ boxShadow: CARD_SHADOW }}>
                  <div className={EYEBROW_CLASS}>Ajouter un compte-rendu</div>

                  <form onSubmit={handleSubmitRapport} className="flex flex-col gap-4">
                    <div>
                      <label htmlFor="rapport-title" className={FIELD_LABEL_CLASS}>
                        Titre
                      </label>
                      <input
                        id="rapport-title"
                        required
                        value={rapportTitle}
                        onChange={(e) => setRapportTitle(e.target.value)}
                        className={FIELD_CLASS}
                      />
                    </div>

                    <div>
                      <label htmlFor="rapport-desc" className={FIELD_LABEL_CLASS}>
                        Description
                      </label>
                      <textarea
                        id="rapport-desc"
                        rows={4}
                        maxLength={DESCRIPTION_MAX_LENGTH}
                        value={rapportDescription}
                        onChange={(e) => setRapportDescription(e.target.value)}
                        className={`${FIELD_CLASS} resize-y font-[inherit]`}
                      />
                      <div className="mt-1 text-right text-[11px] font-semibold text-[oklch(65%_0.005_100)]">
                        {rapportDescription.length}/{DESCRIPTION_MAX_LENGTH}
                      </div>
                    </div>

                    <div>
                      <label className={FIELD_LABEL_CLASS}>Photo</label>
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="rounded-[10px] border border-[oklch(88%_0.01_150)] bg-[oklch(98%_0.003_100)] px-4 py-2 text-[12.5px] font-bold whitespace-nowrap text-[oklch(35%_0.01_150)]"
                        >
                          Parcourir…
                        </button>
                        <span className="text-[12.5px] font-semibold text-[oklch(60%_0.005_100)]">
                          {rapportFile ? rapportFile.name : "Aucun fichier sélectionné"}
                        </span>
                        <input
                          ref={fileInputRef}
                          type="file"
                          required
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => setRapportFile(e.target.files?.[0] ?? null)}
                          className="hidden"
                        />
                      </div>
                    </div>

                    {rapportError && <p className="m-0 text-sm text-destructive">{rapportError}</p>}

                    <button
                      type="submit"
                      disabled={rapportSubmitting}
                      className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-bold text-white disabled:opacity-60"
                      style={{ background: CTA_GRADIENT, boxShadow: CTA_SHADOW }}
                    >
                      <FileText className="h-[15px] w-[15px]" />
                      Envoyer
                    </button>
                  </form>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
