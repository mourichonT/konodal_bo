import type { ReactNode } from "react"
import { Navigate } from "react-router-dom"
import { useAuth } from "@/lib/auth-context"
import { useAccountRole } from "@/hooks/useAccountRole"
import { Button } from "@/components/ui/button"

// Porte d'entrée du BO : être authentifié (Firebase Auth) ne suffit pas, il
// faut aussi avoir un accountType admis ici (superAdmin/agence/agent) - un
// résident/bailleur classique ('utilisateur') a un compte Firebase Auth
// valide comme n'importe qui d'autre, mais ne doit jamais voir l'app BO
// (ex: users/{uid} est lisible par tout signé côté firestore.rules, pour
// les besoins de l'app mobile - rien ne l'empêchait donc de charger la
// liste complète des résidents/agences avant ce garde-fou).
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading: authLoading, logout } = useAuth()
  const { isSuperAdmin, isAgence, isAgent, loading: roleLoading } = useAccountRole()

  if (authLoading || (user && roleLoading)) {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
        Chargement…
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!isSuperAdmin && !isAgence && !isAgent) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 p-4 text-center">
        <p className="text-sm font-medium">Ce compte n'a pas accès au backoffice.</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Connecte-toi avec un compte administrateur, agence ou agent.
        </p>
        <Button variant="outline" onClick={() => logout()}>
          Se déconnecter
        </Button>
      </div>
    )
  }

  return children
}
