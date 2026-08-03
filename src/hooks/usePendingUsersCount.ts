import { useEffect, useMemo, useState } from "react"
import { subscribeToUsers } from "@/lib/users"
import { useScopedResidenceIds } from "@/hooks/useScopedResidenceIds"
import { useAllLots } from "@/hooks/useAllLots"
import type { KonodalUser } from "@/types/user"

// Référence stable : si on passait `new Set()` en ligne, useAllLots
// recevrait une nouvelle référence à chaque rendu (scopedResidences
// recalculé, donc les abonnements lots resouscrits en boucle).
const NO_RESIDENCES = new Set<string>()

// Même périmètre que ResidentsPage.tsx (comptes 'utilisateur' non approuvés,
// filtrés par les lots du périmètre agence/agent) - dupliqué ici plutôt que
// dérivé de la page, pour rester utilisable depuis la sidebar sans monter
// ResidentsPage. Pas de suivi "vu/non vu" : la pastille reflète simplement le
// nombre de comptes en attente à l'instant T, elle disparaît d'elle-même une
// fois les comptes traités (approuvés/rejetés).
export function usePendingUsersCount(): number {
  const [users, setUsers] = useState<KonodalUser[]>([])
  const { scopedResidenceIds } = useScopedResidenceIds()
  // Superadmin (scopedResidenceIds === null) n'a pas besoin des lots, cf.
  // ci-dessous - NO_RESIDENCES évite d'abonner cette sidebar (montée sur
  // toutes les pages) aux lots de TOUTES les résidences pour un résultat
  // inutilisé dans ce cas.
  const { lots: scopedLots } = useAllLots(() => {}, scopedResidenceIds ?? NO_RESIDENCES)

  useEffect(() => {
    return subscribeToUsers(setUsers, () => {})
  }, [])

  return useMemo(() => {
    const residents = users.filter((u) => (u.accountType || "utilisateur") === "utilisateur")
    // Un compte refusé garde isApproved: false (cf. rejectUser dans
    // lib/users.ts) - !rejectionReason exclut ces comptes déjà traités, sans
    // quoi la pastille ne disparaissait jamais après un refus.
    const isPending = (u: KonodalUser) => !u.isApproved && !u.rejectionReason
    if (!scopedResidenceIds) return residents.filter(isPending).length
    const allowedUids = new Set(scopedLots.flatMap((l) => [...l.idProprietaire, ...l.idLocataire]))
    return residents.filter((u) => isPending(u) && allowedUids.has(u.uid)).length
  }, [users, scopedResidenceIds, scopedLots])
}
