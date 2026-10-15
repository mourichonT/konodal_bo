import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { ArrowDownLeft, ArrowUpRight, Mail, Send } from "lucide-react"
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
import { PRIMARY_CTA_CLASS } from "@/lib/utils"

const SOURCE_LABELS: Record<UserEmail["source"], string> = {
  konodal: "Konodal",
  toSyndic: "Message au syndic",
  fromSyndic: "Réponse reçue",
  residence: "Résidence",
}

function formatDate(date: Date | null): string {
  if (!date) return "—"
  return `${date.toLocaleDateString("fr-FR")} ${date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
}

// Échanges mails avec ce compte (lib/userEmails.ts) - visible par tous les
// rôles du BO ; les règles limitent agence/agent à leur portefeuille.
export function UserEmailsCard({
  uid,
  userName,
  residenceIds,
  lotIds,
}: {
  uid: string
  userName: string
  residenceIds: string[]
  lotIds: string[]
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Mail className="size-4" />
          Échanges mails
        </CardTitle>
        <CardDescription>
          Mails envoyés par Konodal à ce compte (enregistrés depuis le 15/10/2026) et messages échangés avec le
          syndic depuis l'application.
        </CardDescription>
        <CardAction>
          <Button size="sm" className={PRIMARY_CTA_CLASS} onClick={() => setComposing(true)}>
            <Send />
            Écrire
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {loading && <p className="text-sm text-muted-foreground">Chargement…</p>}
        {!loading && unavailable && (
          <p className="text-sm text-muted-foreground">Historique des mails Konodal indisponible pour le moment.</p>
        )}
        {!loading && emails.length === 0 && !unavailable && (
          <p className="text-sm text-muted-foreground">Aucun mail pour l'instant.</p>
        )}
        {emails.map((email) => {
          const incoming = email.source === "toSyndic"
          const author = email.sentBy ? authors.get(email.sentBy) : null
          return (
            <button
              key={email.id}
              type="button"
              onClick={() => setOpened(email)}
              className="flex w-full min-w-0 items-start gap-3 rounded-lg px-2 py-2 text-left hover:bg-muted"
            >
              {incoming ? (
                <ArrowDownLeft className="mt-0.5 size-4 shrink-0 text-sky-600" />
              ) : (
                <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-primary" />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-medium">{email.subject || "(sans objet)"}</span>
                  {!email.success && <Badge variant="destructive">Échec</Badge>}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span>{formatDate(email.date)}</span>
                  <Badge variant="secondary">{author ? `BO : ${author}` : SOURCE_LABELS[email.source]}</Badge>
                  {emailKindLabel(email.kind) && email.kind !== "bo_message" && (
                    <Badge variant="outline">{emailKindLabel(email.kind)}</Badge>
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
