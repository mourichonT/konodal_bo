import { useEffect, useMemo, useState } from "react"
import { useScopedResidences } from "@/hooks/useScopedResidenceIds"
import { subscribeToResidenceDocuments } from "@/lib/residenceDocuments"
import type { ResidenceDocument } from "@/types/document"

export type ResidenceDocumentWithResidence = ResidenceDocument & { residenceName: string }

// Agrège les documents de toutes les résidences, même choix que
// useAllLots/useAllEvents (pas de collectionGroup disponible côté
// connectkasa) - un listener par résidence, fusionné côté client.
// Périmètre RBAC : résidences de useScopedResidences (portefeuille de la
// gérance pour un compte agence/agent, jamais lues au-delà).
export function useAllResidenceDocuments(
  onError: (message: string) => void) {
  const [byResidence, setByResidence] = useState<Record<string, ResidenceDocument[]>>({})
  const { residences, loading } = useScopedResidences()
  const scopedResidences = residences

  useEffect(() => {
    const unsubscribes = scopedResidences.map((residence) =>
      subscribeToResidenceDocuments(
        residence.id,
        (data) => setByResidence((prev) => ({ ...prev, [residence.id]: data })),
        (error) =>
          onError(`Impossible de charger les documents de ${residence.name} : ${error.message}`)
      )
    )
    return () => unsubscribes.forEach((unsub) => unsub())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedResidences])

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
