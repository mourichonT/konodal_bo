import { useEffect, useMemo, useState } from "react"
import { subscribeToResidences } from "@/lib/residences"
import { subscribeToResidenceDocuments } from "@/lib/residenceDocuments"
import type { Residence } from "@/types/residence"
import type { ResidenceDocument } from "@/types/document"

export type ResidenceDocumentWithResidence = ResidenceDocument & { residenceName: string }

// Agrège les documents de toutes les résidences, même choix que
// useAllLots/useAllEvents (pas de collectionGroup disponible côté
// connectkasa) - un listener par résidence, fusionné côté client.
export function useAllResidenceDocuments(onError: (message: string) => void) {
  const [residences, setResidences] = useState<Residence[]>([])
  const [byResidence, setByResidence] = useState<Record<string, ResidenceDocument[]>>({})
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

  useEffect(() => {
    const unsubscribes = residences.map((residence) =>
      subscribeToResidenceDocuments(
        residence.id,
        (data) => setByResidence((prev) => ({ ...prev, [residence.id]: data })),
        (error) =>
          onError(`Impossible de charger les documents de ${residence.name} : ${error.message}`)
      )
    )
    return () => unsubscribes.forEach((unsub) => unsub())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [residences])

  const residenceNameById = useMemo(
    () => new Map(residences.map((r) => [r.id, r.name])),
    [residences]
  )

  const documents: ResidenceDocumentWithResidence[] = useMemo(() => {
    return Object.values(byResidence)
      .flat()
      .map((d) => ({ ...d, residenceName: residenceNameById.get(d.residenceId) ?? d.residenceId }))
  }, [byResidence, residenceNameById])

  return { documents, residences, loading }
}
