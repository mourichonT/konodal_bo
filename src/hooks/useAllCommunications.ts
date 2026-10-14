import { useEffect, useMemo, useState } from "react"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/firebase"
import { useScopedResidences } from "@/hooks/useScopedResidenceIds"
import { subscribeToResidenceCommunications } from "@/lib/communications"
import type { Communication } from "@/types/communication"

export type CommunicationWithResidence = Communication & { residenceName: string }

// Même pattern que useAllSinistres : fan-out d'un onSnapshot par résidence
// (pas de collectionGroup côté connectkasa), sur les seules résidences du
// périmètre RBAC (useScopedResidences).
export function useAllCommunications(
  onError: (message: string) => void) {
  const [byResidence, setByResidence] = useState<Record<string, Communication[]>>({})
  const { residences, loading } = useScopedResidences()
  const scopedResidences = residences

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

  const rawCommunications: CommunicationWithResidence[] = useMemo(() => {
    return Object.values(byResidence)
      .flat()
      .map((c) => ({ ...c, residenceName: residenceNameById.get(c.residenceId) ?? c.residenceId }))
  }, [byResidence, residenceNameById])

  // Un résident peut aussi publier un post "communication" depuis l'app
  // (AskingNeighbordsForm) - cette page BO n'est destinée qu'aux annonces
  // officielles publiées par l'agence/gérance ou un superAdmin (accountType
  // agence/agent/superAdmin), pas au fil de discussion résident->résident.
  // Rôle résolu par uid, une fois (accountType ne change pas assez souvent
  // pour justifier un onSnapshot dédié par auteur).
  const [authorRoles, setAuthorRoles] = useState<Record<string, string>>({})
  useEffect(() => {
    const missing = [...new Set(rawCommunications.map((c) => c.user))].filter(
      (uid) => uid && !(uid in authorRoles)
    )
    if (missing.length === 0) return
    missing.forEach((uid) => {
      getDoc(doc(db, "users", uid)).then((snap) => {
        const accountType = snap.exists() ? ((snap.data().accountType as string) ?? "utilisateur") : "utilisateur"
        setAuthorRoles((prev) => ({ ...prev, [uid]: accountType }))
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawCommunications])

  const communications: CommunicationWithResidence[] = useMemo(() => {
    return rawCommunications
      .filter((c) => ["agence", "agent", "superAdmin"].includes(authorRoles[c.user]))
      .sort((a, b) => (b.creationDate?.getTime() ?? 0) - (a.creationDate?.getTime() ?? 0))
  }, [rawCommunications, authorRoles])

  return { communications, residences: scopedResidences, loading }
}
