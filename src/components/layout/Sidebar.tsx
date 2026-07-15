import { NavLink } from "react-router-dom"
import { LayoutDashboard, Building2, Users, TriangleAlert, LogOut } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/sinistres", label: "Sinistres", icon: TriangleAlert },
  { to: "/residences", label: "Résidences", icon: Building2 },
  { to: "/residents", label: "Résidents / bailleurs", icon: Users },
]

export function Sidebar() {
  const { logout } = useAuth()

  return (
    <aside className="flex h-svh w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="px-5 py-6">
        <span className="text-xl font-bold">Konodal Backoffice</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              )
            }
          >
            <Icon className="size-4.5" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 pb-6">
        <button
          type="button"
          onClick={() => logout()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
        >
          <LogOut className="size-4.5" />
          Déconnexion
        </button>
      </div>
    </aside>
  )
}
