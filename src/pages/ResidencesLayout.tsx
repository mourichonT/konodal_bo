import { Navigate, NavLink, useLocation } from "react-router-dom"
import { Building2, Inbox } from "lucide-react"
import { PageHeader } from "@/components/PageHeader"
import { KeepAliveViews } from "@/components/KeepAliveViews"
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin"
import { usePendingResidenceRequestsCount } from "@/hooks/usePendingResidenceRequestsCount"
import { cn } from "@/lib/utils"
import ResidencesPage from "@/pages/ResidencesPage"
import ResidenceRequestsPage from "@/pages/ResidenceRequestsPage"

// En-tête commun "Résidences" : onglets Actives (liste existante, toujours
// sur /residences pour ne casser aucun lien) et Demandes (inscriptions
// envoyées depuis konodal.com, superAdmin uniquement) - même sélecteur que
// SinistresPage (Kanban/Liste). L'en-tête reste en place à la bascule et les
// vues restent montées (KeepAliveViews) : rien n'est reconstruit.
export default function ResidencesLayout() {
  const { pathname } = useLocation()
  const { isSuperAdmin, loading } = useIsSuperAdmin()
  const pendingCount = usePendingResidenceRequestsCount(isSuperAdmin)
  const view = pathname.startsWith("/residences/demandes") ? "demandes" : "actives"
  const tabs = [
    { to: "/residences", label: "Actives", icon: Building2, end: true },
    ...(isSuperAdmin ? [{ to: "/residences/demandes", label: "Demandes", icon: Inbox, end: true }] : []),
  ]

  if (view === "demandes" && !loading && !isSuperAdmin) return <Navigate to="/residences" replace />

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Résidences"
        toggle={
          tabs.length > 1 && (
            <div className="flex items-center gap-1 rounded-2xl bg-[oklch(93%_0.005_100)] p-1.5 sm:gap-[5px]">
              {tabs.map((tab) => (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  end={tab.end}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors sm:gap-2 sm:px-[22px] sm:py-[11px] sm:text-[14.5px]",
                      isActive
                        ? "bg-[oklch(45%_0.1_155)] font-bold text-white shadow-[0_6px_16px_-6px_oklch(38%_0.08_155/0.5)]"
                        : "text-[oklch(45%_0.01_150)] hover:bg-[oklch(98%_0.003_100)]"
                    )
                  }
                >
                  <tab.icon className="size-3.5 sm:size-4" />
                  {tab.label}
                  {tab.to === "/residences/demandes" && pendingCount > 0 && (
                    <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-[oklch(78%_0.15_75)] px-1 text-[10px] font-bold text-[oklch(25%_0.02_75)]">
                      {pendingCount}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          )
        }
      />
      <KeepAliveViews
        active={view}
        views={{
          actives: <ResidencesPage />,
          ...(isSuperAdmin ? { demandes: <ResidenceRequestsPage /> } : {}),
        }}
      />
    </div>
  )
}
