import { Navigate, useLocation } from "react-router-dom"
import { PageHeader } from "@/components/PageHeader"
import { KeepAliveViews } from "@/components/KeepAliveViews"
import { UsersSectionToggle } from "@/components/UsersSectionToggle"
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin"
import ResidentsPage from "@/pages/ResidentsPage"
import RemovalRequestsPage from "@/pages/RemovalRequestsPage"
import AccountUnifierPage from "@/pages/AccountUnifierPage"

type UsersView = "annuaire" | "retraits" | "unificateur"

// Utilisateurs : Annuaire (/residents), Demandes de retrait et Unificateur
// (superAdmin). En-tête commun qui reste en place à la bascule, et vues
// gardées montées (KeepAliveViews) : rien n'est reconstruit.
export default function UsersLayout() {
  const { pathname } = useLocation()
  const { isSuperAdmin, loading } = useIsSuperAdmin()
  const view: UsersView = pathname.startsWith("/residents/retraits")
    ? "retraits"
    : pathname.startsWith("/residents/unificateur")
      ? "unificateur"
      : "annuaire"

  if (view !== "annuaire" && !loading && !isSuperAdmin) return <Navigate to="/residents" replace />

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Utilisateurs" toggle={isSuperAdmin && <UsersSectionToggle current={view} />} />
      <KeepAliveViews
        active={view}
        views={{
          annuaire: <ResidentsPage />,
          ...(isSuperAdmin ? { retraits: <RemovalRequestsPage />, unificateur: <AccountUnifierPage /> } : {}),
        }}
      />
    </div>
  )
}
