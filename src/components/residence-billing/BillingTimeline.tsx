import type { CsBillingAdmin } from "@/lib/csAvance"
import { cn } from "@/lib/utils"
import { daysUntil, formatShortDate } from "./format"

type Point = { date: Date | null; label: string; tone?: "warn" | "danger" | "brand"; today?: boolean }

// Jalons de la période en cours : offre ou période offerte, échéances,
// remise, délai de grâce puis lecture seule ; « Aujourd'hui » placé à son
// rang. Les jalons passés sont pleins, les suivants vides.
function points(data: CsBillingAdmin): Point[] {
  const { entitlements: ent, grant, subscription: sub, discount } = data
  const list: Point[] = []
  const graceEnd = (end: Date | null) =>
    end ? [{ date: end, label: "Fin des fonctions", tone: "warn" as const },
      { date: new Date(end.getTime() + data.graceDays * 86_400_000), label: "Lecture seule", tone: "danger" as const }]
      : []

  if (grant) {
    list.push({ date: grant.grantedAt, label: "Début de l'offre", tone: "brand" })
    if (grant.until) list.push(...graceEnd(grant.until))
    else list.push({ date: null, label: "Offerte sans fin", tone: "brand" })
  } else if (sub) {
    list.push({ date: sub.startDate, label: "Souscription", tone: "brand" })
    if (sub.status === "trialing" && sub.trialEnd) {
      list.push({ date: sub.trialEnd, label: sub.byInvoice ? "Première facture" : "Premier paiement", tone: "brand" })
    } else if (sub.currentPeriodStart && sub.currentPeriodStart.getTime() !== sub.startDate?.getTime()) {
      list.push({ date: sub.currentPeriodStart, label: "Début de la période" })
    }
    if (sub.pastDueSince) {
      list.push({ date: sub.pastDueSince, label: "Impayé", tone: "danger" })
      list.push({ date: ent.graceUntil, label: "Lecture seule", tone: "danger" })
    } else if (sub.cancelAtPeriodEnd || sub.endedAt) {
      list.push(...graceEnd(sub.endedAt ?? sub.currentPeriodEnd))
    } else if (sub.status !== "trialing" && sub.currentPeriodEnd) {
      list.push({ date: sub.currentPeriodEnd, label: "Prochaine échéance" })
    }
    if (discount?.end) list.push({ date: discount.end, label: "Fin de la remise" })
  }
  const dated = list.filter((p) => p.date).sort((a, b) => a.date!.getTime() - b.date!.getTime())
  const undated = list.filter((p) => !p.date)
  const now = new Date()
  const index = dated.findIndex((p) => p.date!.getTime() > now.getTime())
  const today: Point = { date: now, label: "Aujourd'hui", today: true }
  if (index === -1) dated.push(today)
  else dated.splice(index, 0, today)
  return [...dated, ...undated]
}

export function BillingTimeline({ data }: { data: CsBillingAdmin }) {
  if (!data.grant && !data.subscription) return null
  const list = points(data)
  const next = list.find((p) => p.date && !p.today && p.date.getTime() > Date.now())
  return (
    <div className="flex flex-col gap-3">
      {next?.date && (
        <p className="text-sm">
          <span className="font-semibold">{next.label}</span> dans{" "}
          <span className="font-semibold tabular-nums">J-{daysUntil(next.date)}</span>
          <span className="text-muted-foreground"> · le {formatShortDate(next.date)}</span>
        </p>
      )}
      <ol className="flex overflow-x-auto pb-1">
        {list.map((point, i) => {
          const past = point.date ? point.date.getTime() <= Date.now() : false
          const dot = point.today
            ? "size-3.5 bg-[oklch(45%_0.1_155)] ring-4 ring-[oklch(90%_0.05_155)]"
            : past
              ? point.tone === "danger"
                ? "size-3 bg-red-500"
                : point.tone === "warn"
                  ? "size-3 bg-amber-500"
                  : "size-3 bg-[oklch(45%_0.1_155)]"
              : cn(
                  "size-3 border-2 bg-white",
                  point.tone === "danger" ? "border-red-400" : point.tone === "warn" ? "border-amber-400" : "border-[oklch(60%_0.06_155)]"
                )
          return (
            <li key={`${point.label}-${i}`} className="flex min-w-[120px] flex-1 flex-col items-center gap-1.5">
              <div className="flex w-full items-center">
                <span className={cn("h-0.5 flex-1", i === 0 ? "bg-transparent" : past || point.today ? "bg-[oklch(45%_0.1_155)]" : "bg-[oklch(88%_0.01_150)]")} />
                <span className={cn("shrink-0 rounded-full", dot)} />
                <span
                  className={cn(
                    "h-0.5 flex-1",
                    i === list.length - 1
                      ? "bg-transparent"
                      : list[i + 1]?.date && list[i + 1].date!.getTime() <= Date.now()
                        ? "bg-[oklch(45%_0.1_155)]"
                        : "bg-[oklch(88%_0.01_150)]"
                  )}
                />
              </div>
              <span className={cn("text-center text-xs font-semibold", point.today && "text-[oklch(38%_0.08_155)]")}>
                {point.label}
              </span>
              <span className="text-center text-xs text-muted-foreground tabular-nums">
                {point.date ? formatShortDate(point.date) : "—"}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
