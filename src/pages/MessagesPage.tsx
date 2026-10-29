import { useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Inbox, PenSquare, Search } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { NodoIcon } from "@/components/nodo/NodoIcon"
import { MailboxNavigator } from "@/components/messages/MailboxNavigator"
import { MailList } from "@/components/messages/MailList"
import { MailReader } from "@/components/messages/MailReader"
import { NewMessageDialog } from "@/components/messages/NewMessageDialog"
import { Button } from "@/components/ui/button"
import {
  FILTER_STATUSES,
  MAIL_CATEGORY_LABELS,
  TAB_FILTERS,
  type MailboxFilter,
  type MailboxTab,
} from "@/components/messages/mailStatus"
import { useMailbox } from "@/hooks/useMailbox"
import { useAccountRole } from "@/hooks/useAccountRole"
import { useScopedResidences } from "@/hooks/useScopedResidenceIds"
import { subscribeToGerance } from "@/lib/gerances"
import {
  conversationKey,
  isNodoMail,
  MAIL_CATEGORY_KEYS,
  mailPlainText,
  markMailsRead,
  type MailCategory,
  type ResidenceMail,
} from "@/lib/messages"
import { resolveUsersByUids } from "@/lib/users"
import type { Gerance } from "@/types/gerance"
import { cn, PRIMARY_CTA_CLASS } from "@/lib/utils"

