import { useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { ArrowLeft, Mail, Send, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, Pill } from "@/components/agency/agencyUi"
import { NodoIcon } from "@/components/nodo/NodoIcon"
import { formatFullDate, formatListDate, MAIL_CATEGORY_LABELS, MAIL_STATUS } from "@/components/messages/mailStatus"
import { emailInitials } from "@/lib/licences"
import { mailPlainText, replyToResidentMail, type ResidenceMail } from "@/lib/messages"
import { cn, PRIMARY_CTA_CLASS } from "@/lib/utils"

// Réponse et analyse de Nodo (volet de lecture) : la réponse envoyée au
// résident d'abord, pour que le gestionnaire vérifie les réponses
// automatiques (demande de l'utilisateur, 2026-10-23), puis la décision, le
// type de message, la raison et la suite donnée par le résident. Une analyse
// pas encore rendue (ou interrompue) est dite telle quelle.
function NodoPanel({ mail }: { mail: ResidenceMail }) {
  const nodo = mail.nodo
  if (!nodo) return null
  const since = nodo.at ?? mail.date
  const pending = mail.status === "nodo_pending"
  const stuck = pending && !!since && Date.now() - since.getTime() > 30 * 60_000
  const decision = pending
    ? stuck
      ? "Aucune analyse rendue"
      : "Analyse en cours"
    : nodo.decision === "answer"
      ? "Répondu à la place du syndic"
      : "Transmis au syndic"
  const rows: { label: string; value: string }[] = [{ label: "Décision", value: decision }]
  if (nodo.nature) {
    rows.push({
      label: "Type de message",
      value: nodo.nature === "information" ? "Demande d'information" : "Demande au syndic (accord, action, avis)",
    })
  }
  if (nodo.category) rows.push({ label: "Catégorie", value: MAIL_CATEGORY_LABELS[nodo.category] })
  if (!pending) {
    rows.push({ label: "Urgence", value: nodo.urgent ? "Urgent : transmis au syndic sans réponse automatique" : "Non" })
  }
  if (nodo.reason) rows.push({ label: "Raison", value: nodo.reason })
  if (mail.status === "resident_forwarded" && nodo.forwardedByResidentAt) {
    rows.push({
      label: "Suite",
      value: `Réponse jugée insuffisante : le résident a écrit au syndic le ${formatFullDate(nodo.forwardedByResidentAt)}.`,
    })
  }
  return (
    <section className="flex flex-col gap-3 rounded-[16px] border border-[oklch(90%_0.03_155)] bg-[oklch(97%_0.02_155)] p-4">
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-[10px] bg-[oklch(93%_0.05_150)]">
          <NodoIcon className="size-[17px]" color="oklch(32% 0.09 155)" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="p-0 font-sans text-[13.5px] font-extrabold text-[oklch(22%_0.01_150)]">
            {nodo.answer ? "Réponse automatique de Nodo" : "Analyse de Nodo"}
          </h3>
          {since && <div className="text-[11.5px] text-muted-foreground">{formatFullDate(since)}</div>}
        </div>
      </div>
      {nodo.answer && (
        <div className="rounded-[12px] border border-[oklch(90%_0.03_155)] bg-white p-3.5 text-[14px] leading-relaxed whitespace-pre-wrap text-[oklch(22%_0.01_150)]">
          {nodo.answer}
        </div>
      )}
      <dl className="m-0 grid grid-cols-[130px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[12.5px]">
        {rows.map((row) => (
          <div key={row.label} className="contents">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="m-0 font-semibold text-[oklch(25%_0.01_150)]">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function MailBody({ mail }: { mail: ResidenceMail }) {
  return mail.html ? (
    <iframe
      title="Contenu du mail"
      sandbox=""
      srcDoc={mail.html}
      className="h-[45vh] w-full rounded-lg border border-input bg-white"
    />
  ) : (
    <p className="m-0 text-[14px] leading-relaxed whitespace-pre-wrap text-[oklch(22%_0.01_150)]">
      {mail.text || "(message vide)"}
    </p>
  )
}

// Volet de lecture de la page Messages : le mail ouvert, ce que Nodo en a
// fait, puis tout l'échange avec ce résident pour ce lot.
export function MailReader({
  mail,
  thread,
  senderName,
  residenceName,
  onSelect,
  onBack,
  reply,
}: {
  mail: ResidenceMail | null
  thread: ResidenceMail[]
  senderName: (mail: ResidenceMail) => string
  residenceName: (residenceId: string) => string
  onSelect: (mail: ResidenceMail) => void
  onBack: () => void
  // Réponse depuis le BO : « allowed » pour l'agence et ses agents quand le
  // réglage de l'agence est actif, « disabled » sinon ; rien pour un
  // superAdmin (consultation seule).
  reply: "allowed" | "disabled" | null
}) {
  if (!mail) {
    return (
      <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
        <Mail className="size-8 stroke-[1.5]" />
        Sélectionnez un message pour le lire.
      </div>
    )
  }
  const status = MAIL_STATUS[mail.status]
  const name = senderName(mail)
  const title = [residenceName(mail.residenceId), mail.lotLabel && `Lot ${mail.lotLabel}`].filter(Boolean).join(" · ")
  return (
    <article className="flex min-w-0 flex-col gap-4">
      <Button type="button" variant="ghost" size="sm" className="w-fit lg:hidden" onClick={onBack}>
        <ArrowLeft />
        Retour à la liste
      </Button>
      <div className="flex flex-col gap-3 border-b border-[oklch(95%_0.003_100)] pb-4">
        <div className="flex flex-wrap items-start gap-2">
          <h2 className="min-w-0 flex-1 p-0 font-sans text-[18px] font-extrabold text-[oklch(22%_0.01_150)]">
            {mail.topic ?? (title || "(sans objet)")}
          </h2>
          <Pill tone={status.tone}>{status.label}</Pill>
        </div>
        {mail.topic && title && <p className="m-0 -mt-2 text-[12.5px] text-muted-foreground">{title}</p>}
        <div className="flex items-center gap-3">
          <Avatar
            initials={mail.kind === "syndic" ? "SY" : emailInitials(name.replace(/\s+/g, "."))}
            className={cn(mail.kind === "syndic" && "bg-[oklch(93%_0.05_150)]")}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-bold text-[oklch(22%_0.01_150)]">
              {name}
              {mail.kind === "syndic" && mail.from && (
                <span className="font-normal text-muted-foreground"> &lt;{mail.from}&gt;</span>
              )}
            </div>
            <div className="truncate text-[12px] text-muted-foreground">
              {mail.kind === "resident"
                ? `À : ${mail.to.join(", ") || "syndic"}`
                : mail.status === "outgoing" && mail.repliedBy
                  ? `Message envoyé depuis Konodal · ${mail.repliedBy.name}`
                  : mail.repliedBy
                    ? `Réponse depuis Konodal · ${mail.repliedBy.name}`
                    : "Réponse rapatriée de la boîte du syndic"}
            </div>
          </div>
          <span className="shrink-0 text-[12px] text-muted-foreground">{formatFullDate(mail.date)}</span>
        </div>
      </div>

      <MailBody mail={mail} />
      <NodoPanel mail={mail} />
      {mail.status === "error" && (
        <p className="m-0 rounded-[12px] border border-[oklch(88%_0.06_25)] bg-[oklch(97.5%_0.015_25)] p-3 text-[12.5px] text-[oklch(42%_0.15_27)]">
          Le message n'a pas pu être envoyé{mail.error ? ` : ${mail.error}` : "."}
        </p>
      )}

      {mail.agencyCopy && !mail.agencyCopy.success && (
        <p className="m-0 rounded-[12px] border border-[oklch(88%_0.08_85)] bg-[oklch(97.5%_0.035_85)] p-3 text-[12.5px] text-[oklch(40%_0.1_65)]">
          Le résident a bien la réponse, mais sa copie n'a pas pu être envoyée à {mail.agencyCopy.to}.
        </p>
      )}

      {(thread.length > 1 || thread.some((item) => item.nodo?.answer)) && (
        <section className="flex flex-col gap-2 border-t border-[oklch(95%_0.003_100)] pt-4">
          <h3 className="p-0 font-sans text-[12px] font-extrabold tracking-[0.05em] text-muted-foreground uppercase">
            Échange ·{" "}
            {thread.length + thread.filter((item) => item.nodo?.decision === "answer" && item.nodo.answer).length}{" "}
            messages
          </h3>
          <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
            {thread
              .flatMap((item) => {
                const rows = [
                  {
                    key: item.key,
                    mail: item,
                    nodo: false,
                    who: senderName(item),
                    date: item.date,
                    text: mailPlainText(item),
                  },
                ]
                if (item.nodo?.decision === "answer" && item.nodo.answer) {
                  rows.push({
                    key: `${item.key}:nodo`,
                    mail: item,
                    nodo: true,
                    who: "Nodo (réponse automatique)",
                    date: item.nodo.at ?? item.date,
                    text: item.nodo.answer,
                  })
                }
                return rows
              })
              // Le plus récent en premier (demande de l'utilisateur).
              .reverse()
              .map((row) => (
                <li key={row.key} className={row.nodo || row.mail.kind === "syndic" ? "pl-6" : undefined}>
                  <button
                    type="button"
                    onClick={() => onSelect(row.mail)}
                    className={cn(
                      "flex w-full items-start gap-2.5 rounded-[12px] border px-3 py-2 text-left hover:bg-[oklch(97.5%_0.004_100)]",
                      row.mail.key === mail.key && !row.nodo
                        ? "border-[oklch(80%_0.06_155)] bg-[oklch(96%_0.025_155)]"
                        : "border-[oklch(93%_0.004_100)]",
                      row.nodo && "bg-[oklch(98%_0.012_155)]"
                    )}
                  >
                    {row.nodo && <NodoIcon className="mt-0.5 size-3.5 shrink-0" color="oklch(40% 0.09 155)" />}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold">{row.who}</span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">{formatListDate(row.date)}</span>
                      </span>
                      <span className="line-clamp-1 text-[12px] text-muted-foreground">{row.text}</span>
                    </span>
                  </button>
                </li>
              ))}
          </ol>
        </section>
      )}

      {reply === "disabled" && (
        <p className="m-0 border-t border-[oklch(95%_0.003_100)] pt-4 text-[12.5px] text-muted-foreground">
          Réponses depuis Konodal désactivées pour votre agence (fiche Agence, « Réponses dans l'application »).
        </p>
      )}
      {reply === "allowed" && <ReplyBox key={threadTarget(thread)?.key ?? mail.key} target={threadTarget(thread)} />}

      {mail.residentUid && (
        <Button variant="outline" size="sm" className="w-fit" render={<Link to={`/residents/${mail.residentUid}`} />}>
          <UserRound />
          Fiche du résident
        </Button>
      )}
    </article>
  )
}

// Message auquel répond le BO : le dernier du résident dans l'échange, sinon
// celui par lequel le syndic a lancé la conversation.
function threadTarget(thread: ResidenceMail[]): ResidenceMail | null {
  return (
    [...thread].reverse().find((item) => item.kind === "resident") ??
    thread.find((item) => item.status === "outgoing") ??
    null
  )
}

// Formulaire de réponse : la réponse s'affiche dans l'app du résident, une
// copie part dans la boîte mail du syndic (reply_to_resident_mail).
function ReplyBox({ target }: { target: ResidenceMail | null }) {
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  if (!target) return null
  const to = target.to[0] ?? target.from

  async function send() {
    if (!target || !text.trim()) return
    setSending(true)
    try {
      const result = await replyToResidentMail(target, text.trim())
      if (result.copied) toast.success("Réponse envoyée au résident")
      else toast.warning(`Réponse envoyée au résident, mais sa copie n'a pas pu partir à ${result.copyTo}`)
      setText("")
    } catch (err) {
      toast.error("Envoi impossible : " + (err as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <form
      className="flex flex-col gap-2 border-t border-[oklch(95%_0.003_100)] pt-4"
      onSubmit={(e) => {
        e.preventDefault()
        void send()
      }}
    >
      <label htmlFor={`reply-${target.key}`} className="text-[13px] font-bold text-[oklch(22%_0.01_150)]">
        Répondre
      </label>
      <textarea
        id={`reply-${target.key}`}
        rows={5}
        maxLength={5000}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            void send()
          }
        }}
        placeholder="Votre réponse au résident…"
        className="w-full min-w-0 rounded-[12px] border border-input bg-white px-3 py-2 text-[14px] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 min-w-0 flex-1 text-[12px] text-muted-foreground">
          Le résident verra votre réponse dans son application. Une copie part dans votre boîte mail
          {to ? ` (${to})` : ""}.
        </p>
        <Button
          type="submit"
          disabled={sending || !text.trim()}
          className={cn(PRIMARY_CTA_CLASS, "rounded-[11px] font-bold")}
        >
          <Send />
          {sending ? "Envoi…" : "Envoyer"}
        </Button>
      </div>
    </form>
  )
}
