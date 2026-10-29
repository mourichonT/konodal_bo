import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Search, Send, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar } from "@/components/agency/agencyUi"
import { emailInitials } from "@/lib/licences"
import { subscribeToLots } from "@/lib/lots"
import { writeToResident } from "@/lib/messages"
import { resolveUsersByUids } from "@/lib/users"
import { cn, PRIMARY_CTA_CLASS } from "@/lib/utils"
import { lotDisplayLabel, type Lot } from "@/types/lot"
import type { Residence } from "@/types/residence"
import type { KonodalUser } from "@/types/user"

const TOPIC_MAX = 120
const TEXT_MAX = 5000
const FIELD_CLASS = "h-10 rounded-[10px] bg-white"

// Propriétaire et le lot choisi pour la conversation (clé de fil du lot).
type Recipient = { uid: string; lotId: string }

function fold(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

// « Nouveau message » de la page Messages : le syndic écrit le premier à un
// résident (write_to_resident). À : un propriétaire d'une résidence, avec son
// lot ; objet et message. La copie part à l'adresse du compte qui écrit, sans
// champ Cc (l'agence le sait). Le message ouvre une conversation dans l'app
// du résident, qui peut y répondre.
export function NewMessageDialog({
  open,
  onOpenChange,
  residences,
  defaultResidenceId,
  onSent,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  residences: Residence[]
  defaultResidenceId: string | null
  onSent: (mailKey: string) => void
}) {
  const sortedResidences = useMemo(
    () => [...residences].sort((a, b) => a.name.localeCompare(b.name, "fr", { numeric: true })),
    [residences]
  )
  const [residenceId, setResidenceId] = useState("")
  const [lots, setLots] = useState<Lot[]>([])
  const [people, setPeople] = useState<Record<string, KonodalUser>>({})
  const [search, setSearch] = useState("")
  const [recipient, setRecipient] = useState<Recipient | null>(null)
  const [topic, setTopic] = useState("")
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)

  // Ouverture : résidence affichée dans la page, ou la première.
  useEffect(() => {
    if (!open) return
    setResidenceId(defaultResidenceId ?? sortedResidences[0]?.id ?? "")
    setRecipient(null)
    setSearch("")
    setTopic("")
    setText("")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    setLots([])
    setRecipient(null)
    if (!open || !residenceId) return
    return subscribeToLots(residenceId, setLots, (error) =>
      toast.error("Impossible de charger les lots : " + error.message)
    )
  }, [open, residenceId])

  // Propriétaires de la résidence, une fois chacun, avec leurs lots - lot
  // principal (non rattaché à un autre) d'abord : dans l'app, seul un
  // propriétaire a l'onglet « Mon syndic » où s'affiche la conversation.
  const ownerLots = useMemo(() => {
    const byUid = new Map<string, Lot[]>()
    for (const lot of lots) {
      for (const uid of lot.idProprietaire ?? []) byUid.set(uid, [...(byUid.get(uid) ?? []), lot])
    }
    for (const [uid, owned] of byUid) {
      byUid.set(
        uid,
        [...owned].sort((a, b) => Number(!!a.parentLotId) - Number(!!b.parentLotId))
      )
    }
    return byUid
  }, [lots])

  const uidsKey = useMemo(() => [...ownerLots.keys()].sort().join(","), [ownerLots])
  useEffect(() => {
    const missing = uidsKey ? uidsKey.split(",").filter((uid) => !people[uid]) : []
    if (missing.length === 0) return
    let cancelled = false
    resolveUsersByUids(missing).then((users) => {
      if (!cancelled) setPeople((prev) => ({ ...prev, ...Object.fromEntries(users.map((u) => [u.uid, u])) }))
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uidsKey])

  const nameOf = (uid: string) => {
    const person = people[uid]
    return person ? `${person.name} ${person.surname}`.trim() || person.email : "…"
  }
  const lotsLabel = (uid: string) => (ownerLots.get(uid) ?? []).map((lot) => lotDisplayLabel(lot)).join(" ; ")
  const q = fold(search.trim())
  const matches = [...ownerLots.keys()]
    .filter((uid) => people[uid])
    .filter((uid) => !q || fold(`${nameOf(uid)} ${people[uid]?.email ?? ""} ${lotsLabel(uid)}`).includes(q))
    .sort((a, b) => nameOf(a).localeCompare(nameOf(b), "fr"))
    .slice(0, 8)
  const recipientLots = recipient ? (ownerLots.get(recipient.uid) ?? []) : []

  async function send() {
    if (!recipient || !topic.trim() || !text.trim()) return
    setSending(true)
    try {
      const result = await writeToResident({
        residenceId,
        lotId: recipient.lotId,
        residentUid: recipient.uid,
        topic: topic.trim(),
        text: text.trim(),
      })
      if (result.copied) toast.success("Message envoyé au résident")
      else toast.warning(`Message envoyé au résident, mais sa copie n'a pas pu partir à ${result.copyTo}`)
      onOpenChange(false)
      onSent(`${residenceId}:${result.mailId}`)
    } catch (err) {
      toast.error("Envoi impossible : " + (err as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !sending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-xl">
        <form
          className="flex max-h-[calc(100vh-3rem)] min-w-0 flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            void send()
          }}
        >
          <DialogHeader className="pb-4">
            <DialogTitle>Nouveau message</DialogTitle>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto pr-4 pl-[5px]">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-message-residence">Résidence</Label>
              <select
                id="new-message-residence"
                value={residenceId}
                onChange={(e) => setResidenceId(e.target.value)}
                className="h-10 rounded-[10px] border border-input bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {sortedResidences.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex min-w-0 flex-col gap-1.5">
              <Label htmlFor="new-message-to">À</Label>
              {recipient ? (
                <div className="flex items-center gap-3 rounded-[12px] border border-[oklch(85%_0.06_160)] bg-[oklch(96.5%_0.03_160)] p-2.5">
                  <Avatar initials={emailInitials(nameOf(recipient.uid).replace(/\s+/g, "."))} className="size-8" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-bold">{nameOf(recipient.uid)}</div>
                    {recipientLots.length > 1 ? (
                      <select
                        aria-label="Lot concerné"
                        value={recipient.lotId}
                        onChange={(e) => setRecipient({ uid: recipient.uid, lotId: e.target.value })}
                        className="mt-1 h-8 w-full min-w-0 rounded-[8px] border border-input bg-white px-2 text-[12.5px] outline-none focus-visible:border-ring"
                      >
                        {recipientLots.map((lot) => (
                          <option key={lot.id} value={lot.id}>
                            {lotDisplayLabel(lot)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="truncate text-[12px] text-muted-foreground">
                        Propriétaire · {recipientLots[0] ? lotDisplayLabel(recipientLots[0]) : ""}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-label="Changer de destinataire"
                    className="rounded p-1 text-muted-foreground hover:bg-white hover:text-foreground"
                    onClick={() => setRecipient(null)}
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="new-message-to"
                      autoFocus
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Rechercher un propriétaire (nom, e-mail, lot)…"
                      className={cn(FIELD_CLASS, "pl-9")}
                    />
                  </div>
                  <div className="flex max-h-56 flex-col overflow-y-auto rounded-[12px] border border-[oklch(93%_0.004_100)]">
                    {matches.length === 0 ? (
                      <p className="m-0 p-3 text-[12.5px] text-muted-foreground">
                        {ownerLots.size === 0
                          ? "Aucun propriétaire dans cette résidence."
                          : "Aucun propriétaire trouvé."}
                      </p>
                    ) : (
                      matches.map((uid) => (
                        <button
                          key={uid}
                          type="button"
                          onClick={() => setRecipient({ uid, lotId: ownerLots.get(uid)?.[0]?.id ?? "" })}
                          className="flex items-center gap-3 border-b border-[oklch(95%_0.004_100)] px-3 py-2 text-left last:border-b-0 hover:bg-[oklch(97.5%_0.004_100)]"
                        >
                          <Avatar
                            initials={emailInitials(nameOf(uid).replace(/\s+/g, "."))}
                            className="size-7 text-[10px]"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-semibold">{nameOf(uid)}</span>
                            <span className="block truncate text-[11.5px] text-muted-foreground">
                              {people[uid]?.email}
                              {(ownerLots.get(uid)?.length ?? 0) > 1
                                ? ` · ${ownerLots.get(uid)?.length} lots`
                                : ` · ${lotsLabel(uid)}`}
                            </span>
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-message-topic">Objet</Label>
              <Input
                id="new-message-topic"
                value={topic}
                maxLength={TOPIC_MAX}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Ex. : Travaux de l'ascenseur"
                className={FIELD_CLASS}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-message-text">Message</Label>
              <textarea
                id="new-message-text"
                rows={8}
                maxLength={TEXT_MAX}
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full min-w-0 rounded-[12px] border border-input bg-white px-3 py-2 text-[14px] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <p className="m-0 text-[12px] text-muted-foreground">
                Le résident le lit dans son application et peut y répondre.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={sending} onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={sending || !recipient || !topic.trim() || !text.trim()}
              className={PRIMARY_CTA_CLASS}
            >
              <Send />
              {sending ? "Envoi…" : "Envoyer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
