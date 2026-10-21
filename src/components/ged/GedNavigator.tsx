import { useEffect, useMemo, useRef, useState } from "react"
import { Building2, ChevronDown, ChevronLeft, ChevronRight, Clock, FileText, Home, Layers, Pin, PinOff, Search, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { lotDisplayLabel } from "@/types/lot"
import type { Lot } from "@/types/lot"
import type { Residence } from "@/types/residence"
import type { StructureResidence } from "@/types/structure"
import type { GedOverview } from "@/types/ged"
import {
  PINNED_KEY,
  RECENT_KEY,
  readStoredIds,
  writeStoredIds,
  type GedSelection,
} from "@/components/ged/gedSelection"

const LIST_PREVIEW = 6
const LOT_PREVIEW = 6

function fold(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

const natural = (a: string, b: string) => a.localeCompare(b, "fr", { numeric: true })

function NavItem({
  icon: Icon,
  label,
  count,
  internal,
  active,
  onClick,
  trailing,
  className,
}: {
  icon: typeof FileText
  label: string
  count?: number
  internal?: number
  active?: boolean
  onClick: () => void
  trailing?: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-[oklch(96%_0.005_100)]",
        active && "bg-[oklch(94%_0.03_155)] font-semibold text-[oklch(32%_0.07_155)] hover:bg-[oklch(94%_0.03_155)]",
        className
      )}
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {!!internal && (
        <span className="rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-800" title="Non partagés">
          {internal}
        </span>
      )}
      {count !== undefined && <span className="text-xs text-muted-foreground tabular-nums">{count}</span>}
      {trailing}
    </button>
  )
}

// Colonne de gauche de l'onglet Documents (maquette 1a, 1b, 2a, 2b) :
// corbeille, puis la liste des résidences (recherche, épinglées, récentes,
// index A à Z) ou, dans une résidence, ses documents, ses bâtiments et leurs
// lots avec leurs compteurs (ged_overview).
export function GedNavigator({
  residences,
  overview,
  selection,
  onSelect,
  structures,
  lots,
}: {
  residences: Residence[]
  overview: GedOverview | null
  selection: GedSelection
  onSelect: (selection: GedSelection) => void
  structures: StructureResidence[]
  lots: Lot[]
}) {
  const residenceId = "residenceId" in selection ? selection.residenceId : null
  const residence = residences.find((r) => r.id === residenceId) ?? null
  return (
    <nav className="flex min-w-0 flex-col gap-3">
      <NavItem
        icon={Trash2}
        label="Corbeille"
        count={overview?.totals.trash}
        active={selection.kind === "trash"}
        onClick={() => onSelect({ kind: "trash" })}
      />
      <div className="h-px bg-border" />
      {residence ? (
        <ResidenceTree
          residence={residence}
          overview={overview}
          selection={selection}
          onSelect={onSelect}
          structures={structures}
          lots={lots}
        />
      ) : (
        <ResidenceList residences={residences} overview={overview} onSelect={onSelect} />
      )}
    </nav>
  )
}