function fold(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

const TAB_CLASS =
  "flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap transition-colors"

// Page Messages (demande de l'utilisateur, 2026-10-23 : « un peu comme dans
// Outlook ») : résidences à gauche comme la GED, liste des mails au milieu,
// lecture à droite. Onglet Nodo : les messages passés par le filtre de Nodo
// (répondus à la place du syndic, transmis, retransmis par le résident).
// Sélection dans l'URL (?residence=, ?onglet=nodo, ?filtre=, ?mail=).
export default function MessagesPage() {
  const [params, setParams] = useSearchParams()
  const { residences, loading: residencesLoading } = useScopedResidences()
  const { isAgence, isAgent, geranceId } = useAccountRole()
  const [ownGerance, setOwnGerance] = useState<Gerance | null>(null)
  const { mails, loading } = useMailbox(residences)
  const [names, setNames] = useState<Record<string, string>>({})
  const [search, setSearch] = useState("")
  const searchRef = useRef<HTMLInputElement>(null)

  const residenceId = params.get("residence")
  const tab: MailboxTab = params.get("onglet") === "nodo" ? "nodo" : "inbox"
  const filter = (TAB_FILTERS[tab].find((f) => f.key === params.get("filtre"))?.key ?? "all") as MailboxFilter
  const category = (MAIL_CATEGORY_KEYS as readonly string[]).includes(params.get("categorie") ?? "")
    ? (params.get("categorie") as MailCategory)
    : null
  const selectedKey = params.get("mail")

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key)
      else next.set(key, value)
    }
    setParams(next, { replace: true })
  }

  // Ctrl K (⌘K) : recherche, comme dans la GED.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // Noms des résidents (fiches users), chargés une fois par compte.
  const uidsKey = useMemo(
    () => [...new Set(mails.map((m) => m.residentUid).filter((uid): uid is string => !!uid))].sort().join(","),
    [mails]
  )
  useEffect(() => {
    const missing = uidsKey ? uidsKey.split(",").filter((uid) => !(uid in names)) : []
    if (missing.length === 0) return
    let cancelled = false
    resolveUsersByUids(missing).then((users) => {
      if (cancelled) return
      setNames((prev) => {
        const next = { ...prev }
        for (const uid of missing) next[uid] = ""
        for (const user of users) next[user.uid] = `${user.name} ${user.surname}`.trim() || user.email
        return next
      })
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uidsKey])

  const residenceName = (id: string) => residences.find((r) => r.id === id)?.name ?? "Résidence"
  const senderName = (mail: ResidenceMail) =>
    mail.kind === "syndic"
      ? (mail.repliedBy?.name ?? "Syndic")
      : (mail.residentUid && names[mail.residentUid]) || "Résident"

  // Réponse depuis le BO : l'agence et ses agents, selon le réglage de
  // l'agence (actif par défaut) ; le superAdmin consulte seulement.
  useEffect(() => {
    if (!geranceId) return
    return subscribeToGerance(geranceId, setOwnGerance, () => setOwnGerance(null))
  }, [geranceId])
  const reply = isAgence || isAgent ? (ownGerance?.inAppReplies?.enabled === false ? "disabled" : "allowed") : null
  const [composing, setComposing] = useState(false)

  const inTab = (mail: ResidenceMail) => tab === "inbox" || isNodoMail(mail)
  const counts = useMemo(() => {
    const result: Record<string, number> = {}
    for (const mail of mails) if (inTab(mail)) result[mail.residenceId] = (result[mail.residenceId] ?? 0) + 1
    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mails, tab])

  const unreadCounts = useMemo(() => {
    const result: Record<string, number> = {}
    for (const mail of mails) if (mail.unreadByAgency) result[mail.residenceId] = (result[mail.residenceId] ?? 0) + 1
    return result
  }, [mails])

  const scoped = useMemo(() => mails.filter((m) => !residenceId || m.residenceId === residenceId), [mails, residenceId])
  const tabMails = scoped.filter(inTab)
  const q = fold(search.trim())
  const listed = tabMails.filter((mail) => {
    const statuses = FILTER_STATUSES[filter]
    if (statuses && !statuses.includes(mail.status)) return false
    if (filter === "urgent" && !mail.nodo?.urgent) return false
    if (category && mail.nodo?.category !== category) return false
    if (filter === "residents" && mail.kind !== "resident") return false
    if (filter === "syndic" && mail.kind !== "syndic") return false
    if (!q) return true
    return fold(
      [
        mail.topic,
        senderName(mail),
        mailPlainText(mail),
        mail.nodo?.answer,
        mail.lotLabel,
        residenceName(mail.residenceId),
      ]
        .filter(Boolean)
        .join(" ")
    ).includes(q)
  })
  // Un message urgent reste en tête tant que l'agence ne l'a pas ouvert.
  const ordered = [
    ...listed.filter((m) => m.nodo?.urgent && m.unreadByAgency),
    ...listed.filter((m) => !(m.nodo?.urgent && m.unreadByAgency)),
  ]

  const byKey = useMemo(() => new Map(mails.map((m) => [m.key, m])), [mails])
  const selected = mails.find((m) => m.key === selectedKey) ?? null
  const thread = selected
    ? mails
        .filter((m) => conversationKey(m, byKey) === conversationKey(selected, byKey))
        .sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0))
    : []

  // Conversation ouverte par l'agence ou un agent : lue pour toute l'agence
  // (boîte partagée) ; le superAdmin consulte sans changer l'état.
  const unreadInThread = thread
    .filter((m) => m.unreadByAgency)
    .map((m) => m.key)
    .join(",")
  useEffect(() => {
    if (!unreadInThread || !(isAgence || isAgent)) return
    markMailsRead(thread.filter((m) => m.unreadByAgency)).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadInThread, isAgence, isAgent])

  // Bilan de Nodo sur la sélection (onglet Nodo).
  const nodoMails = scoped.filter(isNodoMail)
  const nodoStats = {
    answered: nodoMails.filter((m) => m.status === "nodo_answered").length,
    forwarded: nodoMails.filter((m) => m.status === "nodo_forwarded").length,
    retransmitted: nodoMails.filter((m) => m.status === "resident_forwarded").length,
  }
  const decided = nodoStats.answered + nodoStats.forwarded + nodoStats.retransmitted
  const answeredRate = decided ? Math.round(((nodoStats.answered + nodoStats.retransmitted) / decided) * 100) : null

  const noResidence = !residencesLoading && residences.length === 0

  return (
    <div className="flex flex-col gap-6 lg:h-full">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-2 text-[26px] font-extrabold tracking-tight text-[oklch(22%_0.01_150)]">Messages</h1>
        <label
          className={cn(
            "group flex min-w-0 flex-1 basis-80 items-center gap-2.5 rounded-2xl border border-[oklch(90%_0.006_100)] bg-white px-4 py-3 text-[15px]",
            "focus-within:border-[oklch(45%_0.09_155)] focus-within:shadow-[0_0_0_1px_oklch(45%_0.09_155),0_0_0_5px_oklch(55%_0.1_155/0.14)]"
          )}
        >
          <Search className="size-[18px] shrink-0 stroke-[2.2] text-[oklch(50%_0.01_150)] group-focus-within:text-[oklch(45%_0.09_155)]" />
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && (setSearch(""), e.currentTarget.blur())}
            placeholder="Rechercher un résident, un lot, un mot du message…"
            aria-label="Rechercher dans les messages"
            className="min-w-0 flex-1 bg-transparent font-semibold text-[oklch(20%_0.02_150)] outline-none placeholder:font-normal placeholder:text-[oklch(55%_0.01_150)]"
          />
          <kbd className="ml-auto shrink-0 rounded-[7px] border border-[oklch(90%_0.006_100)] px-2 py-0.5 font-sans text-xs whitespace-nowrap text-[oklch(50%_0.01_150)]">
            Ctrl K
          </kbd>
        </label>
        {/* Le syndic écrit le premier à un résident (agence et agents, réglage
            « Réponses dans l'application » actif). */}
        {reply === "allowed" && residences.length > 0 && (
          <Button
            type="button"
            className={cn(PRIMARY_CTA_CLASS, "h-12 rounded-2xl px-5 font-bold")}
            onClick={() => setComposing(true)}
          >
            <PenSquare />
            Nouveau message
          </Button>
        )}
      </div>

      {noResidence ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Inbox className="size-8 stroke-[1.5] text-muted-foreground" />
            <p className="m-0 font-bold">Aucune résidence rattachée à votre agence</p>
            <p className="m-0 max-w-md text-sm text-muted-foreground">
              Les messages que les résidents écrivent à leur syndic depuis l'application, et ceux traités par Nodo,
              apparaîtront ici dès qu'une résidence sera rattachée à votre agence.
            </p>
          </CardContent>
        </Card>
      ) : (
        // Hauteur de l'écran : la carte descend jusqu'en bas, sous le bouton de Nodo.
        <Card className="overflow-hidden py-0 lg:min-h-[560px] lg:flex-1">
          <CardContent className="grid p-0 lg:min-h-0 lg:flex-1 lg:grid-cols-[250px_360px_minmax(0,1fr)]">
            <aside className="overflow-y-auto border-b border-[oklch(95%_0.003_100)] p-4 lg:border-r lg:border-b-0">
              {residencesLoading ? (
                <p className="p-2 text-sm text-muted-foreground">Chargement des résidences…</p>
              ) : (
                <MailboxNavigator
                  residences={residences}
                  counts={counts}
                  unread={unreadCounts}
                  total={mails.filter(inTab).length}
                  selectedId={residenceId}
                  onSelect={(id) => update({ residence: id, mail: null })}
                />
              )}
            </aside>

            <section
              className={cn(
                "flex min-h-0 flex-col border-b border-[oklch(95%_0.003_100)] lg:border-r lg:border-b-0",
                selected && "hidden lg:flex"
              )}
            >
              <div className="flex flex-col gap-2.5 border-b border-[oklch(95%_0.003_100)] p-3">
                <div role="tablist" className="flex gap-1 rounded-2xl bg-[oklch(93%_0.005_100)] p-1">
                  {(
                    [
                      { key: "inbox", label: "Boîte de réception", count: scoped.length },
                      { key: "nodo", label: "Nodo", count: nodoMails.length },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      role="tab"
                      aria-selected={tab === t.key}
                      onClick={() => update({ onglet: t.key === "nodo" ? "nodo" : null, filtre: null })}
                      className={cn(
                        TAB_CLASS,
                        "flex-1 justify-center",
                        tab === t.key
                          ? "bg-[oklch(45%_0.1_155)] font-bold text-white shadow-[0_6px_16px_-6px_oklch(38%_0.08_155/0.5)]"
                          : "text-[oklch(35%_0.01_150)] hover:bg-white/60"
                      )}
                    >
                      {t.key === "nodo" ? (
                        <NodoIcon className="size-4" color={tab === t.key ? "white" : "oklch(40% 0.09 155)"} />
                      ) : (
                        <Inbox className="size-4" />
                      )}
                      {t.label}
                      <span className="text-[11.5px] opacity-75 tabular-nums">{t.count}</span>
                    </button>
                  ))}
                </div>
                {tab === "nodo" && (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                      { label: "Répondus", value: nodoStats.answered },
                      { label: "Transmis", value: nodoStats.forwarded },
                      { label: "Retransmis", value: nodoStats.retransmitted },
                    ].map((stat) => (
                      <div key={stat.label} className="rounded-[12px] bg-[oklch(97%_0.02_155)] px-2 py-1.5">
                        <div className="text-[17px] font-extrabold text-[oklch(25%_0.03_155)] tabular-nums">
                          {stat.value}
                        </div>
                        <div className="text-[11px] text-muted-foreground">{stat.label}</div>
                      </div>
                    ))}
                    {answeredRate !== null && (
                      <p className="col-span-3 m-0 text-[11.5px] text-muted-foreground">
                        Nodo a répondu à {answeredRate} % des messages qu'il a lus.
                      </p>
                    )}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-1.5">
                  {TAB_FILTERS[tab].map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => update({ filtre: f.key === "all" ? null : f.key })}
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-[12px] font-semibold",
                        filter === f.key
                          ? "border-[oklch(45%_0.09_155)] bg-[oklch(94%_0.03_155)] text-[oklch(32%_0.07_155)]"
                          : "border-[oklch(91%_0.005_100)] text-muted-foreground hover:bg-[oklch(97%_0.004_100)]"
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                  <select
                    aria-label="Catégorie"
                    value={category ?? ""}
                    onChange={(e) => update({ categorie: e.target.value || null })}
                    className="h-6 rounded-full border border-[oklch(91%_0.005_100)] bg-white px-2 text-[12px] font-semibold text-muted-foreground outline-none"
                  >
                    <option value="">Toutes catégories</option>
                    {MAIL_CATEGORY_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {MAIL_CATEGORY_LABELS[key]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="max-h-[70vh] min-h-0 flex-1 overflow-y-auto lg:max-h-none">
                <MailList
                  mails={ordered}
                  selectedKey={selectedKey}
                  onSelect={(mail) => update({ mail: mail.key })}
                  senderName={senderName}
                  residenceName={residenceName}
                  showResidence={!residenceId}
                  loading={loading}
                  emptyText={
                    q
                      ? "Aucun message ne correspond à la recherche."
                      : tab === "nodo"
                        ? "Aucun message passé par Nodo."
                        : "Aucun message."
                  }
                />
              </div>
            </section>

            {/* lg:pb-24 : « Envoyer » remonte au-dessus du bouton de Nodo en fin de défilement. */}
            <section className={cn("min-h-0 overflow-y-auto p-5 lg:pb-24", !selected && "hidden lg:block")}>
              <MailReader
                mail={selected}
                thread={thread}
                senderName={senderName}
                residenceName={residenceName}
                onSelect={(mail) => update({ mail: mail.key })}
                onBack={() => update({ mail: null })}
                reply={reply}
              />
            </section>
          </CardContent>
        </Card>
      )}
      <NewMessageDialog
        open={composing}
        onOpenChange={setComposing}
        residences={residences}
        defaultResidenceId={residenceId}
        onSent={(key) => update({ mail: key, onglet: null, filtre: null })}
      />
    </div>
  )
}
