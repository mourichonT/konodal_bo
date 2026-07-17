import { ChevronDown, ChevronUp, Equal } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SinistrePriority } from "@/types/sinistre"

const priorityIcon = {
  haute: ChevronUp,
  normale: Equal,
  basse: ChevronDown,
} satisfies Record<SinistrePriority, typeof ChevronUp>

const priorityColor: Record<SinistrePriority, string> = {
  haute: "text-orange-600",
  normale: "text-amber-500",
  basse: "text-blue-500",
}

export function SinistrePriorityIcon({
  priority,
  className,
}: {
  priority: SinistrePriority
  className?: string
}) {
  const Icon = priorityIcon[priority]
  return <Icon className={cn(priorityColor[priority], className)} />
}
