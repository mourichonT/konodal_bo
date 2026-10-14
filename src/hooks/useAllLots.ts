import { useEffect, useMemo, useState } from "react"
import { useScopedResidences } from "@/hooks/useScopedResidenceIds"
import { subscribeToLots } from "@/lib/lots"
import type { Lot } from "@/types/lot"

export type LotWithResidence = Lot & { residenceId: string; residenceName: string }

// Agrège les lots de toutes les résidences, même choix que useAllSinistres/
// useAllEvents (pas de collectionGroup disponible côté connectkasa).
// Périmètre RBAC : résidences de useScopedResidences (portefeuille de la
// gérance pour un compte agence/agent, jamais lues au-delà).
export function useAllLots(onError: (message: string) => void) {
  const [byResidence, setByResidence] = useState<Record<string, Lot[]>>({})
  const { residences, loading } = useScopedResidences()
  const scopedResidences = residences

  useEffect(() => {
    const unsubscribes = scopedResidences.map((residence) =>
      subscribeToLots(
        residence.id,
        (data) => setByResidence((prev) => ({ ...prev, [residence.id]: data })),
        (error) =>
          onError(`Impossible de charger les lots de ${residence.name} : ${error.message}`)
      )
    )
    return () => unsubscribes.forEach((unsub) => unsub())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedResidences])

  const residenceNameById = useMemo(
    () => new Map(residences.map((r) => [r.id, r.name])),
    [residences]
  )

  const lots: LotWithResidence[] = useMemo(() => {
    return Object.entries(byResidence).flatMap(([residenceId, residenceLots]) =>
      residenceLots.map((l) => ({
        ...l,
        residenceId,
        residenceName: residenceNameById.get(residenceId) ?? residenceId,
      }))
    )
  }, [byResidence, residenceNameById])

  return { lots, residences, loading }
}
