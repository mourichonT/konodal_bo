import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { subscribeToUser } from "@/lib/users"
import { subscribeToGerances } from "@/lib/gerances"
import type { Gerance, ServiceType } from "@/types/gerance"

export type AccountRole = {
  accountType: string
  isSuperAdmin: boolean
  // Deux "sièges" vendus par licence à une gérance (une adresse mail = un
  // compte) - même périmètre de résidences, mais seule 'agence' a accès aux
  // actions sensibles/destructrices (cf. isAgenceAccount côté
  // firestore.rules, matrice de droits BO).
  isAgence: boolean
  isAgent: boolean
  // Résolus uniquement pour agence/agent : la gérance où cet uid apparaît
  // dans serviceSyndicAgentUids/geranceLocativeAgentUids (posé par
  // invite_agency_account). null tant que non résolu ou compte non lié.
  geranceId: string | null
  serviceType: ServiceType | null
  loading: boolean
}

// Remplace useIsSuperAdmin (même pattern subscribeToUser) en l'étendant aux
// rôles agence/agent - conservé séparément dans src/hooks/useIsSuperAdmin.ts
// pour les écrans qui n'ont besoin que de ce seul booléen.
export function useAccountRole(): AccountRole {
  const { user } = useAuth()
  const [accountType, setAccountType] = useState<string | null>(null)
  const [userLoading, setUserLoading] = useState(true)
  const [gerances, setGerances] = useState<Gerance[]>([])
  const [gerancesLoading, setGerancesLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setAccountType(null)
      setUserLoading(false)
      return
    }
    setUserLoading(true)
    return subscribeToUser(
      user.uid,
      (konodalUser) => {
        setAccountType(konodalUser?.accountType ?? null)
        setUserLoading(false)
      },
      () => {
        setAccountType(null)
        setUserLoading(false)
      }
    )
  }, [user])

  const isAgence = accountType === "agence"
  const isAgent = accountType === "agent"
  const needsGerance = isAgence || isAgent

  // Peu de gérances au total (annuaire agences) : un seul subscribeToGerances
  // déjà utilisé par AgencesPage, pas besoin d'une requête where() dédiée
  // pour retrouver celle qui référence cet uid.
  useEffect(() => {
    if (!needsGerance) {
      setGerancesLoading(false)
      return
    }
    setGerancesLoading(true)
    return subscribeToGerances(
      (data) => {
        setGerances(data)
        setGerancesLoading(false)
      },
      () => setGerancesLoading(false)
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsGerance])

  const { geranceId, serviceType } = useMemo(() => {
    if (!user || !needsGerance) return { geranceId: null, serviceType: null }
    for (const g of gerances) {
      if (g.serviceSyndicAgentUids?.includes(user.uid)) {
        return { geranceId: g.id, serviceType: "serviceSyndic" as ServiceType }
      }
      if (g.geranceLocativeAgentUids?.includes(user.uid)) {
        return { geranceId: g.id, serviceType: "geranceLocative" as ServiceType }
      }
    }
    return { geranceId: null, serviceType: null }
  }, [gerances, user, needsGerance])

  return {
    accountType: accountType ?? "utilisateur",
    isSuperAdmin: accountType === "superAdmin",
    isAgence,
    isAgent,
    geranceId,
    serviceType,
    loading: userLoading || (needsGerance && gerancesLoading),
  }
}
