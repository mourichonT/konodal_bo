import { useState } from "react"
import { doc, getDoc } from "firebase/firestore"
import { CalendarClock, Check, HardHat, Mail, Megaphone, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { db } from "@/firebase"
import { useAuth } from "@/lib/auth-context"
import { createCommunication } from "@/lib/communications"
import { createEvent, GERANCE_PLACEHOLDER_LOGO_URL } from "@/lib/events"
import { sendInterventionEmail } from "@/lib/interventionEmail"
import { reportNodoActionResult, type NodoAction, type NodoActionEdit, type NodoActionStatus } from "@/lib/nodo"
import { updateSinistreInterventionDate, updateSinistreStatut } from "@/lib/sinistres"
import { sendUserEmail } from "@/lib/userEmails"
import { cn, PRIMARY_CTA_CLASS } from "@/lib/utils"
import { CONTACT_SERVICE_ICONS } from "@/types/contact"
import { emptyAddress, type Address } from "@/types/residence"

const ACTION_META = {
  communication: { icon: Megaphone, label: "Communication à publier" },
  event: { icon: CalendarClock, label: "Intervention à programmer" },
  email: { icon: Mail, label: "Mail à envoyer" },
  intervention: { icon: HardHat, label: "Intervention sur sinistre" },
} as const

const STATUS_LABEL = {
  done: "Fait",
  cancelled: "Annulée",
  error: "Échec",
} as const

const FIELD_CLASS =
  "w-full rounded-[10px] border border-[oklch(90%_0.008_150)] bg-white px-3 py-2 text-[13px] text-[oklch(26%_0.01_150)] outline-none focus:border-[oklch(45%_0.1_155)] disabled:bg-[oklch(97.5%_0.003_100)]"

// "2026-10-20T09:00:00+02:00" -> "2026-10-20T09:00" (input datetime-local,
// heure locale du navigateur = heure de Paris pour les utilisateurs du BO).
function toLocalInput(iso?: string): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// Action préparée par Nodo (propose_action) : rien n'est exécuté avant
// "Confirmer", et l'exécution passe par les mêmes fonctions que les écrans
// du BO, avec les droits de l'utilisateur connecté (firestore.rules,
// send_user_email) - Nodo n'écrit jamais lui-même.
export function NodoActionCard({
  action,
  conversationId,
  messageId,
}: {
  action: NodoAction
  conversationId: string
  messageId: string
}) {
  const { user } = useAuth()
  const { payload } = action
  const [title, setTitle] = useState(payload.title ?? payload.subject ?? "")
  const [body, setBody] = useState(payload.description ?? payload.body ?? "")
  const [eventDate, setEventDate] = useState(toLocalInput(payload.eventDate))
  const [prestaName, setPrestaName] = useState(payload.prestaName ?? "")
  const [message, setMessage] = useState(payload.message ?? "")
  const [busy, setBusy] = useState(false)
  // Statut local posé dès l'exécution : la carte ne doit plus être
  // confirmable même si le retour au serveur (reportNodoActionResult) échoue,
  // sinon un second clic publierait deux fois.
  const [localStatus, setLocalStatus] = useState<NodoActionStatus | null>(null)
  const status = action.status !== "pending" ? action.status : (localStatus ?? "pending")
  const meta = ACTION_META[action.type]
  const Icon = meta.icon
  const pending = status === "pending"
  const disabled = !pending || busy

  async function execute() {
    if (!user) return
    if (action.type === "communication") {
      await createCommunication(action.residenceId, user.uid, {
        title,
        description: body,
        audience: payload.audience === "proprietaires" ? "proprietaires" : "all",
        groupId: crypto.randomUUID(),
      })
      return `Communication « ${title} » publiée sur ${action.residenceName}.`
    }
    if (action.type === "event") {
      const date = new Date(eventDate)
      if (Number.isNaN(date.getTime())) throw new Error("Date d'intervention invalide")
      await createEvent(action.residenceId, user.uid, {
        title,
        description: body,
        eventDate: date,
        prestaName,
        pathImage: prestaName ? "" : GERANCE_PLACEHOLDER_LOGO_URL,
        audience: payload.audience === "proprietaires" ? "proprietaires" : "all",
      })
      return `Intervention « ${title} » programmée le ${date.toLocaleString("fr-FR")} sur ${action.residenceName}.`
    }
    if (action.type === "intervention") return executeIntervention(user.uid)
    await sendUserEmail(payload.recipientUid ?? "", title, body)
    return `Mail « ${title} » envoyé à ${payload.recipientName ?? "le résident"}.`
  }

  // Même enchaînement que "Programmer une intervention" (SinistreDetailPage)
  // puis "Envoyer au prestataire" (EvenementDetailPage), en un seul clic.
  async function executeIntervention(uid: string) {
    const date = new Date(eventDate)
    if (Number.isNaN(date.getTime())) throw new Error("Date d'intervention invalide")
    if (!payload.sinistreId || !payload.prestaMail) throw new Error("Sinistre ou email du prestataire manquant")
    const residenceSnap = await getDoc(doc(db, "residences", action.residenceId))
    const residence = residenceSnap.data() ?? {}
    const pathImage =
      CONTACT_SERVICE_ICONS[payload.prestaService as keyof typeof CONTACT_SERVICE_ICONS] ?? ""
    const event = { title, description: body, eventDate: date, prestaName: payload.prestaName ?? "", pathImage }
    const eventId = await createEvent(action.residenceId, uid, {
      ...event,
      linkedSinistreId: payload.sinistreId,
      locationElement: payload.locationElement || undefined,
      locationFloor: payload.locationFloor || undefined,
    })
    await updateSinistreInterventionDate(action.residenceId, payload.sinistreId, date)
    if (payload.sinistreStatut === "Transmis") {
      await updateSinistreStatut(action.residenceId, payload.sinistreId, "En cours")
    }
    try {
      await sendInterventionEmail({
        residenceId: action.residenceId,
        postId: eventId,
        residenceName: action.residenceName,
        address: (residence.address as Address | undefined) ?? emptyAddress,
        event,
        prestataireMail: payload.prestaMail,
        message,
      })
    } catch (error) {
      throw new Error(
        "Intervention créée mais email non envoyé (renvoyez-le depuis la fiche intervention) : " +
          (error instanceof Error ? error.message : String(error))
      )
    }
    return `Intervention programmée le ${date.toLocaleString("fr-FR")} avec ${payload.prestaName} (${payload.ticket}), ordre envoyé à ${payload.prestaMail}.`
  }

  // Champs modifiés par l'utilisateur : Nodo en tire des préférences
  // durables pour les prochains brouillons (mémoire de l'agence).
  function collectEdits(): NodoActionEdit[] {
    const pairs: [string, string | undefined, string][] = [
      [action.type === "email" ? "objet" : "titre", payload.title ?? payload.subject, title],
      [action.type === "intervention" ? "description" : "texte", payload.description ?? payload.body, body],
      ["date", toLocalInput(payload.eventDate), eventDate],
      ["message au prestataire", payload.message, message],
    ]
    return pairs
      .filter(([, proposed, final]) => proposed !== undefined && (proposed ?? "").trim() !== final.trim())
      .map(([field, proposed, final]) => ({ field, proposed: proposed ?? "", final }))
  }

  async function handleConfirm() {
    const missingText = action.type === "intervention" ? !message.trim() : !body.trim()
    if (!title.trim() || missingText) {
      toast.error(action.type === "intervention" ? "Le titre et le message sont obligatoires." : "Le titre et le texte sont obligatoires.")
      return
    }
    setBusy(true)
    try {
      const detail = await execute()
      setLocalStatus("done")
      toast.success(detail)
      await reportNodoActionResult(conversationId, messageId, action.id, "done", detail, collectEdits()).catch(
        () => undefined
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setLocalStatus("error")
      toast.error("Action impossible : " + message)
      await reportNodoActionResult(conversationId, messageId, action.id, "error", message).catch(() => undefined)
    } finally {
      setBusy(false)
    }
  }

  async function handleCancel() {
    setBusy(true)
    setLocalStatus("cancelled")
    await reportNodoActionResult(conversationId, messageId, action.id, "cancelled").catch(() => undefined)
    setBusy(false)
  }

  return (
    <div
      className={cn(
        "mt-2 rounded-[14px] border bg-white p-3",
        pending ? "border-[oklch(85%_0.05_155)]" : "border-[oklch(93%_0.005_100)] opacity-80"
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-[12.5px] font-bold text-[oklch(38%_0.07_152)]">
          <Icon className="size-4 shrink-0" />
          <span className="truncate">
            {meta.label} · {action.residenceName}
          </span>
        </div>
        {!pending && (
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold",
              status === "done" && "bg-[oklch(93%_0.05_150)] text-[oklch(36%_0.09_155)]",
              status === "cancelled" && "bg-[oklch(95%_0.005_100)] text-[oklch(45%_0.01_150)]",
              status === "error" && "bg-red-50 text-red-700"
            )}
          >
            {STATUS_LABEL[status as keyof typeof STATUS_LABEL]}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {action.type === "email" && (
          <div className="text-xs text-[oklch(50%_0.01_150)]">
            À : <b className="text-[oklch(26%_0.01_150)]">{payload.recipientName}</b> ({payload.recipientEmail})
          </div>
        )}
        {action.type === "intervention" && (
          <div className="flex flex-col gap-1 rounded-[10px] bg-[oklch(97.5%_0.006_155)] px-3 py-2 text-xs text-[oklch(40%_0.01_150)]">
            <div>
              Sinistre <b className="text-[oklch(26%_0.01_150)]">{payload.ticket}</b> · {payload.sinistreTitle}
            </div>
            <div>
              Prestataire : <b className="text-[oklch(26%_0.01_150)]">{payload.prestaName}</b> ({payload.prestaService}) ·{" "}
              {payload.prestaMail}
            </div>
            {payload.reason && <div className="text-[oklch(50%_0.01_150)]">{payload.reason}</div>}
          </div>
        )}
        <Input
          className={FIELD_CLASS}
          value={title}
          disabled={disabled}
          placeholder={action.type === "email" ? "Objet" : "Titre"}
          onChange={(e) => setTitle(e.target.value)}
        />
        {action.type === "intervention" && (
          <input
            type="datetime-local"
            className={FIELD_CLASS}
            value={eventDate}
            disabled={disabled}
            onChange={(e) => setEventDate(e.target.value)}
          />
        )}
        {action.type === "event" && (
          <div className="flex gap-2">
            <input
              type="datetime-local"
              className={FIELD_CLASS}
              value={eventDate}
              disabled={disabled}
              onChange={(e) => setEventDate(e.target.value)}
            />
            <Input
              className={FIELD_CLASS}
              value={prestaName}
              disabled={disabled}
              placeholder="Prestataire"
              onChange={(e) => setPrestaName(e.target.value)}
            />
          </div>
        )}
        <textarea
          className={cn(FIELD_CLASS, action.type === "intervention" ? "min-h-16 resize-y" : "min-h-28 resize-y")}
          value={body}
          disabled={disabled}
          placeholder={action.type === "intervention" ? "Description de l'intervention" : undefined}
          onChange={(e) => setBody(e.target.value)}
        />
        {action.type === "intervention" && (
          <textarea
            className={cn(FIELD_CLASS, "min-h-32 resize-y")}
            value={message}
            disabled={disabled}
            placeholder="Message au prestataire"
            onChange={(e) => setMessage(e.target.value)}
          />
        )}
        {payload.audience === "proprietaires" && action.type !== "email" && (
          <div className="text-xs text-[oklch(50%_0.01_150)]">Visible par les propriétaires uniquement.</div>
        )}
        {action.detail && !pending && <div className="text-xs text-[oklch(50%_0.01_150)]">{action.detail}</div>}
      </div>

      {pending && (
        <div className="mt-3 flex justify-end gap-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={handleCancel} className="rounded-[10px] font-bold">
            <X />
            Annuler
          </Button>
          <Button
            size="sm"
            disabled={busy}
            onClick={handleConfirm}
            className={cn("rounded-[10px] font-bold", PRIMARY_CTA_CLASS)}
          >
            <Check />
            Confirmer
          </Button>
        </div>
      )}
    </div>
  )
}
