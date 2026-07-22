import { useEffect, useState } from "react"
import { Link, NavLink, useLocation } from "react-router-dom"
import {
  LayoutDashboard,
  Building2,
  Users,
  TriangleAlert,
  Wrench,
  Briefcase,
  BookUser,
  FileText,
  Megaphone,
  LogOut,
  ChevronsUpDown,
  ChevronDown,
  UserCircle,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin"
import { useAccountRole } from "@/hooks/useAccountRole"
import { subscribeToUser } from "@/lib/users"
import { cn } from "@/lib/utils"
import logoKWhite from "@/assets/logo-k-white.png"
import logoHorizontal from "@/assets/logo-horizontal.png"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type NavItem = {
  to: string
  label: string
  icon: typeof LayoutDashboard
  end?: boolean
  children?: { to: string; label: string }[]
}

const navItems: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  {
    to: "/sinistres",
    label: "Sinistres",
    icon: TriangleAlert,
    children: [
      { to: "/sinistres/kanban", label: "Tableau Kanban" },
      { to: "/sinistres/liste", label: "Liste des sinistres" },
    ],
  },
  {
    to: "/evenements",
    label: "Interventions",
    icon: Wrench,
    children: [
      { to: "/evenements/calendrier", label: "Calendrier" },
      { to: "/evenements/liste", label: "Liste des interventions" },
    ],
  },
  { to: "/residences", label: "Résidences", icon: Building2 },
  { to: "/residents", label: "Utilisateurs", icon: Users },
  { to: "/agences", label: "Agences", icon: Briefcase },
  { to: "/contacts", label: "Contacts", icon: BookUser },
  { to: "/documents", label: "Documents", icon: FileText },
]

const superAdminNavItems: NavItem[] = [
  { to: "/publicites", label: "Publicités", icon: Megaphone, end: true },
]

function initialsFor(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    return (parts[0]?.[0] ?? "").concat(parts[1]?.[0] ?? "").toUpperCase()
  }
  return (email?.[0] ?? "?").toUpperCase()
}

