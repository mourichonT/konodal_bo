import { Ban } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { REMOVAL_STATUS_BADGE_CLASS } from "@/lib/residentRemovals"

// Résident dont l'accès à une résidence est restreint (demande de retrait du
// CS acceptée, users/{uid}.blockedResidencesIds) : depuis efc04c8
// (konodal_app) il reste dans memberResidencesIds, donc dans les listes de
// résidents - ce badge l'y distingue. Mêmes couleurs que le statut « Accès
// restreint » des demandes de retrait.
export function RestrictedAccessBadge({ title }: { title?: string }) {
  return (
    <Badge variant="outline" className={REMOVAL_STATUS_BADGE_CLASS.accepted} title={title}>
      <Ban />
      Accès restreint
    </Badge>
  )
}
