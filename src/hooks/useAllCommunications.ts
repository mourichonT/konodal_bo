import { useEffect, useMemo, useState } from "react"
import { subscribeToResidences } from "@/lib/residences"
import { subscribeToResidenceCommunications } from "@/lib/communications"
import type { Residence } from "@/types/residence"
import type { Communication } from "@/types/communication"

export type CommunicationWithResidence = Communication & { residenceName: string }

// Même pattern que useAllSinistres : fan-out d'un onSnapshot par résidence
// (pas de collectionGroup côté connectkasa), filtré par scopedResidenceIds
// (périmètre RBAC agence/agent, null = pas de restriction).
export function useAllCommunications(
  onError: (message: string) => void,
  scopedResidenceIds?: Set<string> | null
) {
  const [residences, setResidences] = useState<Residence[]>([])
  const [byResidence, setByResidence] = useState<Record<string, Communication[]>>({})
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
      subscribeToResidenceCommunications(
        residence.id,
        (data) => setByResidence((prev) => ({ ...prev, [residence.id]: data })),
        (error) =>
          onError(`Impossible de charger les communications de ${residence.name} : ${error.message}`)
      )
    )
    return () => unsubscribes.forEach((unsub) => unsub())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedResidences])

  const residenceNameById = useMemo(
    () => new Map(residences.map((r) => [r.id, r.name])),
    [residences]
  )

  const communications: CommunicationWithResidence[] = useMemo(() => {
    return Object.values(byResidence)
      .flat()
      .map((c) => ({ ...c, residenceName: residenceNameById.get(c.residenceId) ?? c.residenceId }))
      .sort((a, b) => (b.creationDate?.getTime() ?? 0) - (a.creationDate?.getTime() ?? 0))
  }, [byResidence, residenceNameById])

  return { communications, loading }
}
