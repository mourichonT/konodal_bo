import { Badge } from "@/components/ui/badge"
import { PRO_CONFORMITE_LABELS, type ContactPro } from "@/types/contact"
import { cn } from "@/lib/utils"

const STYLES: Record<ContactPro["conformite"], string> = {
  conforme: "bg-emerald-100 text-emerald-800",
  a_verifier: "bg-sky-100 text-sky-800",
  incomplet: "bg-amber-100 text-amber-800",
  expire: "bg-red-100 text-red-800",
}

// Prestataire Konodal Pro : badge de conformité de son entreprise (pièces
// URSSAF, Kbis, assurances), recopié sur le contact par le serveur.
export function ProComplianceBadge({ pro, className }: { pro?: ContactPro; className?: string }) {
  if (!pro) return null
  return (
    <Badge variant="outline" className={cn("border-transparent", STYLES[pro.conformite], className)}>
      Konodal Pro · {PRO_CONFORMITE_LABELS[pro.conformite]}
    </Badge>
  )
}
