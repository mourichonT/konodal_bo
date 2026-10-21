import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { ChevronRight, Search, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { GedNavigator } from "@/components/ged/GedNavigator"
import { GedOverviewPanel } from "@/components/ged/GedOverviewPanel"
import { GedDocumentTable, type GedAction } from "@/components/ged/GedDocumentTable"
import { GedDocumentSheet } from "@/components/ged/GedDocumentSheet"
import { GedImportDialog } from "@/components/ged/GedImportDialog"
import { foundPath } from "@/components/ged/gedShared"
import {
  RECENT_KEY,
  readStoredIds,
  selectedResidenceId,
  selectionFromParams,
  selectionToParams,
  writeStoredIds,
  type GedSelection,
} from "@/components/ged/gedSelection"
import { useScopedResidences } from "@/hooks/useScopedResidenceIds"
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin"
import { subscribeToLots } from "@/lib/lots"
import { subscribeToStructures } from "@/lib/structures"
import {
  fetchGedOverview,
  findGedDocuments,
  foundToDocument,
  foundToKey,
  gedFileUrl,
  purgeGedDocument,
  restoreGedDocument,
  setGedVisibility,
  subscribeToLotGed,
  subscribeToResidenceGed,
  trashGedDocument,
  type GedTarget,
} from "@/lib/ged"
import { cn, PRIMARY_CTA_CLASS } from "@/lib/utils"
import { lotDisplayLabel, type Lot } from "@/types/lot"
import type { StructureResidence } from "@/types/structure"
import { defaultResidenceVisibility, type GedDocument, type GedFoundDocument, type GedOverview } from "@/types/ged"

type Confirmation = { action: "share" | "internal" | "purge"; documents: GedDocument[] }

// Onglet Documents (GED, maquette « GED Konodal BO ») : navigation résidences
// → bâtiments → lots à gauche, vue d'ensemble / tableau à droite, fiche du
// document en panneau. Chaque document reste à sa place (documents_copro,
// documents de lot de l'app) ; la vue d'ensemble, la recherche, la corbeille
// et les non partagés passent par functions_python/ged.py.
export default function DocumentsPage() {
  const [params, setParams] = useSearchParams()
  const selection = useMemo(() => selectionFromParams(params), [params])
  const residenceId = selectedResidenceId(selection)
  const { residences, loading: residencesLoading } = useScopedResidences()
  const { isSuperAdmin } = useIsSuperAdmin()

  const [overview, setOverview] = useState<GedOverview | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [structures, setStructures] = useState<StructureResidence[]>([])
  const [lots, setLots] = useState<Lot[]>([])
  const [residenceDocuments, setResidenceDocuments] = useState<GedDocument[]>([])
  const [lotDocuments, setLotDocuments] = useState<GedDocument[]>([])
  const [scopeLoading, setScopeLoading] = useState(false)
  const [found, setFound] = useState<GedFoundDocument[]>([])
  const [foundTotal, setFoundTotal] = useState(0)
  const [foundLoading, setFoundLoading] = useState(false)
  const [sheet, setSheet] = useState<GedDocument | null>(null)
  const [importing, setImporting] = useState(false)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [working, setWorking] = useState(false)
  const [searchDraft, setSearchDraft] = useState(selection.kind === "search" ? selection.query : "")
  const searchRef = useRef<HTMLInputElement>(null)

  const select = useCallback(
    (next: GedSelection, replace = false) => {
      setParams(selectionToParams(next), { replace })
    },
    [setParams]
  )
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  // Ctrl K (⌘K) : recherche dans tous les documents.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  useEffect(() => {
    setSearchDraft(selection.kind === "search" ? selection.query : "")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection.kind === "search" ? selection.query : null])

  // Recherche au fil de la frappe (pause d'une demi-seconde, deux caractères
  // au moins) ; effacer le champ ramène à la vue d'ensemble.
  useEffect(() => {
    const query = searchDraft.trim()
    const current = selection.kind === "search" ? selection.query : null
    if (query === (current ?? "")) return
    const timer = window.setTimeout(() => {
      if (query.length >= 2) select({ kind: "search", query }, current !== null)
      else if (!query && current !== null) select({ kind: "overview" }, true)
    }, 500)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft])

  useEffect(() => {
    let cancelled = false
    setOverviewLoading(true)
    fetchGedOverview()
      .then((data) => !cancelled && setOverview(data))
      .catch((err) => !cancelled && toast.error("Vue d'ensemble indisponible : " + (err as Error).message))
      .finally(() => !cancelled && setOverviewLoading(false))
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  // Résidence ouverte : la mettre en tête des récentes (navigateur).
  useEffect(() => {
    if (!residenceId) return
    writeStoredIds(RECENT_KEY, [residenceId, ...readStoredIds(RECENT_KEY).filter((id) => id !== residenceId)].slice(0, 10))
  }, [residenceId])

  useEffect(() => {
    setStructures([])
    setLots([])
    setResidenceDocuments([])
    if (!residenceId) return
    setScopeLoading(true)
    const onError = (error: Error) => toast.error("Chargement impossible : " + error.message)
    const unsubscribes = [
      subscribeToStructures(residenceId, setStructures, onError),
      subscribeToLots(residenceId, setLots, onError),
      subscribeToResidenceGed(
        residenceId,
        (documents) => {
          setResidenceDocuments(documents)
          setScopeLoading(false)
        },
        (error) => {
          setScopeLoading(false)
          onError(error)
        }
      ),
    ]
    return () => unsubscribes.forEach((unsub) => unsub())
  }, [residenceId])

  const lotId = selection.kind === "lot" ? selection.lotId : null
  const selectedLot = lots.find((l) => l.id === lotId) ?? null
  const occupantsKey = selectedLot
    ? [...new Set([...selectedLot.idProprietaire, ...selectedLot.idLocataire])].sort().join(",")
    : ""

  useEffect(() => {
    setLotDocuments([])
    if (!residenceId || !lotId || !selectedLot) return
    return subscribeToLotGed(
      residenceId,
      lotId,
      occupantsKey ? occupantsKey.split(",") : [],
      setLotDocuments,
      (error) => toast.error("Impossible de charger les documents de ce lot : " + error.message)
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [residenceId, lotId, occupantsKey, !!selectedLot])

  // Recherche, corbeille, non partagés, catégorie : côté serveur (toutes les
  // résidences du périmètre), relancés après chaque modification.
  const findQuery =
    selection.kind === "search"
      ? { kind: "search" as const, query: selection.query }
      : selection.kind === "trash"
        ? { kind: "trash" as const }
        : selection.kind === "internal"
          ? { kind: "internal" as const }
          : selection.kind === "category"
            ? { kind: "category" as const, category: selection.category }
            : null
  const findKey = findQuery ? JSON.stringify(findQuery) : ""

  useEffect(() => {
    setFound([])
    setFoundTotal(0)
    if (!findQuery) return
    if (findQuery.kind === "search" && findQuery.query.trim().length < 2) return
    let cancelled = false
    setFoundLoading(true)
    findGedDocuments(findQuery)
      .then(({ items, total }) => {
        if (cancelled) return
        setFound(items)
        setFoundTotal(total)
      })
      .catch((err) => !cancelled && toast.error("Recherche impossible : " + (err as Error).message))
      .finally(() => !cancelled && setFoundLoading(false))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [findKey, refreshKey])

  const residenceName = (id: string) => residences.find((r) => r.id === id)?.name ?? ""
  const foundByKey = useMemo(() => new Map(found.map((f) => [foundToKey(f), f])), [found])
  const visible = (d: GedDocument) => isSuperAdmin || !d.adminOnly

  const tableDocuments: GedDocument[] = useMemo(() => {
    switch (selection.kind) {
      case "residence":
        return residenceDocuments.filter((d) => d.scope === "residence" && !d.deletedAt && visible(d))
      case "building":
        return residenceDocuments.filter((d) => d.batiment === selection.batiment && !d.deletedAt && visible(d))
      case "lot":
        return lotDocuments.filter((d) => !d.deletedAt && visible(d))
      case "overview":
        return []
      default:
        return found.map(foundToDocument).filter(visible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, residenceDocuments, lotDocuments, found, isSuperAdmin])

  function attachedTo(d: GedDocument): string {
    if (d.scope === "residence") return "Docs de résidence"
    if (d.scope === "building") return d.batiment || "Bâtiment"
    const lot = lots.find((l) => l.id === d.lotId) ?? foundByKey.get(d.key)?.lot
    return lot ? lotDisplayLabel(lot) : "Lot"
  }

  function pathOf(d: GedDocument): string {
    const f = foundByKey.get(d.key)
    return f ? foundPath(f) : residenceName(d.residenceId)
  }

  const importTarget: GedTarget | null =
    selection.kind === "residence"
      ? { scope: "residence", residenceId: selection.residenceId }
      : selection.kind === "building"
        ? { scope: "building", residenceId: selection.residenceId, batiment: selection.batiment }
        : selection.kind === "lot" && selectedLot
          ? {
              scope: "lot",
              residenceId: selection.residenceId,
              lotId: selection.lotId,
              recipients: [...new Set([...selectedLot.idProprietaire, ...selectedLot.idLocataire])],
            }
          : null

  const crumbs: { label: string; selection?: GedSelection }[] = [{ label: "Toutes les résidences", selection: { kind: "overview" } }]
  if (residenceId) crumbs.push({ label: residenceName(residenceId) || "Résidence", selection: { kind: "residence", residenceId } })
  if (selection.kind === "residence") crumbs.push({ label: "Docs de résidence" })
  if (selection.kind === "building") crumbs.push({ label: selection.batiment })
  if (selection.kind === "lot") {
    if (selectedLot?.batiment) {
      crumbs.push({
        label: selectedLot.batiment,
        selection: { kind: "building", residenceId: selection.residenceId, batiment: selectedLot.batiment },
      })
    }
    crumbs.push({ label: selectedLot ? lotDisplayLabel(selectedLot) : "Lot" })
  }
  if (selection.kind === "trash") crumbs.push({ label: "Corbeille" })
  if (selection.kind === "internal") crumbs.push({ label: "Non partagés" })
  if (selection.kind === "category") crumbs.push({ label: selection.category })
  if (selection.kind === "search") crumbs.push({ label: `Recherche « ${selection.query} »` })

  const title =
    selection.kind === "residence"
      ? "Documents de la résidence"
      : selection.kind === "building"
        ? `Documents du ${selection.batiment}`
        : selection.kind === "lot"
          ? selectedLot
            ? lotDisplayLabel(selectedLot)
            : "Lot"
          : crumbs[crumbs.length - 1].label

  async function runEach(documents: GedDocument[], fn: (d: GedDocument) => Promise<unknown>, success: string) {
    if (documents.length === 0) return
    setWorking(true)
    let failed = 0
    for (const d of documents) {
      try {
        await fn(d)
      } catch (err) {
        failed += 1
        console.error(err)
      }
    }
    setWorking(false)
    if (failed) toast.error(`${failed} document${failed > 1 ? "s" : ""} sur ${documents.length} n'ont pas pu être traités`)
    else toast.success(success)
    refresh()
  }

  async function handleAction(action: GedAction, documents: GedDocument[]) {
    switch (action) {
      case "open":
        setSheet(documents[0])
        return
      case "download":
        try {
          const url = await gedFileUrl(documents[0])
          if (url) window.open(url, "_blank", "noreferrer")
        } catch (err) {
          toast.error("Téléchargement impossible : " + (err as Error).message)
        }
        return
      case "share":
      case "internal":
      case "purge":
        if (documents.length) setConfirmation({ action, documents })
        return
      case "trash":
        await runEach(documents, trashGedDocument, documents.length > 1 ? "Documents mis à la corbeille" : "Document mis à la corbeille")
        return
      case "restore":
        await runEach(documents, restoreGedDocument, documents.length > 1 ? "Documents restaurés" : "Document restauré")
        return
    }
  }

  async function confirm() {
    if (!confirmation) return
    const { action, documents } = confirmation
    setConfirmation(null)
    if (action === "purge") {
      setSheet(null)
      await runEach(documents, purgeGedDocument, "Supprimé définitivement")
    } else {
      await runEach(
        documents,
        (d) =>
          setGedVisibility(
            d,
            action === "internal" ? "internal" : d.scope === "residence" ? defaultResidenceVisibility(d.category) : "shared",
            { notify: false }
          ),
        action === "share" ? "Partage mis à jour" : "Documents retirés du partage"
      )
    }
  }

  const n = confirmation?.documents.length ?? 0
  const plural = n > 1 ? "s" : ""
  const confirmText = !confirmation
    ? ""
    : confirmation.action === "purge"
      ? `${n} document${plural} et ${n > 1 ? "leurs fichiers seront supprimés" : "son fichier sera supprimé"} définitivement. Cette action est irréversible.`
      : confirmation.action === "share"
        ? `${n} document${plural} deviendr${n > 1 ? "ont" : "a"} visible${plural} dans l'application : les propriétaires pour une assemblée générale ou un document juridique de la résidence, toute la résidence pour les autres documents de résidence, les occupants du bâtiment ou les destinataires du lot sinon. Pour un autre choix (conseil syndical…), passez par la fiche du document.`
        : `${n} document${plural} ne ser${n > 1 ? "ont" : "a"} plus visible${plural} que des administrateurs Konodal ; ${n > 1 ? "leurs fichiers sont déplacés" : "son fichier est déplacé"} et les anciens liens cessent de fonctionner.`

  const mode = selection.kind === "trash" ? "trash" : findQuery ? "results" : "browse"
  const sheetResidence = sheet ? residenceName(sheet.residenceId) || foundByKey.get(sheet.key)?.residenceName || "" : ""

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-2 text-[26px] font-extrabold tracking-tight text-[oklch(22%_0.01_150)]">Documents</h1>
        <form
          className={cn(
            "group flex min-w-0 flex-1 basis-80 items-center gap-2.5 rounded-2xl border border-[oklch(90%_0.006_100)] bg-white px-4 py-3 text-[15px]",
            "focus-within:border-[oklch(45%_0.09_155)] focus-within:shadow-[0_0_0_1px_oklch(45%_0.09_155),0_0_0_5px_oklch(55%_0.1_155/0.14)]",
            selection.kind === "search" &&
              "border-[oklch(45%_0.09_155)] shadow-[0_0_0_1px_oklch(45%_0.09_155),0_0_0_5px_oklch(55%_0.1_155/0.14)]"
          )}
          onSubmit={(e) => {
            e.preventDefault()
            const query = searchDraft.trim()
            if (query.length >= 2) select({ kind: "search", query }, selection.kind === "search")
          }}
        >
          <Search
            className={cn(
              "size-[18px] shrink-0 stroke-[2.2] text-[oklch(50%_0.01_150)] group-focus-within:text-[oklch(45%_0.09_155)]",
              selection.kind === "search" && "text-[oklch(45%_0.09_155)]"
            )}
          />
          <input
            ref={searchRef}
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && e.currentTarget.blur()}
            placeholder="Rechercher un document, un lot, un mot du contenu…"
            aria-label="Rechercher dans les documents"
            className="min-w-0 flex-1 bg-transparent font-semibold text-[oklch(20%_0.02_150)] outline-none placeholder:font-normal placeholder:text-[oklch(55%_0.01_150)]"
          />
          <kbd className="ml-auto shrink-0 rounded-[7px] border border-[oklch(90%_0.006_100)] px-2 py-0.5 font-sans text-xs whitespace-nowrap text-[oklch(50%_0.01_150)]">
            Ctrl K
          </kbd>
        </form>
      </div>

      <Card className="overflow-visible">
        <CardContent className="grid gap-6 p-5 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="lg:border-r lg:border-[oklch(95%_0.003_100)] lg:pr-5">
            {residencesLoading ? (
              <p className="p-2 text-sm text-muted-foreground">Chargement des résidences…</p>
            ) : (
              <GedNavigator
                residences={residences}
                overview={overview}
                selection={selection}
                onSelect={select}
                structures={structures}
                lots={lots}
              />
            )}
          </aside>

          <section className="flex min-w-0 flex-col gap-4">
            {selection.kind === "overview" ? (
              <GedOverviewPanel
                overview={overview}
                loading={overviewLoading}
                isSuperAdmin={isSuperAdmin}
                onSelect={select}
                onOpen={(f) => setSheet(foundToDocument(f))}
              />
            ) : (
              <>
                <nav className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
                  {crumbs.map((crumb, i) => (
                    <span key={i} className="flex items-center gap-1">
                      {i > 0 && <ChevronRight className="size-3.5" />}
                      {crumb.selection && i < crumbs.length - 1 ? (
                        <button type="button" onClick={() => select(crumb.selection!)} className="hover:text-foreground hover:underline">
                          {crumb.label}
                        </button>
                      ) : (
                        <span className={cn(i === crumbs.length - 1 && "font-semibold text-foreground")}>{crumb.label}</span>
                      )}
                    </span>
                  ))}
                </nav>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <h2 className="truncate p-0 text-xl font-bold">{title}</h2>
                    <p className="text-sm text-muted-foreground">
                      {findQuery
                        ? foundLoading
                          ? "Recherche en cours…"
                          : `${foundTotal} document${foundTotal > 1 ? "s" : ""}${foundTotal > found.length ? ` · ${found.length} affichés` : ""}`
                        : `${tableDocuments.length} document${tableDocuments.length > 1 ? "s" : ""}`}
                    </p>
                  </div>
                  {importTarget && (
                    <Button className={PRIMARY_CTA_CLASS} onClick={() => setImporting(true)}>
                      <Upload />
                      Importer
                    </Button>
                  )}
                </div>
                {selection.kind === "search" && selection.query.trim().length < 2 ? (
                  <p className="text-sm text-muted-foreground">Saisissez au moins deux caractères.</p>
                ) : (
                  <GedDocumentTable
                    key={JSON.stringify(selection)}
                    documents={tableDocuments}
                    mode={mode}
                    isSuperAdmin={isSuperAdmin}
                    loading={findQuery ? foundLoading : scopeLoading}
                    pathOf={findQuery ? pathOf : undefined}
                    excerptOf={
                      selection.kind === "search"
                        ? (d) => {
                            const found = foundByKey.get(d.key)
                            return found?.excerpt ? { text: found.excerpt, words: found.excerptWords ?? [] } : undefined
                          }
                        : undefined
                    }
                    highlight={selection.kind === "search" ? selection.query : ""}
                    onAction={(action, documents) => void handleAction(action, documents)}
                  />
                )}
              </>
            )}
          </section>
        </CardContent>
      </Card>

      {sheet && (
        <GedDocumentSheet
          key={sheet.key}
          document={sheet}
          residenceName={sheetResidence}
          attachedTo={attachedTo(sheet)}
          isSuperAdmin={isSuperAdmin}
          onClose={() => setSheet(null)}
          onChanged={refresh}
          onPurge={(d) => setConfirmation({ action: "purge", documents: [d] })}
        />
      )}

      <GedImportDialog
        open={importing}
        onOpenChange={setImporting}
        target={importTarget}
        title={title}
        lot={selectedLot}
        isSuperAdmin={isSuperAdmin}
        onImported={refresh}
      />

      <Dialog open={!!confirmation} onOpenChange={(open) => !open && setConfirmation(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirmation?.action === "purge"
                ? "Supprimer définitivement ?"
                : confirmation?.action === "share"
                  ? "Partager ?"
                  : "Ne plus partager ?"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{confirmText}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmation(null)}>
              Annuler
            </Button>
            <Button
              variant={confirmation?.action === "purge" ? "destructive" : "default"}
              className={confirmation?.action === "purge" ? undefined : PRIMARY_CTA_CLASS}
              disabled={working}
              onClick={() => void confirm()}
            >
              {confirmation?.action === "purge" ? "Supprimer" : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
