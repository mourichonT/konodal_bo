import { useEffect, useMemo, useState } from "react"
import { subscribeToResidences } from "@/lib/residences"
import { subscribeToResidenceSinistres } from "@/lib/sinistres"
import type { Residence } from "@/types/residence"
import type { Sinistre } from "@/types/sinistre"

export type SinistreWithResidence = Sinistre & { residenceName: string }

// Agrège les sinistres de toutes les résidences : pas de collectionGroup
// disponible côté connectkasa (aucune règle/index dédiés, comme pour
// users/*/lots), donc une souscription par résidence plutôt qu'une requête
// globale - choix assumé tant que le nombre de résidences reste modeste.
export function useAllSinistres(onError: (message: string) => void) {
  const [residences, setResidences] = useState<Residence[]>([])
  const [byResidence, setByResidence] = useState<Record<string, Sinistre[]>>({})
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
      subscribeToResidenceSinistres(
        residence.id,
        (data) => setByResidence((prev) => ({ ...prev, [residence.id]: data })),
        (error) =>
          onError(`Impossible de charger les sinistres de ${residence.name} : ${error.message}`)
      )
    )
    return () => unsubscribes.forEach((unsub) => unsub())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [residences])

  const residenceNameById = useMemo(
    () => new Map(residences.map((r) => [r.id, r.name])),
    [residences]
  )

  const sinistres: SinistreWithResidence[] = useMemo(() => {
    return Object.values(byResidence)
      .flat()
      .map((s) => ({ ...s, residenceName: residenceNameById.get(s.residenceId) ?? s.residenceId }))
      .sort((a, b) => (b.timeStamp?.getTime() ?? 0) - (a.timeStamp?.getTime() ?? 0))
  }, [byResidence, residenceNameById])

  return { sinistres, loading }
}
