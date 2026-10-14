import { useEffect, useMemo, useState } from "react"
import { useAccountRole } from "@/hooks/useAccountRole"
import { subscribeToResidences, subscribeToResidencesForGerance } from "@/lib/residences"
import type { Residence } from "@/types/residence"

export type ScopedResidenceIds = {
  // null = pas de restriction (superAdmin) ; Set<string> = uniquement ces
  // résidences (agence/agent, vide pour un rôle non concerné et tant que le
  // rôle/le portefeuille se charge - jamais "tout" par défaut).
  scopedResidenceIds: Set<string> | null
  loading: boolean
}

// Résidences du périmètre du compte connecté, lues à la source : toute la
// collection pour un superAdmin, uniquement le portefeuille de sa gérance
// (geranceRef.geranceId) pour un compte agence/agent syndic - une résidence
// hors portefeuille n'est jamais lue, ni a fortiori ses sous-collections
// (sinistres, events, lots...) par les hooks cross-résidence qui partent de
// cette liste. Aucune lecture tant que le rôle n'est pas connu : sans ça, le
// fan-out partait sur TOUTES les résidences le temps du chargement, et
// chaque résidence hors portefeuille levait un "permission denied".
// geranceLocative (gérance locative, accès par LOT et non par résidence
// entière - cf. isProfessionnelLot côté firestore.rules) n'est pas couvert
// ici : ces comptes n'ont pas de vue résidence-large sur Sinistres/
// Interventions/Documents/Utilisateurs, seulement sur leurs lots précis
// (Documents de lot, déjà scopé par sélection explicite du lot) - limitation
// assumée pour cette première itération du RBAC.
export function useScopedResidences(): { residences: Residence[]; isUnrestricted: boolean; loading: boolean } {
  const { isSuperAdmin, isAgence, isAgent, geranceId, serviceType, loading: roleLoading } = useAccountRole()
  const [residences, setResidences] = useState<Residence[]>([])
  const [loading, setLoading] = useState(true)

  const isSyndicProfessional = (isAgence || isAgent) && serviceType === "serviceSyndic"

  useEffect(() => {
    setResidences([])
    if (roleLoading) return
    if (!isSuperAdmin && (!isSyndicProfessional || !geranceId)) {
      setLoading(false)
      return
    }
    setLoading(true)
    const onData = (data: Residence[]) => {
      setResidences(data)
      setLoading(false)
    }
    const onError = () => setLoading(false)
    return isSuperAdmin
      ? subscribeToResidences(onData, onError)
      : subscribeToResidencesForGerance(geranceId!, onData, onError)
  }, [roleLoading, isSuperAdmin, isSyndicProfessional, geranceId])

  return { residences, isUnrestricted: isSuperAdmin, loading: roleLoading || loading }
}

// Ids du périmètre, pour filtrer ce qui ne part pas de la liste des
// résidences (utilisateurs, contacts...).
export function useScopedResidenceIds(): ScopedResidenceIds {
  const { residences, isUnrestricted, loading } = useScopedResidences()
  const scopedResidenceIds = useMemo(
    () => (isUnrestricted && !loading ? null : new Set(residences.map((r) => r.id))),
    [residences, isUnrestricted, loading]
  )
  return { scopedResidenceIds, loading }
}
