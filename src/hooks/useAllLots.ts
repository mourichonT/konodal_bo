import { useEffect, useMemo, useState } from "react"
import { subscribeToResidences } from "@/lib/residences"
import { subscribeToLots } from "@/lib/lots"
import type { Residence } from "@/types/residence"
import type { Lot } from "@/types/lot"

export type LotWithResidence = Lot & { residenceId: string; residenceName: string }

// Agrège les lots de toutes les résidences, même choix que useAllSinistres/
// useAllEvents (pas de collectionGroup disponible côté connectkasa).
// scopedResidenceIds : périmètre RBAC (null = pas de restriction, cf.
// useScopedResidenceIds).
export function useAllLots(onError: (message: string) => void, scopedResidenceIds?: Set<string> | null) {
  const [residences, setResidences] = useState<Residence[]>([])
  const [byResidence, setByResidence] = useState<Record<string, Lot[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    return subscribeToResidences(
      (data) => {
        setResidences(data)
        setLoading(false)
      },
      (error) => onError("Impossible de charger les résidences : " + error.message)
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const scopedResidences = useMemo(
    () => (scopedResidenceIds ? residences.filter((r) => scopedResidenceIds.has(r.id)) : residences),
    [residences, scopedResidenceIds]
  )

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
