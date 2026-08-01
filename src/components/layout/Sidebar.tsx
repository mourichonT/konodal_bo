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
  Newspaper,
  LogOut,
  ChevronsUpDown,
  ChevronDown,
  UserCircle,
  CreditCard,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin"
import { useAccountRole } from "@/hooks/useAccountRole"
import { usePendingUsersCount } from "@/hooks/usePendingUsersCount"
import { subscribeToUser } from "@/lib/users"
import { cn } from "@/lib/utils"
import { EnvBadge } from "./EnvBadge"
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
  { to: "/communications", label: "Communication", icon: Newspaper },
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

function NavBadge({ count }: { count: number }) {
  return (
    <span
      className="ml-auto flex h-4.5 min-w-4.5 shrink-0 items-center justify-center rounded-full bg-[oklch(78%_0.15_75)] px-1 text-[10px] font-bold text-[oklch(25%_0.02_75)]"
      aria-label={`${count} en attente`}
    >
      {count}
    </span>
  )
}

export function Sidebar() {
  const { user, logout } = useAuth()
  const { isSuperAdmin } = useIsSuperAdmin()
  const { isAgence, isAgent } = useAccountRole()
  const pendingUsersCount = usePendingUsersCount()
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
    <aside
      className="relative flex h-full w-[226px] shrink-0 flex-col overflow-hidden text-sidebar-foreground"
      style={{
        background:
          "linear-gradient(175deg, oklch(28% 0.045 155) 0%, oklch(38% 0.07 152) 60%, oklch(44% 0.085 148) 100%)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -left-14 h-[220px] w-[220px] rounded-full"
        style={{ background: "radial-gradient(circle, oklch(70% 0.09 145 / 0.14), transparent 70%)" }}
      />
      <img
        src={logoKWhite}
        alt=""
        aria-hidden
        className="pointer-events-none absolute -bottom-6 left-1 w-[260px] max-w-none opacity-[0.08] select-none"
      />

      <div className="relative flex items-center px-5 py-6">
        <img src={logoHorizontal} alt="Konodal" className="h-[25.5px] w-auto" />
        <EnvBadge />
      </div>

      <nav className="relative mt-[50px] flex flex-1 flex-col gap-0.5 px-3 py-1">
        {allNavItems.map((item) => {
          if (item.children) {
            const isParentActive = location.pathname.startsWith(item.to)
            const isOpen = openSections[item.to] ?? false
            return (
              <div key={item.to} className="flex flex-col">
                <div
                  className={cn(
                    "group flex items-center gap-3 rounded-xl py-[11px] pr-3 pl-3.5 text-sm font-semibold",
                    isParentActive
                      ? "bg-white/14 text-white"
                      : "text-white/80 hover:bg-white/8 hover:text-white"
                  )}
                >
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
                  <div className="flex flex-col gap-1 py-2 pl-8">
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
                  "flex items-center gap-3 rounded-xl py-[11px] pr-3 pl-3.5 text-sm font-semibold",
                  isActive ? "bg-white/14 text-white" : "text-white/80 hover:bg-white/8 hover:text-white"
                )
              }
            >
              <Icon className="size-4.5" />
              {label}
              {to === "/residents" && pendingUsersCount > 0 && <NavBadge count={pendingUsersCount} />}
            </NavLink>
          )
        })}
      </nav>

      <div className="relative m-3.5 rounded-[14px] bg-white/8">
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "flex w-full items-center gap-2.5 rounded-[14px] px-2.5 py-2.5 text-left text-sm transition-colors hover:bg-white/6",
              "outline-none focus-visible:bg-white/6"
            )}
          >
            <div className="flex size-[34px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-[oklch(90%_0.03_145)] text-xs font-extrabold text-[oklch(35%_0.07_155)]">
              {profilePic ? (
                <img src={profilePic} alt="" className="size-full object-cover" />
              ) : (
                initialsFor(user?.displayName, user?.email)
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate font-semibold text-white">
                {user?.displayName || user?.email || "Compte"}
              </span>
              {user?.displayName && (
                <span className="truncate text-xs text-white/70">{user.email}</span>
              )}
            </div>
            <ChevronsUpDown className="size-3.5 shrink-0 text-white/60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="start"
            sideOffset={8}
            className="rounded-2xl border border-[oklch(94%_0.005_100)] p-0 shadow-[0_20px_44px_-12px_oklch(20%_0.02_150/0.35)]"
          >
            <div className="border-b border-[oklch(95%_0.003_100)] px-3.5 py-2.5">
              <div className="truncate text-[12.5px] font-bold text-[oklch(24%_0.01_150)]">
                {user?.displayName || user?.email || "Compte"}
              </div>
              {user?.displayName && (
                <div className="truncate text-[11px] text-[oklch(55%_0.01_150)]">{user.email}</div>
              )}
            </div>
            <div className="flex flex-col gap-0.5 p-1.5">
              <DropdownMenuItem
                render={<Link to="/profil" />}
                className="gap-2.5 rounded-[10px] px-2.5 py-2.5 text-[13px] font-semibold"
              >
                <UserCircle />
                Profil
              </DropdownMenuItem>
              {/* Facturation propre à l'agence de ce compte (abonnement Stripe
                  par siège) - réservée à l'agence elle-même, jamais à un
                  simple Agent (action sensible : paiement, moyen de paiement,
                  résiliation - même logique que les autres actions réservées
                  à l'agence dans ce BO) ni à Super Admin (pas de gérance
                  propre). */}
              {isAgence && (
                <DropdownMenuItem
                  render={<Link to="/facturation" />}
                  className="gap-2.5 rounded-[10px] px-2.5 py-2.5 text-[13px] font-semibold"
                >
                  <CreditCard />
                  Facturation
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                variant="destructive"
                onClick={() => logout()}
                className="gap-2.5 rounded-[10px] px-2.5 py-2.5 text-[13px] font-semibold"
              >
                <LogOut />
                Déconnexion
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}
