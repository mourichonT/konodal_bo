import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

// Carte KPI cliquable utilisée comme filtre au-dessus d'une liste (Sinistres,
// Interventions...) - un clic active/désactive le filtre correspondant.
export function FilterKpiCard({
  label,
  value,
  icon: Icon,
  colorClass,
  active,
  onClick,
}: {
  label: string
  value: number
  icon: LucideIcon
  colorClass: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-6 rounded-[24px] border border-[oklch(93%_0.005_100)] bg-white p-4 text-left shadow-[0_1px_2px_oklch(20%_0_0/0.03),0_14px_34px_-22px_oklch(20%_0_0/0.12)] transition-shadow",
        active ? "ring-2 ring-primary" : "hover:shadow-[0_1px_2px_oklch(20%_0_0/0.03),0_16px_38px_-20px_oklch(20%_0_0/0.18)]"
      )}
    >
      <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", colorClass)}>
        <Icon className="size-5" />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-2xl font-semibold">{value}</span>
      </div>
    </button>
  )
}
