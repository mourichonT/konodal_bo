import { useEffect, useMemo, useState } from "react"
import { subscribeToUsersInScope } from "@/lib/users"
import { useScopedResidenceIds } from "@/hooks/useScopedResidenceIds"
import { useAccountRole } from "@/hooks/useAccountRole"
import type { KonodalUser } from "@/types/user"

// Pastille sidebar "Utilisateurs" : nombre de comptes ayant au moins une
// demande de rejoindre un lot en attente de validation (isApprovedLot:
// false), pas l'approbation d'identité (isApproved) - depuis que celle-ci
// n'est plus un prérequis d'accès à l'app (compte créé approuvé par défaut,
// cf. types/user.ts), elle ne reflète plus une file d'attente réelle. Basé
// sur pendingLotResidenceIds, dénormalisé côté serveur sur users/{uid} par
// sync_pending_lot_residences (functions_python/main.py, repo konodal_app) :
// pas de fan-out client sur les sous-collections users/{uid}/lots de tous
// les utilisateurs, ni de collectionGroup (non disponible, cf. lib/users.ts).
// Pas de suivi "vu/non vu" : la pastille reflète simplement le nombre de
// comptes en attente à l'instant T, elle disparaît d'elle-même une fois les
// lots traités (approuvés).
// Superadmin uniquement : s'y ajoutent les demandes de certification en
// attente (certificationStatus "pending") - décision réservée superAdmin,
// cf. CertificationRequestCard. Un compte est compté une seule fois même
// s'il a les deux.
export function usePendingUsersCount(): number {
  const [users, setUsers] = useState<KonodalUser[]>([])
  const { scopedResidenceIds, loading: scopeLoading } = useScopedResidenceIds()
  const { isSuperAdmin } = useAccountRole()

  // Périmètre de l'agence/agent seulement (cf. subscribeToUsersInScope),
  // une fois connu - null pendant le chargement voudrait dire "tout".
  useEffect(() => {
    if (scopeLoading) return
    return subscribeToUsersInScope(scopedResidenceIds, setUsers, () => {})
  }, [scopeLoading, scopedResidenceIds])

  return useMemo(() => {
    const residents = users.filter((u) => (u.accountType || "utilisateur") === "utilisateur")
    const isPendingLot = (u: KonodalUser) =>
      scopedResidenceIds
        ? u.pendingLotResidenceIds.some((residenceId) => scopedResidenceIds.has(residenceId))
        : u.pendingLotResidenceIds.length > 0
    const isPendingCertification = (u: KonodalUser) => isSuperAdmin && u.certificationStatus === "pending"
    return residents.filter((u) => isPendingLot(u) || isPendingCertification(u)).length
  }, [users, scopedResidenceIds, isSuperAdmin])
}
