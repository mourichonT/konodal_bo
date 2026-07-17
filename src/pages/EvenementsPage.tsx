import { useMemo, useState } from "react"
import { NavLink, Outlet } from "react-router-dom"
import { toast } from "sonner"
import { ChevronDown, Plus, Search, X } from "lucide-react"
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
import { EventFormDialog } from "@/components/EventFormDialog"
import { useAuth } from "@/lib/auth-context"
import { createEvent } from "@/lib/events"
import { useAllEvents, type EventWithResidence } from "@/hooks/useAllEvents"
import { cn } from "@/lib/utils"

export type EvenementsFilters = {
  search: string
  residenceFilter: string
  dateFrom: string
  dateTo: string
}

export type EvenementsOutletContext = {
  events: EventWithResidence[]
  loading: boolean
  filters: EvenementsFilters
}

const tabs = [
  { to: "liste", label: "Liste" },
  { to: "calendrier", label: "Calendrier" },
]

export default function EvenementsPage() {
  const { user } = useAuth()
  const { events, residences, loading } = useAllEvents((message) => toast.error(message))
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState("")
  const [residenceFilter, setResidenceFilter] = useState("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const residenceOptions = useMemo(() => {
    const byId = new Map<string, string>()
    for (const e of events) byId.set(e.residenceId, e.residenceName)
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [events])

  const filters: EvenementsFilters = { search, residenceFilter, dateFrom, dateTo }

  function handleClearFilters() {
    setSearch("")
    setResidenceFilter("all")
    setDateFrom("")
    setDateTo("")
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Prestations</h1>
        <div className="flex items-center gap-2">
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
          <Button onClick={() => setCreating(true)}>
            <Plus />
            Ajouter une prestation
          </Button>
        </div>
      </div>

      <div className="mb-[30px] flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une prestation par mot-clé..."
            className="pl-8"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex h-8 items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
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
        <Button variant="outline" size="sm" onClick={handleClearFilters}>
          <X />
          Effacer les filtres
        </Button>
      </div>

      <Outlet context={{ events, loading, filters } satisfies EvenementsOutletContext} />

      <EventFormDialog
        open={creating}
        onOpenChange={setCreating}
        title="Ajouter une prestation"
        residences={residences}
        onSubmit={async (residenceId, input) => {
          if (!user) return
          await createEvent(residenceId, user.uid, input)
          toast.success("Prestation créée")
          setCreating(false)
        }}
      />
    </div>
  )
}
