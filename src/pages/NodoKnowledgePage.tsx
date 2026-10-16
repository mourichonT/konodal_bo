import { useEffect, useMemo, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { FileText, Link2, ListPlus, LoaderCircle, Plus, TextQuote, Trash2, TriangleAlert } from "lucide-react"
import { NodoIcon } from "@/components/nodo/NodoIcon"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  addKnowledgeSource,
  deleteKnowledgeSource,
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_MAX_FILE_BYTES,
  SERVICE_PUBLIC_COPRO_URLS,
  subscribeToKnowledgeSources,
  type KnowledgeCategory,
  type KnowledgeKind,
  type KnowledgeSource,
} from "@/lib/nodoKnowledge"
import { cn, PRIMARY_CTA_CLASS } from "@/lib/utils"

const KIND_META: Record<KnowledgeKind, { label: string; icon: typeof FileText }> = {
  file: { label: "Fichier", icon: FileText },
  url: { label: "Lien", icon: Link2 },
  text: { label: "Texte", icon: TextQuote },
}

// Onglets du dialogue d'ajout : les 3 types de source + l'ajout de
// plusieurs liens d'un coup (une source "url" créée par lien).
type AddMode = KnowledgeKind | "bulk"
const ADD_MODES: { key: AddMode; label: string; icon: typeof FileText }[] = [
  { key: "file", ...KIND_META.file },
  { key: "url", ...KIND_META.url },
  { key: "bulk", label: "Plusieurs liens", icon: ListPlus },
  { key: "text", ...KIND_META.text },
]
// Pause entre deux ajouts : chaque lien déclenche une indexation (Haiku) et
// un téléchargement sur le site source.
const BULK_DELAY_MS = 1500

const STATUS_META = {
  pending: { label: "En attente", className: "bg-[oklch(95%_0.005_100)] text-[oklch(45%_0.01_150)]" },
  processing: { label: "Indexation…", className: "bg-amber-50 text-amber-800" },
  ready: { label: "Indexé", className: "bg-[oklch(93%_0.05_150)] text-[oklch(36%_0.09_155)]" },
  error: { label: "Échec", className: "bg-red-50 text-red-700" },
} as const

const FIELD_CLASS =
  "w-full rounded-[10px] border border-input bg-white px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

