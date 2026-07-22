import { useEffect, useMemo, useState } from "react"
import { NavLink, Outlet, useLocation } from "react-router-dom"
import { toast } from "sonner"
import { ChevronDown, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DateInput } from "@/components/DateInput"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAllSinistres, type SinistreWithResidence } from "@/hooks/useAllSinistres"
import { useScopedResidenceIds } from "@/hooks/useScopedResidenceIds"
import { SHOW_ARCHIVED_KEY, SHOW_NON_DECLARES_KEY } from "@/types/sinistre"
import { cn } from "@/lib/utils"

export type SinistresFilters = {
  search: string
  residenceFilter: string
  dateFrom: string
  dateTo: string
  showNonDeclares: boolean
  showArchived: boolean
}

export type SinistresOutletContext = {
  sinistres: SinistreWithResidence[]
  loading: boolean
  filters: SinistresFilters
}

const tabs = [
  { to: "kanban", label: "Tableau Kanban" },
  { to: "liste", label: "Liste" },
]

export default function SinistresPage() {
  const location = useLocation()
  const isListeTab = location.pathname.endsWith("/liste")
  const { scopedResidenceIds } = useScopedResidenceIds()
  const { sinistres, loading } = useAllSinistres((message) => toast.error(message), scopedResidenceIds)
  // Filtres partagés entre Kanban et Liste (un seul objet, cf. décision : les
  // deux vues doivent toujours montrer le même sous-ensemble de tickets) -
  // seul le statut cliqué sur les KPI de la vue Liste reste propre à cette vue.
  const [search, setSearch] = useState("")
  const [residenceFilter, setResidenceFilter] = useState("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [showNonDeclares, setShowNonDeclares] = useState(
    () => localStorage.getItem(SHOW_NON_DECLARES_KEY) !== "false"
  )
  const [showArchived, setShowArchived] = useState(
    () => localStorage.getItem(SHOW_ARCHIVED_KEY) === "true"
  )

  useEffect(() => {
    localStorage.setItem(SHOW_NON_DECLARES_KEY, String(showNonDeclares))
  }, [showNonDeclares])

  useEffect(() => {
    localStorage.setItem(SHOW_ARCHIVED_KEY, String(showArchived))
  }, [showArchived])

  const residenceOptions = useMemo(() => {
    const byId = new Map<string, string>()
    for (const s of sinistres) byId.set(s.residenceId, s.residenceName)
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [sinistres])

  const filters: SinistresFilters = {
    search,
    residenceFilter,
    dateFrom,
    dateTo,
    showNonDeclares,
    showArchived,
  }

  function handleClearFilters() {
    setSearch("")
    setResidenceFilter("all")
    setDateFrom("")
    setDateTo("")
    setShowNonDeclares(true)
    setShowArchived(false)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Sinistres</h1>
        <div className="flex gap-2">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      </div>

      <div className="mb-[30px] flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un ticket par mot-clé..."
            className="pl-8"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex h-8 items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Résidence :{" "}
            {residenceFilter === "all"
              ? "Toutes"
              : (residenceOptions.find(([id]) => id === residenceFilter)?.[1] ?? "Toutes")}
            <ChevronDown className="size-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuRadioGroup value={residenceFilter} onValueChange={setResidenceFilter}>
              <DropdownMenuLabel>Résidence</DropdownMenuLabel>
              <DropdownMenuRadioItem value="all">Toutes les résidences</DropdownMenuRadioItem>
              {residenceOptions.map(([id, name]) => (
                <DropdownMenuRadioItem key={id} value={id}>
                  {name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <span>Du</span>
          <DateInput value={dateFrom} onChange={setDateFrom} />
          <span>au</span>
          <DateInput value={dateTo} onChange={setDateTo} />
        </div>
        {isListeTab && (
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="size-4 rounded border-input accent-primary"
            />
            Afficher les tickets archivés
          </label>
        )}
        <Button variant="outline" size="sm" onClick={handleClearFilters}>
          <X />
          Effacer les filtres
        </Button>
        <label className="ml-auto flex items-center gap-1.5 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={showNonDeclares}
            onChange={(e) => setShowNonDeclares(e.target.checked)}
            className="size-4 rounded border-input accent-primary"
          />
          Afficher les tickets non déclarés
        </label>
      </div>

      <Outlet context={{ sinistres, loading, filters } satisfies SinistresOutletContext} />
    </div>
  )
}
