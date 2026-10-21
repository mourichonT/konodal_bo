import { useEffect, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { FileUp, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { SearchableSelect } from "@/components/SearchableSelect"
import { cn, PRIMARY_CTA_CLASS } from "@/lib/utils"
import { resolveUserLabels } from "@/lib/users"
import { targetLabel, uploadGedDocuments, type GedTarget } from "@/lib/ged"
import { defaultRecipientRolesForCategory, LOT_DOCUMENT_CATEGORIES, RESIDENCE_DOCUMENT_CATEGORIES } from "@/types/document"
import { defaultResidenceVisibility, GED_CATEGORIES, type GedVisibility } from "@/types/ged"
import type { Lot } from "@/types/lot"

const ACCEPTED_FILE_TYPES = ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.odt,.xls,.xlsx,.txt"

type Recipient = { uid: string; label: string; role: "proprietaire" | "locataire" }

// Import d'un ou plusieurs documents dans le périmètre affiché (maquette 1c) :
// catégorie, nom (un seul fichier), partage. Date du document et étiquettes :
// gérées par Nodo après l'import, en lisant le document (décision de
// l'utilisateur, functions_python/nodo_documents.py). Non partagé
// par défaut pour le superAdmin (les documents reçus sont relus avant d'être
// montrés), jamais proposé à l'agence. Lot : destinataires parmi ses
// propriétaires et locataires actuels.
export function GedImportDialog({
  open,
  onOpenChange,
  target,
  title,
  lot,
  isSuperAdmin,
  onImported,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: GedTarget | null
  title: string
  lot: Lot | null
  isSuperAdmin: boolean
  onImported: () => void
}) {
  const scope = target?.scope ?? "residence"
  const defaultCategory = scope === "lot" ? LOT_DOCUMENT_CATEGORIES[0] : RESIDENCE_DOCUMENT_CATEGORIES[0]
  const [files, setFiles] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)
  const [category, setCategory] = useState<string>(defaultCategory)
  const [name, setName] = useState("")
  const [visibility, setVisibility] = useState<GedVisibility>(isSuperAdmin ? "internal" : "shared")
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [selectedUids, setSelectedUids] = useState<string[]>([])
  const [loadingRecipients, setLoadingRecipients] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setFiles([])
    setCategory(defaultCategory)
    setName("")
    setVisibility(isSuperAdmin ? "internal" : scope === "residence" ? defaultResidenceVisibility(defaultCategory) : "shared")
    if (scope !== "lot" || !lot) {
      setRecipients([])
      setSelectedUids([])
      return
    }
    setLoadingRecipients(true)
    const owners = [...new Set(lot.idProprietaire)]
    const tenants = [...new Set(lot.idLocataire)].filter((uid) => !owners.includes(uid))
    resolveUserLabels([...owners, ...tenants])
      .then((labels) => {
        const list: Recipient[] = [
          ...owners.map((uid) => ({ uid, label: labels.get(uid) ?? uid, role: "proprietaire" as const })),
          ...tenants.map((uid) => ({ uid, label: labels.get(uid) ?? uid, role: "locataire" as const })),
        ]
        setRecipients(list)
        setSelectedUids(recipientsFor(list, defaultCategory))
      })
      .catch(() => toast.error("Impossible de charger les propriétaires et locataires de ce lot"))
      .finally(() => setLoadingRecipients(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lot, scope, isSuperAdmin])

  function recipientsFor(list: Recipient[], nextCategory: string): string[] {
    const roles = defaultRecipientRolesForCategory(nextCategory)
    const chosen = list.filter((r) => roles.includes(r.role)).map((r) => r.uid)
    return chosen.length > 0 ? chosen : list.map((r) => r.uid)
  }

  function changeCategory(next: string) {
    setCategory(next)
    if (scope === "lot") setSelectedUids(recipientsFor(recipients, next))
    // Document de résidence partagé : partage proposé selon la catégorie
    // (non partagé conservé tel quel).
    if (scope === "residence" && visibility !== "internal") setVisibility(defaultResidenceVisibility(next))
  }

  function addFiles(list: FileList | null) {
    if (!list) return
    setFiles((prev) => [...prev, ...Array.from(list).filter((f) => !prev.some((p) => p.name === f.name && p.size === f.size))])
  }

  const noRecipients = scope === "lot" && !loadingRecipients && recipients.length === 0
  const categories =
    scope === "lot" ? [...LOT_DOCUMENT_CATEGORIES.filter((c) => c !== "Justificatif"), ...GED_CATEGORIES] : GED_CATEGORIES
  const visibilityOptions: { value: GedVisibility; label: string; description: string }[] = [
    ...(isSuperAdmin
      ? [{ value: "internal" as const, label: "Non partagé", description: "Administrateurs Konodal seulement, à relire avant de le montrer." }]
      : []),
    ...(scope === "residence"
      ? [
          { value: "cs" as const, label: "Conseil syndical", description: "Membres du conseil syndical, dans l'application." },
          { value: "owners" as const, label: "Propriétaires", description: "Propriétaires et conseil syndical, masqué aux locataires." },
          { value: "shared" as const, label: "Toute la résidence", description: "Tous les résidents, propriétaires et locataires." },
        ]
      : scope === "building"
        ? [{ value: "shared" as const, label: "Occupants du bâtiment", description: "Occupants du bâtiment et conseil syndical." }]
        : [{ value: "shared" as const, label: "Destinataires du lot", description: "Les personnes cochées ci-dessous, dans l'application." }]),
  ]

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!target) return
    if (files.length === 0) {
      toast.error("Ajoutez au moins un fichier")
      return
    }
    if (scope === "lot" && selectedUids.length === 0) {
      toast.error("Sélectionnez au moins un destinataire")
      return
    }
    setSubmitting(true)
    try {
      const finalTarget: GedTarget = target.scope === "lot" ? { ...target, recipients: selectedUids } : target
      const count = await uploadGedDocuments(
        finalTarget,
        files,
        { name, category, visibility },
        targetLabel(finalTarget, title)
      )
      toast.success(count > 1 ? `${count} documents importés` : "Document importé")
      onImported()
      onOpenChange(false)
    } catch (err) {
      toast.error("Échec de l'import : " + (err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex max-h-[calc(100vh-3rem)] min-w-0 flex-col gap-4">
          <DialogHeader className="border-b border-[oklch(95%_0.003_100)] pb-4">
            <span className="text-[11.5px] font-bold tracking-wide text-primary uppercase">Importer des documents</span>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overflow-x-hidden pr-4 pl-[5px]">
            {noRecipients ? (
              <p className="rounded-[18px] border border-dashed border-input p-4 text-sm text-muted-foreground">
                Aucun propriétaire ni locataire rattaché à ce lot pour l'instant : attribuez-en un avant d'y ajouter un
                document.
              </p>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="ged-import-files"
                    onDragOver={(e) => {
                      e.preventDefault()
                      setDragging(true)
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault()
                      setDragging(false)
                      addFiles(e.dataTransfer.files)
                    }}
                    className={cn(
                      "flex cursor-pointer flex-col items-center gap-3 rounded-[14px] border-[1.5px] border-dashed border-input p-6 text-center text-muted-foreground hover:border-primary/50 hover:bg-[oklch(98%_0.003_100)]",
                      dragging && "border-primary/60 bg-[oklch(97%_0.02_155)]"
                    )}
                  >
                    <div className="flex size-[52px] shrink-0 items-center justify-center rounded-[12px] bg-[oklch(93%_0.05_150)]">
                      <FileUp className="size-5 text-[oklch(38%_0.09_155)]" />
                    </div>
                    <span className="text-[12.5px] font-semibold">Glissez vos fichiers ici ou cliquez pour les choisir</span>
                    <span className="text-xs">PDF, images, documents bureautiques · plusieurs fichiers possibles</span>
                  </label>
                  <input
                    id="ged-import-files"
                    type="file"
                    multiple
                    accept={ACCEPTED_FILE_TYPES}
                    className="hidden"
                    onChange={(e) => {
                      addFiles(e.target.files)
                      e.target.value = ""
                    }}
                  />
                  {files.length > 0 && (
                    <ul className="flex flex-col gap-1">
                      {files.map((file, i) => (
                        <li key={`${file.name}-${i}`} className="flex items-center gap-2 rounded-lg bg-muted/50 px-2.5 py-1.5 text-sm">
                          <span className="min-w-0 flex-1 truncate">{file.name}</span>
                          <span className="text-xs text-muted-foreground">{Math.max(1, Math.round(file.size / 1024))} Ko</span>
                          <button
                            type="button"
                            aria-label={`Retirer ${file.name}`}
                            onClick={() => setFiles(files.filter((_, j) => j !== i))}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X className="size-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Catégorie</Label>
                  <SearchableSelect
                    value={category}
                    onChange={changeCategory}
                    groups={[{ options: [...new Set(categories)].map((c) => ({ value: c, label: c })) }]}
                  />
                </div>

                {files.length <= 1 && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ged-import-name">Nom du document</Label>
                    <Input
                      id="ged-import-name"
                      placeholder={files[0] ? files[0].name.replace(/\.[^.]+$/, "") : "Nom du fichier par défaut"}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <Label>Partage</Label>
                  {visibilityOptions.map((option) => (
                    <label
                      key={option.value}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-[14px] border p-3",
                        visibility === option.value ? "border-[oklch(45%_0.1_155)] bg-[oklch(97%_0.02_155)]" : "border-input"
                      )}
                    >
                      <input
                        type="radio"
                        name="ged-import-visibility"
                        className="mt-1 size-4 accent-[oklch(45%_0.1_155)]"
                        checked={visibility === option.value}
                        onChange={() => setVisibility(option.value)}
                      />
                      <span className="flex flex-col">
                        <span className="text-sm font-semibold">{option.label}</span>
                        <span className="text-xs text-muted-foreground">{option.description}</span>
                      </span>
                    </label>
                  ))}
                </div>

                {scope === "lot" && (
                  <div
                    className={cn(
                      "flex flex-col gap-2 rounded-[18px] border border-[oklch(93%_0.005_100)] p-[16px_18px]",
                      loadingRecipients && "pointer-events-none opacity-50"
                    )}
                  >
                    <Label className="font-bold">Destinataires</Label>
                    <p className="text-xs text-muted-foreground">
                      Seules les personnes cochées le retrouvent dans leurs documents ; un futur occupant ne le verra pas.
                    </p>
                    {(["proprietaire", "locataire"] as const).map((role) => {
                      const list = recipients.filter((r) => r.role === role)
                      if (list.length === 0) return null
                      return (
                        <div key={role} className="flex flex-col gap-1">
                          <span className="text-xs text-muted-foreground">{role === "proprietaire" ? "Propriétaire(s)" : "Locataire(s)"}</span>
                          {list.map((r) => (
                            <label key={r.uid} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-muted/50">
                              <input
                                type="checkbox"
                                checked={selectedUids.includes(r.uid)}
                                onChange={(e) =>
                                  setSelectedUids((prev) =>
                                    e.target.checked ? [...prev, r.uid] : prev.filter((uid) => uid !== r.uid)
                                  )
                                }
                                className="size-[17px] rounded border-input accent-primary"
                              />
                              {r.label}
                            </label>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={submitting || noRecipients || loadingRecipients || files.length === 0}
              className={PRIMARY_CTA_CLASS}
            >
              <Upload />
              {submitting ? "Import en cours…" : files.length > 1 ? `Importer ${files.length} documents` : "Importer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
