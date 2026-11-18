import { Badge } from "@/components/ui/badge"
import type { ResidenceImportStatus } from "@/lib/residenceImport"

const LABELS: Record<ResidenceImportStatus, { text: string; className: string }> = {
  waiting: { text: "En attente de lecture", className: "bg-muted text-muted-foreground" },
  reading: { text: "Lecture en cours", className: "bg-amber-100 text-amber-800" },
  ready: { text: "Proposition à vérifier", className: "bg-sky-100 text-sky-800" },
  created: { text: "Résidence créée", className: "bg-emerald-100 text-emerald-800" },
}

export function ImportStatusBadge({ status }: { status: ResidenceImportStatus }) {
  const label = LABELS[status] ?? LABELS.waiting
  return <Badge className={`shrink-0 ${label.className}`}>{label.text}</Badge>
}