// Section rétractable (Sinistres, Interventions...) : ouverte par défaut si
// son chemin est actif, refermée dès qu'on navigue ailleurs - state partagé
// par toutes les sections plutôt qu'un booléen dédié par section (pattern
// dupliqué une première fois avec Interventions après Sinistres).
function useOpenSections(navItems: { to: string; children?: unknown }[]) {
  const location = useLocation()
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      navItems
        .filter((item) => item.children)
        .map((item) => [item.to, location.pathname.startsWith(item.to)])
    )
  )

  useEffect(() => {
    setOpenSections((prev) => {
      const next = { ...prev }
      let changed = false
      for (const item of navItems) {
        if (!item.children) continue
        if (!location.pathname.startsWith(item.to) && next[item.to]) {
          next[item.to] = false
          changed = true
        }
      }
      return changed ? next : prev
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  return [
    openSections,
    (to: string) => setOpenSections((prev) => ({ ...prev, [to]: !prev[to] })),
  ] as const
}

export function Sidebar() {
  const { user, logout } = useAuth()
  const { isSuperAdmin } = useIsSuperAdmin()
  const { isAgence, isAgent } = useAccountRole()
  const location = useLocation()
  // profil.profilPic n'est pas porté par Firebase Auth (displayName/photoURL
  // ne sont jamais renseignés côté résident) - souscription dédiée à sa
  // propre fiche users/{uid} pour que l'avatar suive la photo posée depuis
  // /profil sans recharger la page.
  const [profilePic, setProfilePic] = useState<string | undefined>(undefined)
  useEffect(() => {
    if (!user) {
      setProfilePic(undefined)
      return
    }
    return subscribeToUser(
      user.uid,
      (data) => setProfilePic(data?.profilePic),
      () => setProfilePic(undefined)
    )
  }, [user])
  // "Agences" (répertoire, Superadmin) devient "Agence" au singulier pour
  // une Agence (la page pointe alors sur sa propre fiche, pas un annuaire -
  // cf. AgencesPage.tsx, OwnAgencyPage) et disparaît entièrement pour un
  // Agent (consultation retirée du menu, cf. demande explicite).
  const baseNavItems: NavItem[] = isAgent
    ? navItems.filter((item) => item.to !== "/agences")
    : isAgence
      ? navItems.map((item) => (item.to === "/agences" ? { ...item, label: "Agence" } : item))
      : navItems
  const allNavItems: NavItem[] = isSuperAdmin ? [...baseNavItems, ...superAdminNavItems] : baseNavItems
  const [openSections, toggleSection] = useOpenSections(allNavItems)

  return (
    <aside className="relative flex h-full w-[226px] shrink-0 flex-col overflow-hidden rounded-[30px] bg-sidebar text-sidebar-foreground">
      <img
        src={logoKWhite}
        alt=""
        aria-hidden
        className="pointer-events-none absolute -right-4 bottom-0 w-[269px] max-w-none opacity-5 blur-[2px] select-none"
      />

      <div className="relative flex items-center px-5 py-6">
        <img src={logoHorizontal} alt="Konodal" className="h-[30px] w-auto" />
      </div>

      <nav className="mt-[50px] flex flex-1 flex-col gap-0 py-1 pr-[52px]">
        {allNavItems.map((item) => {
          if (item.children) {
            const isParentActive = location.pathname.startsWith(item.to)
            const isOpen = openSections[item.to] ?? false
            return (
              <div key={item.to} className="flex flex-col">
                <div
                  className={cn(
                    "group relative flex items-center gap-3 rounded-tl-none rounded-bl-[23px] rounded-r-2xl py-[14.5px] pl-6 pr-3 text-sm font-medium",
                    isParentActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute bottom-full left-0 size-[20px]",
                      isParentActive
                        ? "opacity-100 bg-[radial-gradient(circle_at_top_right,transparent_70%,var(--sidebar-primary)_72%)]"
                        : "bg-[radial-gradient(circle_at_top_right,transparent_70%,var(--sidebar-accent)_72%)] opacity-0 group-hover:opacity-100"
                    )}
                  />
                  <NavLink to={item.to} className="flex flex-1 items-center gap-3">
                    <item.icon className="size-4.5" />
                    {item.label}
                  </NavLink>
                  <button
                    type="button"
                    aria-label={isOpen ? "Réduire" : "Développer"}
                    onClick={() => toggleSection(item.to)}
                    className="shrink-0 cursor-pointer"
                  >
                    <ChevronDown className={cn("size-4 transition-transform", isOpen && "rotate-180")} />
                  </button>
                </div>
                {isOpen && (
                  <div className="flex flex-col gap-1 py-2 pl-[7px]">
                    {item.children.map((child) => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        title={child.label}
                        className={({ isActive }) =>
                          cn(
                            "flex min-w-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm",
                            isActive
                              ? "font-medium text-white"
                              : "text-sidebar-foreground/60 hover:text-sidebar-foreground"
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <span
                              aria-hidden
                              className={cn(
                                "size-1.5 shrink-0 rounded-full bg-white",
                                isActive ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <span className="truncate">{child.label}</span>
                          </>
                        )}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )
          }

          const { to, label, icon: Icon, end } = item
          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "group relative flex items-center gap-3 rounded-tl-none rounded-bl-[23px] rounded-r-2xl py-[14.5px] pl-6 pr-3 text-sm font-medium",
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
                      "pointer-events-none absolute bottom-full left-0 size-[20px]",
                      isActive
                        ? "opacity-100 bg-[radial-gradient(circle_at_top_right,transparent_70%,var(--sidebar-primary)_72%)]"
                        : "bg-[radial-gradient(circle_at_top_right,transparent_70%,var(--sidebar-accent)_72%)] opacity-0 group-hover:opacity-100"
                    )}
                  />
                  <Icon className="size-4.5" />
                  {label}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      <div className="border-t border-sidebar-border px-3 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-sidebar-accent/50",
              "outline-none focus-visible:bg-sidebar-accent/50"
            )}
          >
            <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sidebar-foreground/15 text-xs font-semibold">
              {profilePic ? (
                <img src={profilePic} alt="" className="size-full object-cover" />
              ) : (
                initialsFor(user?.displayName, user?.email)
              )}
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
            <DropdownMenuItem render={<Link to="/profil" />}>
              <UserCircle />
              Profil
            </DropdownMenuItem>
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
