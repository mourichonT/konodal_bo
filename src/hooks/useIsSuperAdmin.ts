import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { subscribeToUser } from "@/lib/users"

// Tous les comptes BO actuels sont promus superAdmin manuellement (hors app),
// mais rien ne l'impose techniquement - ce hook lit le vrai accountType du
// compte connecté plutôt que de le supposer, pour gater les écrans réservés
// (ex: campagnes publicitaires) de façon correcte si un rôle BO moins
// privilégié apparaît un jour.
export function useIsSuperAdmin(): { isSuperAdmin: boolean; loading: boolean } {
  const { user } = useAuth()
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setIsSuperAdmin(false)
      setLoading(false)
      return
    }
    setLoading(true)
    return subscribeToUser(
      user.uid,
      (konodalUser) => {
        setIsSuperAdmin(konodalUser?.accountType === "superAdmin")
        setLoading(false)
      },
      () => {
        setIsSuperAdmin(false)
        setLoading(false)
      }
    )
  }, [user])

  return { isSuperAdmin, loading }
}
