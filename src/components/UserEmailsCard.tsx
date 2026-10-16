import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { ArrowDownLeft, ArrowUpRight, Send } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { resolveUserLabels } from "@/lib/users"
import {
  emailKindLabel,
  fetchResidenceThreads,
  sendUserEmail,
  subscribeToUserEmails,
  type UserEmail,
} from "@/lib/userEmails"
import { cn, PRIMARY_CTA_CLASS } from "@/lib/utils"

const SOURCE_LABELS: Record<UserEmail["source"], string> = {
  konodal: "Konodal",
  fromUser: "Réponse de l'utilisateur",
  toSyndic: "Message au syndic",
  fromSyndic: "Réponse reçue",
  residence: "Résidence",
}

const EMPTY_CLASS = "rounded-[14px] bg-[oklch(97.5%_0.004_100)] p-[18px] text-[13.5px] text-[oklch(52%_0.01_150)]"
const TAG_CLASS = "rounded-[7px] bg-[oklch(95%_0.005_100)] px-2 py-0.5 font-bold text-[oklch(35%_0.01_150)]"

function formatDate(date: Date | null): string {
  if (!date) return "—"
  return `${date.toLocaleDateString("fr-FR")} à ${date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
}

// Échanges mails avec ce compte (lib/userEmails.ts) - visible par tous les
// rôles du BO ; les règles limitent agence/agent à leur portefeuille.
export function UserEmailsCard({
  uid,
  userName,
  residenceIds,
  lotIds,
  onCountChange,
}: {
  uid: string
  userName: string
  residenceIds: string[]
  lotIds: string[]
  // Compteur de l'onglet "Échanges" de la fiche utilisateur.
  onCountChange?: (count: number) => void
}) {
  const [logged, setLogged] = useState<UserEmail[]>([])
  const [threads, setThreads] = useState<UserEmail[]>([])
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const [authors, setAuthors] = useState<Map<string, string>>(new Map())
  const [opened, setOpened] = useState<UserEmail | null>(null)
  const [composing, setComposing] = useState(false)
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [sending, setSending] = useState(false)

  useEffect(() => {
    setLoading(true)
    setUnavailable(false)
    return subscribeToUserEmails(
      uid,
      (data) => {
        setLogged(data)
        setLoading(false)
      },
      // Pas de toast : journal illisible (règles pas encore déployées,
      // compte hors portefeuille) -> message discret dans la card.
      (error) => {
        console.warn("subscribeToUserEmails", error)
        setUnavailable(true)
        setLoading(false)
      }
    )
  }, [uid])

  const residenceKey = residenceIds.join(",")
  const lotKey = lotIds.join(",")
  useEffect(() => {
    let cancelled = false
    fetchResidenceThreads(uid, residenceKey ? residenceKey.split(",") : [], lotKey ? lotKey.split(",") : []).then(
      (data) => !cancelled && setThreads(data)
    )
    return () => {
      cancelled = true
    }
  }, [uid, residenceKey, lotKey])

  useEffect(() => {
    const uids = [...new Set(logged.map((e) => e.sentBy).filter((v): v is string => !!v))]
    if (uids.length === 0) return
    resolveUserLabels(uids).then(setAuthors)
  }, [logged])

  const emails = useMemo(
    () => [...logged, ...threads].sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0)),
    [logged, threads]
  )

  useEffect(() => {
    onCountChange?.(emails.length)
  }, [emails.length, onCountChange])

  async function handleSend() {
    setSending(true)
    try {
      await sendUserEmail(uid, subject.trim(), body.trim())
      toast.success("Mail envoyé")
      setComposing(false)
      setSubject("")
      setBody("")
    } catch (err) {
      toast.error("Envoi impossible : " + (err instanceof Error ? err.message : String(err)))
    } finally {
      setSending(false)
    }
  }

  return (
    <Card className="[--card-spacing:--spacing(7)]">
      <CardHeader>
        <CardTitle className="text-lg font-extrabold text-[oklch(22%_0.01_150)]">Échanges mails</CardTitle>
        <CardDescription className="max-w-[560px] leading-normal">
          Mails envoyés par Konodal à ce compte et ses réponses (depuis le 15/10/2026), et messages échangés avec le
          syndic depuis l'application. Réponses relevées plusieurs fois par jour.
        </CardDescription>
        <CardAction>
          <Button className={cn("h-10 rounded-[12px] px-[18px] text-[13px] font-bold", PRIMARY_CTA_CLASS)} onClick={() => setComposing(true)}>
            <Send />
            Écrire
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5">
        {loading && <p className={EMPTY_CLASS}>Chargement…</p>}
        {!loading && unavailable && (
          <p className={EMPTY_CLASS}>Historique des mails Konodal indisponible pour le moment.</p>
        )}
        {!loading && emails.length === 0 && !unavailable && <p className={EMPTY_CLASS}>Aucun mail pour l'instant.</p>}
        {emails.map((email) => {
          const incoming = email.source === "toSyndic" || email.source === "fromUser"
          const author = email.sentBy ? authors.get(email.sentBy) : null
          return (
            <button
              key={email.id}
              type="button"
              onClick={() => setOpened(email)}
              className="flex w-full min-w-0 items-center gap-3.5 rounded-[16px] border border-[oklch(93%_0.005_100)] p-[16px_18px] text-left hover:bg-[oklch(98%_0.004_100)]"
            >
              <span
                className={cn(
                  "flex size-[38px] shrink-0 items-center justify-center rounded-[12px]",
                  incoming ? "bg-sky-50 text-sky-600" : "bg-[oklch(95%_0.02_150)] text-[oklch(42%_0.08_155)]"
                )}
              >
                {incoming ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-bold text-[oklch(24%_0.01_150)]">
                    {email.subject || "(sans objet)"}
                  </span>
                  {!email.success && <Badge variant="destructive">Échec</Badge>}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[oklch(55%_0.01_150)]">
                  <span>{formatDate(email.date)}</span>
                  <span className={TAG_CLASS}>{author ? `BO : ${author}` : SOURCE_LABELS[email.source]}</span>
                  {emailKindLabel(email.kind) && email.kind !== "bo_message" && (
                    <span className={cn(TAG_CLASS, "bg-transparent font-semibold ring-1 ring-[oklch(92%_0.005_100)]")}>
                      {emailKindLabel(email.kind)}
                    </span>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </CardContent>

      <Dialog open={!!opened} onOpenChange={(open) => !open && setOpened(null)}>
        <DialogContent className="sm:max-w-2xl">
          <div className="flex max-h-[calc(100vh-3rem)] min-w-0 flex-col gap-4">
            <DialogHeader className="border-b border-[oklch(95%_0.003_100)] pb-4">
              <span className="text-[11.5px] font-bold tracking-wide text-primary uppercase">
                {opened ? SOURCE_LABELS[opened.source] : ""}
              </span>
              <DialogTitle>{opened?.subject || "(sans objet)"}</DialogTitle>
              <p className="text-xs text-muted-foreground">
                {formatDate(opened?.date ?? null)}
                {opened?.counterpart ? ` · ${opened.counterpart}` : ""}
                {opened && !opened.success && opened.error ? ` · Échec : ${opened.error}` : ""}
              </p>
            </DialogHeader>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden pr-4 pl-[5px]">
              {opened?.html ? (
                <iframe
                  title="Contenu du mail"
                  sandbox=""
                  srcDoc={opened.html}
                  className="h-[60vh] w-full rounded-lg border border-input bg-white"
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap">{opened?.text || "Contenu non disponible."}</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={composing} onOpenChange={setComposing}>
        <DialogContent className="sm:max-w-lg">
          <div className="flex max-h-[calc(100vh-3rem)] min-w-0 flex-col gap-4">
            <DialogHeader className="border-b border-[oklch(95%_0.003_100)] pb-4">
              <span className="text-[11.5px] font-bold tracking-wide text-primary uppercase">Mail</span>
              <DialogTitle>Écrire à {userName}</DialogTitle>
            </DialogHeader>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden pr-4 pl-[5px]">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="user-email-subject">Objet</Label>
                <Input id="user-email-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="user-email-body">Message</Label>
                <textarea
                  id="user-email-body"
                  rows={10}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
                <p className="text-xs text-muted-foreground">
                  Envoyé depuis support@konodal.com avec la mise en forme Konodal. « Bonjour Prénom, » est ajouté si le
                  message ne commence pas par « Bonjour ».
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setComposing(false)}>
                Annuler
              </Button>
              <Button
                disabled={sending || !subject.trim() || !body.trim()}
                onClick={handleSend}
                className={PRIMARY_CTA_CLASS}
              >
                <Send />
                Envoyer
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
