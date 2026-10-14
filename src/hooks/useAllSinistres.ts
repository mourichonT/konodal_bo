import { useEffect, useMemo, useState } from "react"
import { useScopedResidences } from "@/hooks/useScopedResidenceIds"
import { subscribeToResidenceSinistres } from "@/lib/sinistres"
import type { Sinistre } from "@/types/sinistre"

export type SinistreWithResidence = Sinistre & { residenceName: string }

// Agrège les sinistres de toutes les résidences : pas de collectionGroup
// disponible côté connectkasa (aucune règle/index dédiés, comme pour
// users/*/lots), donc une souscription par résidence plutôt qu'une requête
// globale - choix assumé tant que le nombre de résidences reste modeste.
// Périmètre RBAC : résidences de useScopedResidences (portefeuille de la
// gérance pour un compte agence/agent) - un compte agence/agent n'ouvre
// donc aucun listener sur une résidence hors périmètre.
export function useAllSinistres(onError: (message: string) => void) {
  const [byResidence, setByResidence] = useState<Record<string, Sinistre[]>>({})
  const { residences, loading } = useScopedResidences()
  const scopedResidences = residences

  useEffect(() => {
    const unsubscribes = scopedResidences.map((residence) =>
      subscribeToResidenceSinistres(
        residence.id,
        (data) => setByResidence((prev) => ({ ...prev, [residence.id]: data })),
        (error) =>
          onError(`Impossible de charger les sinistres de ${residence.name} : ${error.message}`)
      )
    )
    return () => unsubscribes.forEach((unsub) => unsub())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedResidences])

  const residenceNameById = useMemo(
    () => new Map(residences.map((r) => [r.id, r.name])),
    [residences]
  )

  const sinistres: SinistreWithResidence[] = useMemo(() => {
    return Object.values(byResidence)
      .flat()
      .map((s) => ({ ...s, residenceName: residenceNameById.get(s.residenceId) ?? s.residenceId }))
      .sort((a, b) => (b.creationDate?.getTime() ?? 0) - (a.creationDate?.getTime() ?? 0))
  }, [byResidence, residenceNameById])

  return { sinistres, loading }
}