function ResidenceList({
  residences,
  overview,
  onSelect,
}: {
  residences: Residence[]
  overview: GedOverview | null
  onSelect: (selection: GedSelection) => void
}) {
  const [query, setQuery] = useState("")
  const [highlight, setHighlight] = useState(0)
  const [showAll, setShowAll] = useState(false)
  const [letter, setLetter] = useState<string | null>(null)
  const [pinned, setPinned] = useState<string[]>(() => readStoredIds(PINNED_KEY))
  const recent = useMemo(() => readStoredIds(RECENT_KEY), [])
  const sorted = useMemo(() => [...residences].sort((a, b) => natural(a.name, b.name)), [residences])
  const byId = useMemo(() => new Map(residences.map((r) => [r.id, r])), [residences])

  const matches = useMemo(() => {
    const q = fold(query.trim())
    if (!q) return []
    return sorted.filter((r) => fold(`${r.name} ${r.address?.city ?? ""}`).includes(q))
  }, [query, sorted])

  function open(residence: Residence) {
    onSelect({ kind: "residence", residenceId: residence.id })
  }

  function togglePin(id: string) {
    const next = pinned.includes(id) ? pinned.filter((p) => p !== id) : [...pinned, id]
    setPinned(next)
    writeStoredIds(PINNED_KEY, next)
  }

  const row = (r: Residence) => (
    <NavItem
      key={r.id}
      icon={Building2}
      label={r.name}
      count={overview?.residences[r.id]?.documents ?? 0}
      internal={overview?.residences[r.id]?.internal}
      onClick={() => open(r)}
      trailing={
        <span
          role="button"
          tabIndex={-1}
          title={pinned.includes(r.id) ? "Désépingler" : "Épingler"}
          onClick={(e) => {
            e.stopPropagation()
            togglePin(r.id)
          }}
          className="invisible rounded p-0.5 text-muted-foreground group-hover:visible hover:bg-white"
        >
          {pinned.includes(r.id) ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
        </span>
      }
    />
  )

  const letters = [...new Set(sorted.map((r) => fold(r.name).charAt(0).toUpperCase()).filter(Boolean))]
  const allList = letter ? sorted.filter((r) => fold(r.name).toUpperCase().startsWith(letter)) : sorted
  const visible = showAll || letter ? allList : allList.slice(0, LIST_PREVIEW)
  const pinnedList = pinned.map((id) => byId.get(id)).filter((r): r is Residence => !!r)
  const recentList = recent
    .filter((id) => !pinned.includes(id))
    .map((id) => byId.get(id))
    .filter((r): r is Residence => !!r)
    .slice(0, 3)

  return (
    <div className="flex flex-col gap-3">
      <p className="px-2 text-sm font-bold">
        Résidences <span className="font-normal text-muted-foreground">· {residences.length}</span>
      </p>
      <div className="relative">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setHighlight(0)
          }}
          onKeyDown={(e) => {
            if (!matches.length) return
            if (e.key === "ArrowDown") {
              e.preventDefault()
              setHighlight((h) => Math.min(h + 1, Math.min(matches.length, 8) - 1))
            } else if (e.key === "ArrowUp") {
              e.preventDefault()
              setHighlight((h) => Math.max(h - 1, 0))
            } else if (e.key === "Enter") {
              e.preventDefault()
              open(matches[highlight])
            }
          }}
          placeholder="Rechercher une résidence…"
          className="pl-8"
        />
      </div>

      {query.trim() ? (
        <div className="flex flex-col gap-1">
          <p className="px-2 text-xs text-muted-foreground">
            {matches.length} résultat{matches.length > 1 ? "s" : ""} sur {residences.length}
          </p>
          {matches.slice(0, 8).map((r, i) => (
            <button
              key={r.id}
              type="button"
              onMouseEnter={() => setHighlight(i)}
              onClick={() => open(r)}
              className={cn(
                "flex flex-col rounded-lg px-2 py-1.5 text-left text-sm",
                i === highlight ? "bg-[oklch(94%_0.03_155)]" : "hover:bg-[oklch(96%_0.005_100)]"
              )}
            >
              <span className="font-medium">{r.name}</span>
              <span className="text-xs text-muted-foreground">
                {[r.address?.city, `${r.totalLot ?? 0} lots`].filter(Boolean).join(" · ")}
              </span>
            </button>
          ))}
          {matches.length > 0 && (
            <p className="px-2 text-[11px] text-muted-foreground">↑↓ naviguer · ↵ ouvrir</p>
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            {pinnedList.length > 0 && (
              <div className="flex flex-col gap-0.5">
                <p className="flex items-center gap-1 px-2 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                  <Pin className="size-3" /> Épinglées
                </p>
                {pinnedList.map(row)}
              </div>
            )}
            {recentList.length > 0 && (
              <div className="flex flex-col gap-0.5">
                <p className="flex items-center gap-1 px-2 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                  <Clock className="size-3" /> Récentes
                </p>
                {recentList.map(row)}
              </div>
            )}
            <div className="flex flex-col gap-0.5">
              <p className="px-2 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                {letter ? `Lettre ${letter}` : "Toutes · A à Z"}
              </p>
              {visible.map(row)}
              {!letter && !showAll && allList.length > LIST_PREVIEW && (
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="px-2 py-1 text-left text-xs font-semibold text-[oklch(42%_0.08_155)] hover:underline"
                >
                  Afficher les {allList.length - LIST_PREVIEW} autres
                </button>
              )}
              {letter && (
                <button
                  type="button"
                  onClick={() => setLetter(null)}
                  className="px-2 py-1 text-left text-xs font-semibold text-[oklch(42%_0.08_155)] hover:underline"
                >
                  Toutes les lettres
                </button>
              )}
            </div>
          </div>
          {letters.length > 4 && (
            <div className="flex flex-col items-center gap-0.5 pt-6 text-[10px] font-semibold text-muted-foreground">
              {letters.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLetter(letter === l ? null : l)}
                  className={cn("w-4 rounded hover:text-foreground", letter === l && "bg-[oklch(94%_0.03_155)] text-foreground")}
                >
                  {l}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ResidenceTree({
  residence,
  overview,
  selection,
  onSelect,
  structures,
  lots,
}: {
  residence: Residence
  overview: GedOverview | null
  selection: GedSelection
  onSelect: (selection: GedSelection) => void
  structures: StructureResidence[]
  lots: Lot[]
}) {
  const stats = overview?.residences[residence.id]
  const selectedLot = selection.kind === "lot" ? lots.find((l) => l.id === selection.lotId) : undefined
  const activeBuilding =
    selection.kind === "building" ? selection.batiment : selectedLot ? selectedLot.batiment : null
  const [expanded, setExpanded] = useState<string | null>(activeBuilding)
  const [showAllLots, setShowAllLots] = useState(false)
  const lastResidence = useRef(residence.id)

  useEffect(() => {
    if (activeBuilding) setExpanded(activeBuilding)
  }, [activeBuilding])

  useEffect(() => {
    if (lastResidence.current !== residence.id) {
      lastResidence.current = residence.id
      setExpanded(activeBuilding)
      setShowAllLots(false)
    }
  }, [residence.id, activeBuilding])

  // Bâtiments = structures (« <type> <nom> », même libellé que lot.batiment),
  // plus les bâtiments cités par des lots sans structure correspondante.
  const buildings = useMemo(() => {
    const names = structures.map((s) => `${s.type} ${s.name}`.trim())
    for (const lot of lots) if (lot.batiment && !names.includes(lot.batiment)) names.push(lot.batiment)
    return names
  }, [structures, lots])

  const lotsByBuilding = useMemo(() => {
    const map = new Map<string, Lot[]>()
    for (const lot of lots) {
      const list = map.get(lot.batiment) ?? []
      list.push(lot)
      map.set(lot.batiment, list)
    }
    for (const list of map.values()) list.sort((a, b) => natural(a.lot, b.lot) || natural(a.refLot, b.refLot))
    return map
  }, [lots])

  const buildingCount = (name: string) =>
    (stats?.buildings[name] ?? 0) +
    (lotsByBuilding.get(name) ?? []).reduce((sum, lot) => sum + (stats?.lots[lot.id] ?? 0), 0)

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => onSelect({ kind: "overview" })}
        className="flex w-fit items-center gap-1 px-2 text-sm font-semibold text-[oklch(42%_0.08_155)] hover:underline"
      >
        <ChevronLeft className="size-4" /> Toutes les résidences
      </button>
      <button
        type="button"
        onClick={() => onSelect({ kind: "residence", residenceId: residence.id })}
        className="flex items-center gap-2.5 rounded-xl bg-[oklch(96%_0.02_155)] px-3 py-2.5 text-left"
      >
        <Building2 className="size-5 shrink-0 text-[oklch(42%_0.08_155)]" />
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-bold">{residence.name}</span>
          <span className="text-xs text-muted-foreground">
            {residence.totalLot ?? lots.length} lots · {buildings.length} bâtiment{buildings.length > 1 ? "s" : ""}
          </span>
        </span>
      </button>
      <NavItem
        icon={FileText}
        label="Docs de résidence"
        count={stats?.residence ?? 0}
        active={selection.kind === "residence"}
        onClick={() => onSelect({ kind: "residence", residenceId: residence.id })}
      />
      {buildings.length > 0 && (
        <p className="px-2 pt-1 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">Bâtiments</p>
      )}
      {buildings.map((name) => {
        const open = expanded === name
        const buildingLots = lotsByBuilding.get(name) ?? []
        const shown = showAllLots ? buildingLots : buildingLots.slice(0, LOT_PREVIEW)
        return (
          <div key={name} className="flex flex-col gap-0.5">
            <NavItem
              icon={Layers}
              label={name}
              count={buildingCount(name)}
              className={open ? "bg-[oklch(96%_0.005_100)] font-semibold" : undefined}
              onClick={() => {
                setExpanded(open ? null : name)
                setShowAllLots(false)
              }}
              trailing={open ? <ChevronDown className="size-3.5 text-muted-foreground" /> : <ChevronRight className="size-3.5 text-muted-foreground" />}
            />
            {open && (
              <div className="ml-4 flex flex-col gap-0.5 border-l border-border pl-2">
                <NavItem
                  icon={FileText}
                  label="Docs de bâtiment"
                  count={stats?.buildings[name] ?? 0}
                  active={selection.kind === "building" && selection.batiment === name}
                  onClick={() => onSelect({ kind: "building", residenceId: residence.id, batiment: name })}
                />
                {shown.map((lot) => (
                  <NavItem
                    key={lot.id}
                    icon={Home}
                    label={lotDisplayLabel(lot)}
                    count={stats?.lots[lot.id] ?? 0}
                    active={selection.kind === "lot" && selection.lotId === lot.id}
                    onClick={() => onSelect({ kind: "lot", residenceId: residence.id, lotId: lot.id })}
                  />
                ))}
                {!showAllLots && buildingLots.length > LOT_PREVIEW && (
                  <button
                    type="button"
                    onClick={() => setShowAllLots(true)}
                    className="px-2 py-1 text-left text-xs font-semibold text-[oklch(42%_0.08_155)] hover:underline"
                  >
                    Afficher les {buildingLots.length - LOT_PREVIEW} autres
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
