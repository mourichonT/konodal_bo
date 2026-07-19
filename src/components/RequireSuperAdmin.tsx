import type { ReactNode } from "react"
import { Navigate } from "react-router-dom"
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin"

export function RequireSuperAdmin({ children }: { children: ReactNode }) {
  const { isSuperAdmin, loading } = useIsSuperAdmin()

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center text-sm text-muted-foreground">
        Chargement…
      </div>
    )
  }

  if (!isSuperAdmin) {
    return <Navigate to="/" replace />
  }

  return children
}
