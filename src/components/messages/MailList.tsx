import { Avatar, Pill } from "@/components/agency/agencyUi"
import { NodoIcon } from "@/components/nodo/NodoIcon"
import { formatListDate, MAIL_CATEGORY_LABELS, MAIL_STATUS } from "@/components/messages/mailStatus"
import { emailInitials } from "@/lib/licences"
import { mailPlainText, type ResidenceMail } from "@/lib/messages"
import { cn } from "@/lib/utils"

// Colonne du milieu de la page Messages : un mail par ligne, du plus récent
// au plus ancien (expéditeur, date, résidence et lot, aperçu, statut).
export function MailList({
  mails,
  selectedKey,
  onSelect,
  senderName,
  residenceName,
  showResidence,
  loading,
  emptyText,
}: {
  mails: ResidenceMail[]
  selectedKey: string | null
  onSelect: (mail: ResidenceMail) => void
  senderName: (mail: ResidenceMail) => string
  residenceName: (residenceId: string) => string
  showResidence: boolean
  loading: boolean
  emptyText: string
}) {
  if (mails.length === 0) {
    return (
      <p className="m-0 px-4 py-6 text-center text-sm text-muted-foreground">
        {loading ? "Chargement des messages…" : emptyText}
      </p>
    )
  }
  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {mails.map((mail) => {
        const name = senderName(mail)
        const status = MAIL_STATUS[mail.status]
        const selected = mail.key === selectedKey
        const place = [showResidence ? residenceName(mail.residenceId) : null, mail.lotLabel && `Lot ${mail.lotLabel}`]
          .filter(Boolean)
          .join(" · ")
        return (
          <li key={mail.key}>
            <button
              type="button"
              onClick={() => onSelect(mail)}
              className={cn(
                "flex w-full gap-3 border-b border-l-[3px] border-b-[oklch(95%_0.004_100)] border-l-transparent px-3 py-3 text-left hover:bg-[oklch(97.5%_0.004_100)]",
                selected && "border-l-[oklch(40%_0.08_155)] bg-[oklch(96%_0.025_155)] hover:bg-[oklch(96%_0.025_155)]"
              )}
            >
              <Avatar
                initials={mail.kind === "syndic" ? "SY" : emailInitials(name.replace(/\s+/g, "."))}
                className={cn("size-8 text-[10.5px]", mail.kind === "syndic" && "bg-[oklch(93%_0.05_150)]")}
              />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-baseline gap-2">
                  {mail.unreadByAgency && (
                    <span
                      aria-label="Non lu"
                      className="size-2 shrink-0 self-center rounded-full bg-[oklch(50%_0.13_155)]"
                    />
                  )}
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-[13.5px] text-[oklch(22%_0.01_150)]",
                      mail.unreadByAgency ? "font-extrabold" : "font-bold"
                    )}
                  >
                    {name}
                  </span>
                  <span className="shrink-0 text-[11.5px] text-muted-foreground">{formatListDate(mail.date)}</span>
                </span>
                {mail.topic && (
                  <span className="truncate text-[13px] font-semibold text-[oklch(25%_0.01_150)]">{mail.topic}</span>
                )}
                {place && (
                  <span className="truncate text-[12px] font-semibold text-[oklch(38%_0.03_155)]">{place}</span>
                )}
                <span className="line-clamp-2 text-[12.5px] leading-snug text-muted-foreground">
                  {mailPlainText(mail) || "(message vide)"}
                </span>
                {mail.nodo?.decision === "answer" && mail.nodo.answer && (
                  <span className="line-clamp-1 text-[12px] text-[oklch(38%_0.06_155)]">
                    <span className="font-semibold">Nodo :</span> {mail.nodo.answer}
                  </span>
                )}
                <span className="mt-1 flex items-center gap-1.5">
                  {mail.nodo && <NodoIcon className="size-3.5" color="oklch(40% 0.09 155)" />}
                  {mail.nodo?.urgent && (
                    <Pill tone="red" className="px-2 text-[10.5px]">
                      Urgent
                    </Pill>
                  )}
                  <Pill tone={status.tone} className="px-2 text-[10.5px]">
                    {status.label}
                  </Pill>
                  {mail.nodo?.category && (
                    <Pill tone="grey" className="px-2 text-[10.5px]">
                      {MAIL_CATEGORY_LABELS[mail.nodo.category]}
                    </Pill>
                  )}
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
