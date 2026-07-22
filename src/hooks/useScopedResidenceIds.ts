import { useEffect, useState } from "react"
import { useAccountRole } from "@/hooks/useAccountRole"
import { subscribeToResidencesForGerance } from "@/lib/residences"

export type ScopedResidenceIds = {
  // null = pas de restriction (superAdmin, ou rôle utilisateur non
  // concerné) ; Set<string> = uniquement ces résidences (agence/agent).
  scopedResidenceIds: Set<string> | null
  loading: boolean
}

// Périmètre résidence d'un compte agence/agent, à passer aux hooks
// cross-résidence existants (useAllEvents, useAllSinistres, useAllLots,
// useAllContacts, useAllResidenceDocuments...) pour filtrer leurs résultats.
// geranceLocative (gérance locative, accès par LOT et non par résidence
// entière - cf. isProfessionnelLot côté firestore.rules) n'est pas couvert
// ici : ces comptes n'ont pas de vue résidence-large sur Sinistres/
// Interventions/Documents/Utilisateurs, seulement sur leurs lots précis
// (Documents de lot, déjà scopé par sélection explicite du lot) - limitation
// assumée pour cette première itération du RBAC.
export function useScopedResidenceIds(): ScopedResidenceIds {
  const { isSuperAdmin, isAgence, isAgent, geranceId, serviceType, loading: roleLoading } = useAccountRole()
  const [residenceIds, setResidenceIds] = useState<Set<string> | null>(null)
  const [loading, setLoading] = useState(true)

  const isSyndicProfessional = (isAgence || isAgent) && serviceType === "serviceSyndic"

  useEffect(() => {
    if (roleLoading) return
    if (isSuperAdmin || !isSyndicProfessional) {
      setResidenceIds(isSuperAdmin ? null : new Set())
      setLoading(false)
      return
    }
    if (!geranceId) {
      setResidenceIds(new Set())
      setLoading(false)
      return
    }
    setLoading(true)
    return subscribeToResidencesForGerance(
      geranceId,
      (residences) => {
        setResidenceIds(new Set(residences.map((r) => r.id)))
        setLoading(false)
      },
      () => setLoading(false)
    )
  }, [roleLoading, isSuperAdmin, isSyndicProfessional, geranceId])

  return { scopedResidenceIds: residenceIds, loading: roleLoading || loading }
}
