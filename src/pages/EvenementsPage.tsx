import { useMemo, useState } from "react"
import { NavLink, Outlet } from "react-router-dom"
import { toast } from "sonner"
import { Calendar, ChevronDown, List, Plus, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
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
import { useScopedResidenceIds } from "@/hooks/useScopedResidenceIds"
import { cn, PRIMARY_CTA_CLASS } from "@/lib/utils"

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
  { to: "liste", label: "Liste", shortLabel: "Liste", icon: List },
  { to: "calendrier", label: "Calendrier", shortLabel: "Calendrier", icon: Calendar },
]

export default function EvenementsPage() {
  const { user } = useAuth()
  const { scopedResidenceIds } = useScopedResidenceIds()
  const { events, residences, loading } = useAllEvents((message) => toast.error(message), scopedResidenceIds)
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-[26px] font-extrabold tracking-tight text-[oklch(22%_0.01_150)]">Interventions</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex w-fit items-center gap-1 rounded-2xl bg-[oklch(93%_0.005_100)] p-1.5 sm:gap-[5px]">
            {tabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
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
                <span className="sm:hidden">{tab.shortLabel}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </NavLink>
            ))}
          </div>
          <Button onClick={() => setCreating(true)} className={PRIMARY_CTA_CLASS}>
            <Plus />
            Ajouter une intervention
          </Button>
        </div>
      </div>

      <Card className="mb-[30px]">
        <CardContent className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une intervention par mot-clé..."
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
        </CardContent>
      </Card>

      <Outlet context={{ events, loading, filters } satisfies EvenementsOutletContext} />

      <EventFormDialog
        open={creating}
        onOpenChange={setCreating}
        title="Ajouter une intervention"
        residences={residences}
        onSubmit={async (residenceId, input) => {
          if (!user) return
          await createEvent(residenceId, user.uid, input)
          toast.success("Intervention créée")
          setCreating(false)
        }}
      />
    </div>
  )
}
