import { useEffect, useState } from "react"
import { toast } from "sonner"
import { ArchiveRestore, ChevronRight, Download, Trash2, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DateInput } from "@/components/DateInput"
import { SearchableSelect } from "@/components/SearchableSelect"
import { cn, PRIMARY_CTA_CLASS } from "@/lib/utils"
import {
  gedFileUrl,
  logGedView,
  restoreGedDocument,
  setGedVisibility,
  subscribeToGedDocument,
  trashGedDocument,
  updateGedFields,
} from "@/lib/ged"
import { FileTypeIcon, formatDate } from "@/components/ged/gedShared"
import {
  GED_CATEGORIES,
  VISIBILITY_BADGE_CLASS,
  formatFileSize,
  visibilityLabel,
  visibilityOf,
  type GedDocument,
  type GedVisibility,
} from "@/types/ged"

type Tab = "details" | "access" | "journal"

function toInputDate(date: Date | null): string {
  if (!date) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// Fiche d'un document (maquette 4a à 4d), en panneau à droite : Détails
// (aperçu, catégorie, rattachement, date, partage, étiquettes), Accès (qui le
// voit dans l'application), Journal ; Supprimer (corbeille), Télécharger.
export function GedDocumentSheet({
  document: initial,
  residenceName,
  attachedTo,
  isSuperAdmin,
  onClose,
  onChanged,
  onPurge,
}: {
  document: GedDocument
  residenceName: string
  attachedTo: string
  isSuperAdmin: boolean
  onClose: () => void
  onChanged: () => void
  onPurge: (document: GedDocument) => void
}) {
  const [document, setDocument] = useState<GedDocument>(initial)
  const [tab, setTab] = useState<Tab>("details")
  const [previewUrl, setPreviewUrl] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    return subscribeToGedDocument(
      initial,
      (live) => {
        if (live) setDocument(live)
      },
      () => undefined
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.key])

  useEffect(() => {
    let cancelled = false
    gedFileUrl(initial)
      .then((url) => !cancelled && setPreviewUrl(url))
      .catch(() => !cancelled && setPreviewUrl(""))
    if (!initial.deletedAt) void logGedView(initial)
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.key, document.url, document.storagePath])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  async function save(patch: Parameters<typeof updateGedFields>[1], journal: string) {
    try {
      await updateGedFields(document, patch, journal)
      onChanged()
    } catch (err) {
      toast.error("Modification impossible : " + (err as Error).message)
    }
  }

  async function download() {
    try {
      const url = previewUrl || (await gedFileUrl(document))
      if (url) window.open(url, "_blank", "noreferrer")
    } catch (err) {
      toast.error("Téléchargement impossible : " + (err as Error).message)
    }
  }

  async function trashOrRestore() {
    setBusy(true)
    try {
      if (document.deletedAt) {
        await restoreGedDocument(document)
        toast.success("Document restauré")
      } else {
        await trashGedDocument(document)
        toast.success("Document mis à la corbeille")
        onClose()
      }
      onChanged()
    } catch (err) {
      toast.error("Action impossible : " + (err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const isPdf = document.extension === "pdf" || document.contentType === "application/pdf"
  const isImage = ["jpg", "jpeg", "png", "webp", "gif"].includes(document.extension)

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="absolute inset-0 bg-[oklch(20%_0.01_150/0.35)] duration-150 animate-in fade-in-0"
      />
      <aside className="relative flex h-full w-full max-w-[520px] flex-col bg-white shadow-2xl duration-150 animate-in slide-in-from-right-8">
        <header className="flex items-start gap-3 border-b border-[oklch(95%_0.003_100)] px-6 pt-5 pb-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 className="truncate p-0 text-xl font-bold">{document.name || "Sans nom"}</h2>
            <p className="flex flex-wrap items-center gap-1 text-sm text-[oklch(42%_0.08_155)]">
              {residenceName}
              <ChevronRight className="size-3.5" />
              {attachedTo}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border p-1.5 hover:bg-muted" aria-label="Fermer">
            <X className="size-4" />
          </button>
        </header>
        <nav className="flex gap-5 border-b border-[oklch(95%_0.003_100)] px-6">
          {(
            [
              ["details", "Détails"],
              ["access", "Accès"],
              ["journal", "Journal"],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "-mb-px border-b-2 py-2.5 text-sm font-semibold",
                tab === key ? "border-[oklch(45%_0.1_155)] text-[oklch(32%_0.07_155)]" : "border-transparent text-muted-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {tab === "details" && (
            <DetailsTab
              document={document}
              previewUrl={previewUrl}
              isPdf={isPdf}
              isImage={isImage}
              attachedTo={attachedTo}
              onSave={save}
              onManageAccess={() => setTab("access")}
            />
          )}
          {tab === "access" && (
            <AccessTab document={document} isSuperAdmin={isSuperAdmin} attachedTo={attachedTo} onChanged={onChanged} />
          )}
          {tab === "journal" && <JournalTab document={document} />}
        </div>

        <footer className="flex gap-3 border-t border-[oklch(95%_0.003_100)] px-6 py-4">
          {document.deletedAt ? (
            <>
              <Button variant="outline" disabled={busy} onClick={trashOrRestore}>
                <ArchiveRestore />
                Restaurer
              </Button>
              <Button variant="outline" className="text-destructive" disabled={busy} onClick={() => onPurge(document)}>
                <Trash2 />
                Supprimer définitivement
              </Button>
            </>
          ) : (
            <Button variant="outline" className="border-destructive/30 text-destructive" disabled={busy} onClick={trashOrRestore}>
              <Trash2 />
              Supprimer
            </Button>
          )}
          <Button className={cn("flex-1", PRIMARY_CTA_CLASS)} onClick={download}>
            <Download />
            Télécharger
          </Button>
        </footer>
      </aside>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 border-b border-[oklch(95%_0.003_100)] py-2 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">{children}</div>
    </div>
  )
}

function DetailsTab({
  document,
  previewUrl,
  isPdf,
  isImage,
  attachedTo,
  onSave,
  onManageAccess,
}: {
  document: GedDocument
  previewUrl: string
  isPdf: boolean
  isImage: boolean
  attachedTo: string
  onSave: (patch: Parameters<typeof updateGedFields>[1], journal: string) => Promise<void>
  onManageAccess: () => void
}) {
  const [name, setName] = useState(document.name)
  const [newTag, setNewTag] = useState("")
  useEffect(() => setName(document.name), [document.name])

  const categories = [...new Set([...GED_CATEGORIES, ...(document.category ? [document.category] : [])])]

  function addTag() {
    const tag = newTag.trim().replace(/^#/, "").toLowerCase()
    setNewTag("")
    if (!tag || document.tags.includes(tag)) return
    void onSave({ tags: [...document.tags, tag] }, `Étiquette ajoutée : ${tag}`)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-64 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-[oklch(85%_0.02_155)] bg-[oklch(97%_0.006_150)]">
        {previewUrl && isPdf ? (
          <iframe title="Aperçu" src={previewUrl} className="h-full w-full" />
        ) : previewUrl && isImage ? (
          <img src={previewUrl} alt={document.name} className="max-h-full max-w-full object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
            <FileTypeIcon extension={document.extension} className="h-12 w-10" />
            {previewUrl ? "Aperçu indisponible pour ce format" : "Aperçu en cours de chargement…"}
          </div>
        )}
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        {["Aperçu", formatFileSize(document.size), `ajouté le ${formatDate(document.timeStamp)}`].filter(Boolean).join(" · ")}
      </p>

      <div className="flex flex-col">
        <Row label="Nom">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              if (name.trim() && name.trim() !== document.name) {
                void onSave({ name: name.trim() }, `Renommé : ${name.trim()}`)
              }
            }}
            className="h-8 w-64"
          />
        </Row>
        <Row label="Catégorie">
          <SearchableSelect
            className="w-64"
            value={document.category}
            onChange={(category) => category !== document.category && void onSave({ category }, `Catégorie définie : ${category}`)}
            groups={[{ options: categories.map((c) => ({ value: c, label: c })) }]}
          />
        </Row>
        <Row label="Rattaché à">
          <span className="font-semibold">{attachedTo}</span>
        </Row>
        <Row label="Date du document">
          <DateInput
            value={toInputDate(document.documentDate)}
            onChange={(value) =>
              void onSave(
                { documentDate: value ? new Date(`${value}T00:00:00`) : null },
                value ? `Date du document : ${new Date(`${value}T00:00:00`).toLocaleDateString("fr-FR")}` : "Date du document retirée"
              )
            }
          />
        </Row>
        <Row label="Partage">
          <Badge variant="outline" className={VISIBILITY_BADGE_CLASS[visibilityOf(document)]}>
            {visibilityLabel(document)}
          </Badge>
          <button type="button" onClick={onManageAccess} className="flex items-center text-sm font-semibold text-[oklch(42%_0.08_155)] hover:underline">
            Gérer l'accès <ChevronRight className="size-4" />
          </button>
        </Row>
        <Row label="Étiquettes">
          {document.tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-800">
              #{tag}
              <button
                type="button"
                aria-label={`Retirer ${tag}`}
                onClick={() => void onSave({ tags: document.tags.filter((t) => t !== tag) }, `Étiquette retirée : ${tag}`)}
                className="hover:text-destructive"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          <Input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                addTag()
              }
            }}
            onBlur={addTag}
            placeholder="+ étiquette"
            className="h-7 w-28 text-xs"
          />
        </Row>
      </div>
    </div>
  )
}

function AccessTab({
  document,
  isSuperAdmin,
  attachedTo,
  onChanged,
}: {
  document: GedDocument
  isSuperAdmin: boolean
  attachedTo: string
  onChanged: () => void
}) {
  const [choice, setChoice] = useState<GedVisibility>(visibilityOf(document))
  const [notify, setNotify] = useState(false)
  const [saving, setSaving] = useState(false)
  useEffect(() => setChoice(visibilityOf(document)), [document])

  const options: { value: GedVisibility; label: string; description: string }[] = [
    ...(isSuperAdmin || document.adminOnly
      ? [{ value: "internal" as const, label: "Non partagé", description: "Visible uniquement par les administrateurs Konodal dans le back-office." }]
      : []),
    ...(document.scope === "residence"
      ? [
          { value: "cs" as const, label: "Conseil syndical", description: "Visible par le conseil syndical de la résidence, dans l'application." },
          { value: "owners" as const, label: "Propriétaires", description: "Visible par les propriétaires et le conseil syndical, masqué aux locataires (ex. règlement de copropriété, assemblée générale)." },
          { value: "shared" as const, label: "Toute la résidence", description: "Visible par tous les résidents, propriétaires et locataires (ex. règlement intérieur)." },
        ]
      : document.scope === "building"
        ? [{ value: "shared" as const, label: "Occupants du bâtiment", description: `Visible par les occupants du ${document.batiment} (et le conseil syndical) dans l'application.` }]
        : [{ value: "shared" as const, label: `Partagé avec le lot`, description: `Les destinataires du lot (${attachedTo}) le retrouvent dans leurs documents, dans l'application.` }]),
  ]
  const current = visibilityOf(document)
  const becomesVisible = current === "internal" && choice !== "internal"

  async function apply() {
    setSaving(true)
    try {
      await setGedVisibility(document, choice, { notify: notify && choice !== "internal" })
      toast.success(choice === "internal" ? "Document retiré du partage" : notify ? "Document partagé, résidents notifiés" : "Partage mis à jour")
      setNotify(false)
      onChanged()
    } catch (err) {
      toast.error("Modification du partage impossible : " + (err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-base font-bold">Visibilité du document</h3>
        <p className="text-sm text-muted-foreground">
          {document.scope === "lot"
            ? "Publiez ou non ce document auprès des destinataires du lot."
            : "Choisissez qui voit ce document dans l'application."}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-2xl border p-4",
              choice === option.value ? "border-[oklch(45%_0.1_155)] bg-[oklch(97%_0.02_155)]" : "border-input"
            )}
          >
            <input
              type="radio"
              name="ged-visibility"
              className="mt-1 size-4 accent-[oklch(45%_0.1_155)]"
              checked={choice === option.value}
              disabled={!isSuperAdmin && option.value === "internal"}
              onChange={() => setChoice(option.value)}
            />
            <span className="flex flex-col">
              <span className="font-semibold">{option.label}</span>
              <span className="text-sm text-muted-foreground">{option.description}</span>
            </span>
          </label>
        ))}
      </div>
      {document.scope === "lot" && (
        <p className="text-xs text-muted-foreground">
          Un document de lot n'est jamais visible en dehors du lot, ni par un occupant arrivé après son envoi. Le choix du
          conseil syndical ou de toute la résidence n'existe que pour les documents de résidence.
        </p>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 rounded border-input"
          checked={notify}
          disabled={choice === "internal"}
          onChange={(e) => setNotify(e.target.checked)}
        />
        Envoyer une notification à la publication
      </label>
      {becomesVisible && (
        <p className="text-xs text-amber-700">
          Le fichier quitte le dossier réservé aux administrateurs : il devient lisible par les personnes choisies.
        </p>
      )}
      <Button className={cn("w-fit", PRIMARY_CTA_CLASS)} disabled={saving || (choice === current && !notify)} onClick={apply}>
        {saving ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </div>
  )
}

function JournalTab({ document }: { document: GedDocument }) {
  const history = [...document.history].sort((a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0))
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-base font-bold">Historique du document</h3>
      {history.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun événement enregistré pour ce document.</p>
      ) : (
        <ol className="flex flex-col">
          {history.map((entry, i) => (
            <li key={i} className="flex gap-3 border-l-2 border-[oklch(90%_0.03_155)] pb-4 pl-4 last:pb-0">
              <span className="flex flex-col">
                <span className="font-medium">{entry.action}</span>
                <span className="text-xs text-muted-foreground">
                  {entry.at
                    ? `${entry.at.toLocaleDateString("fr-FR")} à ${entry.at.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
                    : ""}
                  {entry.byName ? ` · ${entry.byName}` : ""}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
