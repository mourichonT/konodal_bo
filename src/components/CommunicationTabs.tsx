import { NavLink } from "react-router-dom"
import { MessageCircle, Newspaper } from "lucide-react"
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin"
import { cn } from "@/lib/utils"

const tabs = [
  { to: "/communications/fil", label: "Fil d'actualité", shortLabel: "Fil", icon: Newspaper },
  { to: "/communications/chat", label: "Chat Konodal", shortLabel: "Chat", icon: MessageCircle },
]

// Bascule entre les deux sous-pages de Communication, même rendu que les
// onglets Kanban / Liste des Sinistres. Superadmin seulement : une agence ou
// un agent n'a que le fil d'actualité (pas de message in-app).
export function CommunicationTabs() {
  const { isSuperAdmin } = useIsSuperAdmin()
  if (!isSuperAdmin) return null
  return (
    <div className="flex items-center gap-1 rounded-2xl bg-[oklch(93%_0.005_100)] p-1.5 sm:gap-[5px]">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors sm:gap-2 sm:px-[22px] sm:py-[11px] sm:text-[14.5px]",
              isActive
                ? "bg-[oklch(45%_0.1_155)] font-bold text-white shadow-[0_6px_16px_-6px_oklch(38%_0.08_155/0.5)]"
                : "text-[oklch(45%_0.01_150)] hover:bg-[oklch(98%_0.003_100)]"
            )
          }
        >
          <tab.icon className="size-3.5 sm:size-4" />
          <span className="sm:hidden">{tab.shortLabel}</span>
          <span className="hidden sm:inline">{tab.label}</span>
        </NavLink>
      ))}
    </div>
  )
}