// Base de connaissances de Nodo : sources communes (articles, procédures,
// textes de loi...) consultées par l'assistant pour toutes les agences, en
// complément des données propres à chaque agence. superAdmin uniquement.
export default function NodoKnowledgePage() {
  const [sources, setSources] = useState<KnowledgeSource[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<KnowledgeSource | null>(null)

  useEffect(() => {
    return subscribeToKnowledgeSources(
      (data) => {
        setSources(data)
        setLoading(false)
      },
      (error) => {
        toast.error("Impossible de charger la base : " + error.message)
        setLoading(false)
      }
    )
  }, [])

  const totals = useMemo(
    () => ({
      ready: sources.filter((s) => s.status === "ready").length,
      chunks: sources.reduce((sum, s) => sum + s.chunkCount, 0),
    }),
    [sources]
  )

  const existingUrls = useMemo(
    () => new Set(sources.map((s) => s.url).filter((u): u is string => !!u)),
    [sources]
  )

  async function handleRemove() {
    if (!removing) return
    try {
      await deleteKnowledgeSource(removing.id)
      toast.success("Source supprimée")
      setRemoving(null)
    } catch (err) {
      toast.error("Suppression impossible : " + (err as Error).message)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight text-[oklch(22%_0.01_150)]">
            Base de connaissances Nodo
          </h1>
          <p className="mt-1 max-w-[640px] text-[13.5px] text-muted-foreground">
            Articles, textes juridiques et procédures communs à toutes les agences. Nodo y cherche les passages
            utiles à une question, en plus des données de chaque résidence.
          </p>
        </div>
        <Button onClick={() => setAdding(true)} className={PRIMARY_CTA_CLASS}>
          <Plus />
          Ajouter une source
        </Button>
      </div>

      <div className="overflow-hidden rounded-[24px] border border-[oklch(93%_0.005_100)] bg-white shadow-[0_1px_2px_oklch(20%_0_0/0.03),0_14px_34px_-22px_oklch(20%_0_0/0.12)]">
        <div className="px-7 pt-[22px] pb-4 text-[13px] text-muted-foreground">
          <b className="text-foreground">{totals.ready}</b> source{totals.ready > 1 ? "s" : ""} indexée
          {totals.ready > 1 ? "s" : ""} · <b className="text-foreground">{totals.chunks}</b> passages
        </div>
        {!loading && sources.length === 0 ? (
          <div className="flex flex-col items-center gap-4 border-t border-[oklch(95%_0.003_100)] px-10 py-16">
            <div className="flex size-16 items-center justify-center rounded-[18px] bg-[oklch(93%_0.05_150)]">
              <NodoIcon className="size-8" color="oklch(38% 0.09 155)" />
            </div>
            <div className="text-center text-[13.5px] text-muted-foreground">
              Aucune source pour l'instant. Ajoutez un PDF, un lien vers un article ou un texte.
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Passages</TableHead>
                <TableHead>Ajoutée le</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="bg-white">
              {sources.map((source) => {
                const Kind = KIND_META[source.kind]?.icon ?? FileText
                const status = STATUS_META[source.status] ?? STATUS_META.pending
                return (
                  <TableRow key={source.id}>
                    <TableCell className="max-w-[420px]">
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-[oklch(96%_0.01_155)] text-[oklch(38%_0.07_152)]">
                          <Kind className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{source.title}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {source.url ? (
                              <a href={source.url} target="_blank" rel="noreferrer" className="hover:underline">
                                {source.url}
                              </a>
                            ) : (
                              source.fileName || KIND_META[source.kind]?.label
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{source.category}</Badge>
                    </TableCell>
                    <TableCell>
                      <span
                        title={source.error ?? undefined}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold",
                          status.className
                        )}
                      >
                        {(source.status === "processing" || source.status === "pending") && (
                          <LoaderCircle className="size-3 animate-spin" />
                        )}
                        {source.status === "error" && <TriangleAlert className="size-3" />}
                        {status.label}
                      </span>
                      {source.status === "error" && source.error && (
                        <div className="mt-1 max-w-[260px] text-xs text-red-700">{source.error}</div>
                      )}
                    </TableCell>
                    <TableCell>{source.status === "ready" ? source.chunkCount : "—"}</TableCell>
                    <TableCell>{source.createdAt?.toLocaleDateString("fr-FR") ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Supprimer la source"
                        disabled={source.status === "processing"}
                        onClick={() => setRemoving(source)}
                      >
                        <Trash2 />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <AddSourceDialog
        open={adding}
        onOpenChange={setAdding}
        existingUrls={existingUrls}
      />

      <Dialog open={!!removing} onOpenChange={(open) => !open && setRemoving(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="pb-4">
            <DialogTitle>Supprimer cette source ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            « {removing?.title} » et ses passages indexés seront retirés : Nodo ne pourra plus s'en servir.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoving(null)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleRemove}>
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AddSourceDialog({
  open,
  onOpenChange,
  existingUrls,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  existingUrls: Set<string>
}) {
  const [kind, setKind] = useState<AddMode>("file")
  const [bulkUrls, setBulkUrls] = useState("")
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState<KnowledgeCategory>("Juridique")
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState("")
  const [text, setText] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setKind("file")
    setTitle("")
    setCategory("Juridique")
    setFile(null)
    setUrl("")
    setText("")
    setBulkUrls("")
    setProgress(null)
  }, [open])

  // Une URL http(s) par ligne, sans doublon ni lien déjà présent dans la base.
  const parsedBulk = useMemo(() => {
    const urls = [
      ...new Set(
        bulkUrls
          .split(/\s+/)
          .map((u) => u.trim())
          .filter((u) => /^https?:\/\//i.test(u))
      ),
    ]
    return { urls: urls.filter((u) => !existingUrls.has(u)), skipped: urls.filter((u) => existingUrls.has(u)).length }
  }, [bulkUrls, existingUrls])

  async function handleBulk() {
    const { urls } = parsedBulk
    if (urls.length === 0) return toast.error("Aucun nouveau lien à ajouter")
    setSaving(true)
    let failed = 0
    for (const [index, link] of urls.entries()) {
      setProgress({ done: index, total: urls.length })
      try {
        await addKnowledgeSource({ kind: "url", title: "", category, url: link })
      } catch {
        failed += 1
      }
      if (index < urls.length - 1) await new Promise((resolve) => setTimeout(resolve, BULK_DELAY_MS))
    }
    setSaving(false)
    setProgress(null)
    if (failed) toast.error(`${urls.length - failed} lien(s) ajouté(s), ${failed} refusé(s)`)
    else toast.success(`${urls.length} lien(s) ajouté(s) : indexation en cours`)
    onOpenChange(false)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (kind === "bulk") return handleBulk()
    if (kind === "file" && !file) return toast.error("Choisissez un fichier")
    if (kind === "file" && file && file.size > KNOWLEDGE_MAX_FILE_BYTES) return toast.error("Fichier trop volumineux (15 Mo maximum)")
    if (kind === "url" && !/^https?:\/\//i.test(url.trim())) return toast.error("Saisissez une adresse http(s)")
    if (kind === "text" && (!title.trim() || text.trim().length < 50))
      return toast.error("Un titre et un texte d'au moins 50 caractères sont nécessaires")
    setSaving(true)
    try {
      if (kind === "file") await addKnowledgeSource({ kind, title: title.trim(), category, file: file! })
      else if (kind === "url") await addKnowledgeSource({ kind, title: title.trim(), category, url: url.trim() })
      else await addKnowledgeSource({ kind, title: title.trim(), category, text: text.trim() })
      toast.success("Source ajoutée : indexation en cours")
      onOpenChange(false)
    } catch (err) {
      toast.error("Ajout impossible : " + (err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex max-h-[calc(100vh-3rem)] min-w-0 flex-col gap-4">
          <DialogHeader className="pb-4">
            <DialogTitle>Ajouter une source</DialogTitle>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto pr-4 pl-[5px]">
            <div className="flex gap-1 rounded-xl bg-[oklch(95%_0.005_100)] p-1">
              {ADD_MODES.map(({ key, label, icon: Icon }) => {
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={saving}
                    onClick={() => setKind(key)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold",
                      kind === key ? "bg-white shadow-sm" : "text-muted-foreground"
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="truncate">{label}</span>
                  </button>
                )
              })}
            </div>

            {kind === "file" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="kb-file">Fichier (PDF, Word, Excel, HTML, texte - 15 Mo max)</Label>
                <Input
                  id="kb-file"
                  type="file"
                  accept=".pdf,.docx,.xlsx,.html,.htm,.txt,.md,.csv"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
            )}
            {kind === "url" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="kb-url">Adresse de l'article ou du PDF</Label>
                <Input id="kb-url" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
              </div>
            )}

            {kind === "bulk" && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="kb-bulk">Liens (un par ligne)</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={saving}
                    onClick={() => {
                      setBulkUrls(SERVICE_PUBLIC_COPRO_URLS.join("\n"))
                      setCategory("Juridique")
                    }}
                  >
                    Fiches copro service-public ({SERVICE_PUBLIC_COPRO_URLS.length})
                  </Button>
                </div>
                <textarea
                  id="kb-bulk"
                  className={cn(FIELD_CLASS, "min-h-48 resize-y font-mono text-xs")}
                  value={bulkUrls}
                  disabled={saving}
                  placeholder={"https://…\nhttps://…"}
                  onChange={(e) => setBulkUrls(e.target.value)}
                />
                <span className="text-xs text-muted-foreground">
                  {parsedBulk.urls.length} nouveau(x) lien(s)
                  {parsedBulk.skipped > 0 ? ` · ${parsedBulk.skipped} déjà dans la base, ignoré(s)` : ""}
                  {progress ? ` · ajout ${progress.done + 1} / ${progress.total}…` : ""}
                </span>
              </div>
            )}

            {kind !== "bulk" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="kb-title">
                  Titre{kind === "text" ? "" : " (facultatif : nom du fichier ou titre de la page sinon)"}
                </Label>
                <Input id="kb-title" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="kb-category">Catégorie</Label>
              <select
                id="kb-category"
                className={FIELD_CLASS}
                value={category}
                onChange={(e) => setCategory(e.target.value as KnowledgeCategory)}
              >
                {KNOWLEDGE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {kind === "text" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="kb-text">Texte</Label>
                <textarea
                  id="kb-text"
                  className={cn(FIELD_CLASS, "min-h-48 resize-y")}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Le document est découpé en passages, résumés et indexés par mots-clés (une seule fois, coût faible).
              Nodo n'enverra ensuite au modèle que les passages utiles à chaque question.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving} className={PRIMARY_CTA_CLASS}>
              {saving ? <LoaderCircle className="animate-spin" /> : <Plus />}
              Ajouter
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
