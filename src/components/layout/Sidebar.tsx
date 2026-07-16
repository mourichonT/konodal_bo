import { NavLink } from "react-router-dom"
import { LayoutDashboard, Building2, Users, TriangleAlert, Briefcase, LogOut, ChevronsUpDown } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"
import logoKWhite from "@/assets/logo-k-white.png"
import logoHorizontal from "@/assets/logo-horizontal.png"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/sinistres", label: "Sinistres", icon: TriangleAlert },
  { to: "/residences", label: "Résidences", icon: Building2 },
  { to: "/residents", label: "Résidents / bailleurs", icon: Users },
  { to: "/agences", label: "Agences", icon: Briefcase },
]

function initialsFor(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    return (parts[0]?.[0] ?? "").concat(parts[1]?.[0] ?? "").toUpperCase()
  }
  return (email?.[0] ?? "?").toUpperCase()
}

export function Sidebar() {
  const { user, logout } = useAuth()

  return (
    <aside className="relative flex h-full w-64 shrink-0 flex-col overflow-hidden rounded-[30px] bg-sidebar text-sidebar-foreground">
      <img
        src={logoKWhite}
        alt=""
        aria-hidden
        className="pointer-events-none absolute -right-4 bottom-0 w-[269px] max-w-none opacity-10 blur-[2px] select-none"
      />

      <div className="relative flex items-center px-5 py-6">
        <img src={logoHorizontal} alt="Konodal" className="h-[30px] w-auto" />
      </div>

      <nav className="mt-[50px] flex flex-1 flex-col gap-[20px] py-1 pr-[52px]">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "group relative flex items-center gap-3 rounded-l-none rounded-r-2xl py-2.5 pl-6 pr-3 text-sm font-medium",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute bottom-full left-0 size-3",
                    isActive
                      ? "opacity-100 bg-[radial-gradient(circle_at_top_right,transparent_70%,var(--sidebar-primary)_72%)]"
                      : "bg-[radial-gradient(circle_at_top_right,transparent_70%,var(--sidebar-accent)_72%)] opacity-0 group-hover:opacity-100"
                  )}
                />
                <span
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute top-full left-0 size-3",
                    isActive
                      ? "opacity-100 bg-[radial-gradient(circle_at_bottom_right,transparent_70%,var(--sidebar-primary)_72%)]"
                      : "bg-[radial-gradient(circle_at_bottom_right,transparent_70%,var(--sidebar-accent)_72%)] opacity-0 group-hover:opacity-100"
                  )}
                />
                <Icon className="size-4.5" />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-sidebar-border px-3 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-sidebar-accent/50",
              "outline-none focus-visible:bg-sidebar-accent/50"
            )}
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-foreground/15 text-xs font-semibold">
              {initialsFor(user?.displayName, user?.email)}
            </div>
            <div className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate font-medium">
                {user?.displayName || user?.email || "Compte"}
              </span>
              {user?.displayName && (
                <span className="truncate text-xs text-sidebar-foreground/60">{user.email}</span>
              )}
            </div>
            <ChevronsUpDown className="size-4 shrink-0 text-sidebar-foreground/50" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuItem variant="destructive" onClick={() => logout()}>
              <LogOut />
              Déconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}
