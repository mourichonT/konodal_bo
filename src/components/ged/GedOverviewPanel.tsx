import { AlertTriangle, ChevronRight, FilePlus2, FileText, Folder } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { FileTypeIcon, foundPath } from "@/components/ged/gedShared"
import { VISIBILITY_BADGE_CLASS, visibilityLabel, visibilityOf, type GedFoundDocument, type GedOverview } from "@/types/ged"
import type { GedSelection } from "@/components/ged/gedSelection"

const KPI_CLASS =
  "flex items-center gap-4 rounded-[20px] border border-[oklch(93%_0.005_100)] bg-white p-4 text-left shadow-[0_1px_2px_oklch(20%_0_0/0.03),0_14px_34px_-22px_oklch(20%_0_0/0.12)]"

// Vue d'ensemble de l'onglet Documents (maquette 1a) : non partagés (superAdmin),
// ajouts de la semaine, total ; derniers documents ; parcours par catégorie.
export function GedOverviewPanel({
  overview,
  loading,
  isSuperAdmin,
  onSelect,
  onOpen,
}: {
  overview: GedOverview | null
  loading: boolean
  isSuperAdmin: boolean
  onSelect: (selection: GedSelection) => void
  onOpen: (found: GedFoundDocument) => void
}) {
  if (!overview) {
    return <p className="p-6 text-sm text-muted-foreground">{loading ? "Chargement…" : "Vue d'ensemble indisponible."}</p>
  }
  const categories = Object.entries(overview.categories).sort((a, b) => b[1] - a[1])
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-baseline gap-2">
        <h2 className="p-0 text-lg font-bold">Toutes les résidences</h2>
        <span className="text-sm text-muted-foreground">· vue d'ensemble</span>
      </div>

      <div className={cn("grid gap-3", isSuperAdmin ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
        {isSuperAdmin && (
          <button type="button" onClick={() => onSelect({ kind: "internal" })} className={cn(KPI_CLASS, "hover:shadow-md")}>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <AlertTriangle className="size-5" />
            </span>
            <span className="flex flex-1 flex-col">
              <span className="text-sm text-muted-foreground">Non partagés</span>
              <span className="text-2xl font-bold">{overview.totals.internal}</span>
            </span>
            <span className="flex items-center text-sm font-semibold text-[oklch(42%_0.08_155)]">
              Voir <ChevronRight className="size-4" />
            </span>
          </button>
        )}
        <div className={KPI_CLASS}>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <FilePlus2 className="size-5" />
          </span>
          <span className="flex flex-col">
            <span className="text-sm text-muted-foreground">Ajoutés cette semaine</span>
            <span className="text-2xl font-bold">{overview.totals.addedThisWeek}</span>
          </span>
        </div>
        <div className={KPI_CLASS}>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700">
            <FileText className="size-5" />
          </span>
          <span className="flex flex-col">
            <span className="text-sm text-muted-foreground">Documents</span>
            <span className="text-2xl font-bold">{overview.totals.documents.toLocaleString("fr-FR")}</span>
            <span className="text-xs text-muted-foreground">
              {overview.residenceCount} résidence{overview.residenceCount > 1 ? "s" : ""} ·{" "}
              {overview.lotCount.toLocaleString("fr-FR")} lots
            </span>
          </span>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h3 className="text-base font-bold">Derniers documents ajoutés</h3>
        <div className="overflow-hidden rounded-[20px] border border-[oklch(93%_0.005_100)] bg-white">
          {overview.recent.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Aucun document pour l'instant.</p>
          ) : (
            overview.recent.map((found) => (
              <button
                key={`${found.scope}-${found.residenceId}-${found.lotId ?? ""}-${found.id}`}
                type="button"
                onClick={() => onOpen(found)}
                className="flex w-full items-center gap-3 border-b border-[oklch(95%_0.003_100)] px-4 py-3 text-left last:border-b-0 hover:bg-muted/40"
              >
                <FileTypeIcon extension={found.extension} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{found.name || "Sans nom"}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {foundPath(found)}
                    {found.timeStamp ? ` · ${new Date(found.timeStamp).toLocaleDateString("fr-FR")}` : ""}
                  </span>
                </span>
                {found.category && (
                  <Badge variant="outline" className="hidden max-w-56 truncate sm:inline-flex">
                    {found.category}
                  </Badge>
                )}
                <Badge variant="outline" className={VISIBILITY_BADGE_CLASS[visibilityOf(found)]}>
                  {visibilityLabel(found)}
                </Badge>
              </button>
            ))
          )}
        </div>
      </section>

      {categories.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-base font-bold">Parcourir par catégorie</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map(([category, count]) => (
              <button
                key={category}
                type="button"
                onClick={() => onSelect({ kind: "category", category })}
                className="flex items-center gap-3 rounded-[16px] border border-[oklch(93%_0.005_100)] bg-white px-4 py-3 text-left hover:shadow-md"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Folder className="size-4 text-muted-foreground" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-semibold">{category}</span>
                  <span className="text-xs text-muted-foreground">
                    {count.toLocaleString("fr-FR")} document{count > 1 ? "s" : ""}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
