import { useMemo, useState } from "react"
import {
  ArchiveRestore,
  Download,
  Eye,
  EyeOff,
  LayoutGrid,
  List,
  MoreVertical,
  Trash2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DateInput } from "@/components/DateInput"
import { ClearFiltersButton } from "@/components/ClearFiltersButton"
import { SearchableSelect } from "@/components/SearchableSelect"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { inDateRange } from "@/lib/filters"
import { cn } from "@/lib/utils"
import { FileTypeIcon, formatDate, Highlighted } from "@/components/ged/gedShared"
import {
  VISIBILITY_BADGE_CLASS,
  formatFileSize,
  visibilityLabel,
  visibilityOf,
  type GedDocument,
  type GedVisibility,
} from "@/types/ged"

export type GedAction = "open" | "download" | "share" | "internal" | "trash" | "restore" | "purge"

// Tableau des documents d'un périmètre, de résultats ou de la corbeille
// (maquette 2a, 2b, 3a) : filtres Catégorie / Partage / Étiquettes / Date,
// liste ou grille, sélection multiple et actions groupées, menu ⋮.
export function GedDocumentTable({
  documents,
  mode,
  isSuperAdmin,
  loading,
  pathOf,
  excerptOf,
  highlight = "",
  onAction,
}: {
  documents: GedDocument[]
  mode: "browse" | "results" | "trash"
  isSuperAdmin: boolean
  loading: boolean
  pathOf?: (document: GedDocument) => string
  // Recherche : extrait du fichier et mots à surligner (maquette 3a).
  excerptOf?: (document: GedDocument) => { text: string; words: string[] } | undefined
  highlight?: string
  onAction: (action: GedAction, documents: GedDocument[]) => void
}) {
  const [category, setCategory] = useState("all")
  const [sharing, setSharing] = useState<"all" | GedVisibility>("all")
  const [tag, setTag] = useState("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [view, setView] = useState<"list" | "grid">("list")
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const categories = useMemo(() => [...new Set(documents.map((d) => d.category).filter(Boolean))].sort(), [documents])
  const tags = useMemo(() => [...new Set(documents.flatMap((d) => d.tags))].sort(), [documents])

  const filtered = documents
    .filter((d) => category === "all" || d.category === category)
    .filter((d) => sharing === "all" || visibilityOf(d) === sharing)
    .filter((d) => tag === "all" || d.tags.includes(tag))
    .filter((d) => inDateRange(d.documentDate ?? d.timeStamp, dateFrom, dateTo))
    .sort((a, b) => (b.timeStamp?.getTime() ?? 0) - (a.timeStamp?.getTime() ?? 0))

  const selectedDocuments = filtered.filter((d) => selected.has(d.key))
  const allSelected = filtered.length > 0 && selectedDocuments.length === filtered.length

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function run(action: GedAction, docs: GedDocument[]) {
    onAction(action, docs)
    if (action !== "open" && action !== "download") setSelected(new Set())
  }

  const menu = (d: GedDocument) => (
    <DropdownMenu>
      <DropdownMenuTrigger
        onClick={(e) => e.stopPropagation()}
        className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <MoreVertical className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={() => run("open", [d])}>
          <Eye />
          Ouvrir la fiche
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run("download", [d])}>
          <Download />
          Télécharger
        </DropdownMenuItem>
        {mode !== "trash" && isSuperAdmin && (
          <DropdownMenuItem onClick={() => run(d.adminOnly ? "share" : "internal", [d])}>
            {d.adminOnly ? <Eye /> : <EyeOff />}
            {d.adminOnly ? "Partager" : "Ne plus partager"}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {mode === "trash" ? (
          <>
            <DropdownMenuItem onClick={() => run("restore", [d])}>
              <ArchiveRestore />
              Restaurer
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => run("purge", [d])}>
              <Trash2 />
              Supprimer définitivement
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem variant="destructive" onClick={() => run("trash", [d])}>
            <Trash2 />
            Mettre à la corbeille
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const meta = (d: GedDocument) =>
    [d.extension.toUpperCase(), formatFileSize(d.size), formatDate(d.documentDate ?? d.timeStamp)].filter(Boolean).join(" · ")

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchableSelect
          className="w-52"
          value={category}
          onChange={setCategory}
          groups={[{ options: [{ value: "all", label: "Catégorie : toutes" }, ...categories.map((c) => ({ value: c, label: c }))] }]}
        />
        <SearchableSelect
          className="w-48"
          value={sharing}
          onChange={(v) => setSharing(v as "all" | GedVisibility)}
          groups={[
            {
              options: [
                { value: "all", label: "Partage : tous" },
                ...(isSuperAdmin ? [{ value: "internal", label: "Non partagé" }] : []),
                { value: "cs", label: "Conseil syndical" },
                { value: "owners", label: "Propriétaires" },
                { value: "shared", label: "Partagé" },
              ],
            },
          ]}
        />
        <SearchableSelect
          className="w-44"
          value={tag}
          onChange={setTag}
          groups={[{ options: [{ value: "all", label: "Étiquettes : toutes" }, ...tags.map((t) => ({ value: t, label: `#${t}` }))] }]}
        />
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <span>Du</span>
          <DateInput value={dateFrom} onChange={setDateFrom} />
          <span>au</span>
          <DateInput value={dateTo} onChange={setDateTo} />
        </div>
        <ClearFiltersButton
          active={category !== "all" || sharing !== "all" || tag !== "all" || !!dateFrom || !!dateTo}
          onClick={() => {
            setCategory("all")
            setSharing("all")
            setTag("all")
            setDateFrom("")
            setDateTo("")
          }}
        />
        <div className="ml-auto flex rounded-lg border border-input p-0.5">
          <button
            type="button"
            title="Liste"
            onClick={() => setView("list")}
            className={cn("rounded-md p-1.5", view === "list" && "bg-muted")}
          >
            <List className="size-4" />
          </button>
          <button
            type="button"
            title="Grille"
            onClick={() => setView("grid")}
            className={cn("rounded-md p-1.5", view === "grid" && "bg-muted")}
          >
            <LayoutGrid className="size-4" />
          </button>
        </div>
      </div>

      {selectedDocuments.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-[oklch(96%_0.02_155)] px-3 py-2 text-sm">
          <span className="font-semibold">
            {selectedDocuments.length} sélectionné{selectedDocuments.length > 1 ? "s" : ""}
          </span>
          {mode === "trash" ? (
            <>
              <Button size="sm" variant="outline" onClick={() => run("restore", selectedDocuments)}>
                <ArchiveRestore />
                Restaurer
              </Button>
              <Button size="sm" variant="outline" className="text-destructive" onClick={() => run("purge", selectedDocuments)}>
                <Trash2 />
                Supprimer définitivement
              </Button>
            </>
          ) : (
            <>
              {isSuperAdmin && (
                <>
                  <Button size="sm" variant="outline" onClick={() => run("share", selectedDocuments.filter((d) => d.adminOnly))}>
                    <Eye />
                    Partager
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => run("internal", selectedDocuments.filter((d) => !d.adminOnly))}>
                    <EyeOff />
                    Ne plus partager
                  </Button>
                </>
              )}
              <Button size="sm" variant="outline" className="text-destructive" onClick={() => run("trash", selectedDocuments)}>
                <Trash2 />
                Mettre à la corbeille
              </Button>
            </>
          )}
          <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-xs text-muted-foreground hover:underline">
            Tout désélectionner
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="rounded-[20px] border border-dashed border-input p-8 text-center text-sm text-muted-foreground">
          {loading
            ? "Chargement…"
            : documents.length === 0
              ? mode === "trash"
                ? "La corbeille est vide."
                : "Aucun document ici pour l'instant."
              : "Aucun document pour ces filtres."}
        </p>
      ) : view === "list" ? (
        <div className="overflow-hidden rounded-[20px] border border-[oklch(93%_0.005_100)] bg-white">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b bg-muted/40 px-4 py-2 text-[11px] font-bold tracking-wide text-muted-foreground uppercase sm:grid-cols-[auto_minmax(0,2fr)_minmax(0,1fr)_auto_auto]">
            <input
              type="checkbox"
              className="size-4 rounded border-input"
              checked={allSelected}
              onChange={() => setSelected(allSelected ? new Set() : new Set(filtered.map((d) => d.key)))}
            />
            <span>Nom</span>
            <span className="hidden sm:block">Catégorie</span>
            <span className="hidden sm:block">Partage</span>
            <span className="w-8" />
          </div>
          {filtered.map((d) => (
            <div
              key={d.key}
              role="button"
              tabIndex={0}
              onClick={() => run("open", [d])}
              onKeyDown={(e) => e.key === "Enter" && run("open", [d])}
              className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-[oklch(95%_0.003_100)] px-4 py-2.5 last:border-b-0 hover:bg-muted/30 sm:grid-cols-[auto_minmax(0,2fr)_minmax(0,1fr)_auto_auto]"
            >
              <input
                type="checkbox"
                className="size-4 rounded border-input"
                checked={selected.has(d.key)}
                onClick={(e) => e.stopPropagation()}
                onChange={() => toggle(d.key)}
              />
              <span className="flex min-w-0 items-center gap-3">
                <FileTypeIcon extension={d.extension} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">
                    {highlight ? <Highlighted text={d.name || "Sans nom"} query={highlight} /> : d.name || "Sans nom"}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {pathOf ? `${pathOf(d)} · ` : ""}
                    {meta(d)}
                  </span>
                  {excerptOf?.(d) && (
                    <span className="mt-1 line-clamp-2 text-[13px] text-[oklch(35%_0.01_150)]">
                      <Highlighted text={excerptOf(d)!.text} query={[highlight, ...excerptOf(d)!.words].join(" ")} />
                    </span>
                  )}
                </span>
              </span>
              <span className="hidden min-w-0 sm:block">
                {d.category && (
                  <Badge variant="outline" className="max-w-full truncate">
                    {d.category}
                  </Badge>
                )}
              </span>
              <span className="hidden sm:block">
                <Badge variant="outline" className={VISIBILITY_BADGE_CLASS[visibilityOf(d)]}>
                  {visibilityLabel(d)}
                </Badge>
              </span>
              {menu(d)}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((d) => (
            <div
              key={d.key}
              role="button"
              tabIndex={0}
              onClick={() => run("open", [d])}
              onKeyDown={(e) => e.key === "Enter" && run("open", [d])}
              className={cn(
                "flex cursor-pointer flex-col gap-3 rounded-[18px] border border-[oklch(93%_0.005_100)] bg-white p-4 hover:shadow-md",
                selected.has(d.key) && "ring-2 ring-[oklch(55%_0.1_155)]"
              )}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 size-4 rounded border-input"
                  checked={selected.has(d.key)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggle(d.key)}
                />
                <FileTypeIcon extension={d.extension} className="h-11 w-9" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="line-clamp-2 font-medium">{d.name || "Sans nom"}</span>
                  <span className="truncate text-xs text-muted-foreground">{meta(d)}</span>
                </span>
                {menu(d)}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {d.category && (
                  <Badge variant="outline" className="max-w-full truncate">
                    {d.category}
                  </Badge>
                )}
                <Badge variant="outline" className={VISIBILITY_BADGE_CLASS[visibilityOf(d)]}>
                  {visibilityLabel(d)}
                </Badge>
              </div>
              {pathOf && <span className="truncate text-xs text-muted-foreground">{pathOf(d)}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
