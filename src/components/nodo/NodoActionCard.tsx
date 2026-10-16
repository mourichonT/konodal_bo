import { useState } from "react"
import { CalendarClock, Check, Mail, Megaphone, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/lib/auth-context"
import { createCommunication } from "@/lib/communications"
import { createEvent, GERANCE_PLACEHOLDER_LOGO_URL } from "@/lib/events"
import { reportNodoActionResult, type NodoAction, type NodoActionStatus } from "@/lib/nodo"
import { sendUserEmail } from "@/lib/userEmails"
import { cn, PRIMARY_CTA_CLASS } from "@/lib/utils"

const ACTION_META = {
  communication: { icon: Megaphone, label: "Communication à publier" },
  event: { icon: CalendarClock, label: "Intervention à programmer" },
  email: { icon: Mail, label: "Mail à envoyer" },
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
    await sendUserEmail(payload.recipientUid ?? "", title, body)
    return `Mail « ${title} » envoyé à ${payload.recipientName ?? "le résident"}.`
  }

  async function handleConfirm() {
    if (!title.trim() || !body.trim()) {
      toast.error("Le titre et le texte sont obligatoires.")
      return
    }
    setBusy(true)
    try {
      const detail = await execute()
      setLocalStatus("done")
      toast.success(detail)
      await reportNodoActionResult(conversationId, messageId, action.id, "done", detail).catch(() => undefined)
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
        <Input
          className={FIELD_CLASS}
          value={title}
          disabled={disabled}
          placeholder={action.type === "email" ? "Objet" : "Titre"}
          onChange={(e) => setTitle(e.target.value)}
        />
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
          className={cn(FIELD_CLASS, "min-h-28 resize-y")}
          value={body}
          disabled={disabled}
          onChange={(e) => setBody(e.target.value)}
        />
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
