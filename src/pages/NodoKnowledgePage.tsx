import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import {
  Check,
  FileText,
  FileUp,
  Globe,
  Library,
  Lightbulb,
  Pencil,
  X,
  Link2,
  ListPlus,
  LoaderCircle,
  Plus,
  RefreshCw,
  TextQuote,
  Trash2,
  TriangleAlert,
} from "lucide-react"
import { NodoIcon } from "@/components/nodo/NodoIcon"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  acceptKnowledgeProposal,
  addKnowledgeSource,
  addWebDomain,
  detectWebDomain,
  deleteKnowledgeSource,
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_MAX_FILE_BYTES,
  listWebDomains,
  rejectKnowledgeProposal,
  removeWebDomain,
  subscribeToKnowledgeProposals,
  subscribeToKnowledgeSources,
  type KnowledgeCategory,
  type KnowledgeKind,
  type KnowledgeProposal,
  type KnowledgeSource,
  type WebDomainOrigin,
  type WebFamily,
  type WebSearchMode,
  type WebDomainsState,
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
// Pause entre deux ajouts : chaque lien déclenche une indexation (vecteurs
// OVH) et un téléchargement sur le site source.
const BULK_DELAY_MS = 1500

type BulkEntry = { url: string; category: KnowledgeCategory | null; title: string }

// Une source par ligne : "url" seule, ou "url;catégorie;titre" (format du
// CSV importé, séparateur ; ou ,). Ligne d'en-tête et lignes sans URL
// http(s) ignorées ; catégorie inconnue = catégorie choisie dans le dialogue.
function parseBulkLines(value: string): BulkEntry[] {
  const entries: BulkEntry[] = []
  for (const line of value.split(/\r?\n/)) {
    const separator = line.includes(";") ? ";" : ","
    const [rawUrl = "", rawCategory = "", ...rawTitle] = line.split(separator)
    const clean = (cell: string) => cell.trim().replace(/^"(.*)"$/, "$1").replace(/""/g, '"').trim()
    const url = clean(rawUrl)
    if (!/^https?:\/\//i.test(url)) continue
    const category = KNOWLEDGE_CATEGORIES.find((c) => c.toLowerCase() === clean(rawCategory).toLowerCase()) ?? null
    entries.push({ url, category, title: clean(rawTitle.join(separator)) })
  }
  return entries
}

const STATUS_META = {
  pending: { label: "En attente", className: "bg-[oklch(95%_0.005_100)] text-[oklch(45%_0.01_150)]" },
  processing: { label: "Indexation…", className: "bg-amber-50 text-amber-800" },
  ready: { label: "Indexé", className: "bg-[oklch(93%_0.05_150)] text-[oklch(36%_0.09_155)]" },
  error: { label: "Échec", className: "bg-red-50 text-red-700" },
} as const

const FIELD_CLASS =
  "w-full rounded-[10px] border border-input bg-white px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

const CARD_CLASS =
  "overflow-hidden rounded-[24px] border border-[oklch(93%_0.005_100)] bg-white shadow-[0_1px_2px_oklch(20%_0_0/0.03),0_14px_34px_-22px_oklch(20%_0_0/0.12)]"

const ORIGIN_LABEL: Record<WebDomainOrigin, string> = {
  défaut: "Par défaut",
  manuel: "Ajouté à la main",
  base: "Depuis la base",
  residence: "Depuis une résidence",
}

const SEARCH_MODE_LABEL: Record<NonNullable<WebSearchMode>, string> = {
  dediee: "Moteur dédié au site",
  recherche: "Recherche du site trouvée",
  rubrique: "Page d'articles du site",
  aucun: "Pas de recherche directe possible",
}

type View = "sources" | "proposals" | "web"

// Chaque vue a son adresse (/nodo/connaissances/<chemin>), atteinte
// directement depuis le sous-menu Base Nodo, comme Sinistres.
const VIEW_PATH: Record<View, string> = { sources: "sources", proposals: "propositions", web: "sites" }

// Bascule Sources / Sites web autorisés / Propositions, même style que
// UsersSectionToggle (même ordre que le sous-menu Base Nodo).
function ViewToggle({
  view,
  onChange,
  proposalCount,
}: {
  view: View
  onChange: (view: View) => void
  proposalCount: number
}) {
  const item = (active: boolean) =>
    cn(
      "flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors sm:gap-2 sm:px-[22px] sm:py-[11px] sm:text-[14.5px]",
      active
        ? "bg-[oklch(45%_0.1_155)] font-bold text-white shadow-[0_6px_16px_-6px_oklch(38%_0.08_155/0.5)]"
        : "text-[oklch(45%_0.01_150)] hover:bg-[oklch(98%_0.003_100)]"
    )
  return (
    <div className="flex items-center gap-1 rounded-2xl bg-[oklch(93%_0.005_100)] p-1.5 sm:gap-[5px]">
      <button type="button" className={item(view === "sources")} onClick={() => onChange("sources")}>
        <Library className="size-3.5 sm:size-4" />
        Sources
      </button>
      <button type="button" className={item(view === "web")} onClick={() => onChange("web")}>
        <Globe className="size-3.5 sm:size-4" />
        <span className="sm:hidden">Sites web</span>
        <span className="hidden sm:inline">Sites web autorisés</span>
      </button>
      <button type="button" className={item(view === "proposals")} onClick={() => onChange("proposals")}>
        <Lightbulb className="size-3.5 sm:size-4" />
        Propositions
        {proposalCount > 0 && (
          <span
            className={cn(
              "rounded-full px-1.5 text-[11px] font-bold",
              view === "proposals" ? "bg-white/25 text-white" : "bg-amber-100 text-amber-800"
            )}
          >
            {proposalCount}
          </span>
        )}
      </button>
    </div>
  )
}

// Motifs du repérage nocturne du journal (nodo_journal_triage), affichés
// sur les échanges à l'origine d'une proposition.
const REASON_LABEL: Record<string, string> = {
  contestee: "Réponse contestée",
  lacune: "Lacune avouée",
  baseVide: "Rien dans la base",
  sourceNonLue: "Source non lue retirée",
  erreur: "Erreur",
  limiteRecherches: "Limite de recherches",
  outilImpose: "Recherche imposée",
  reponseAnglaise: "Réponse en anglais",
  lente: "Réponse lente",
  sansOutil: "Sans recherche",
  fluxInterrompu: "Connexion coupée",
  redactionJointe: "Rédaction",
}

type ProposalDraft = { title: string; category: KnowledgeCategory; text: string }

// Propositions de fiches de la relecture hebdomadaire du journal : chacune
// se valide (ajout à la base), se modifie avant validation ou se rejette ;
// « Tout valider » les ajoute toutes, telles qu'affichées (modifications en
// cours comprises), après confirmation. Les brouillons sont gardés ici, pas
// dans chaque carte, pour que la validation groupée les voie.
function ProposalsPanel({ proposals, loading }: { proposals: KnowledgeProposal[]; loading: boolean }) {
  const [drafts, setDrafts] = useState<Record<string, ProposalDraft>>({})
  const [confirmAll, setConfirmAll] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const draftOf = (p: KnowledgeProposal): ProposalDraft =>
    drafts[p.id] ?? { title: p.title, category: p.category, text: p.text }
  const ready = proposals.filter((p) => draftOf(p).title.trim() && draftOf(p).text.trim())

  async function handleAcceptAll() {
    const list = [...ready]
    setProgress({ done: 0, total: list.length })
    let done = 0
    for (const proposal of list) {
      const draft = draftOf(proposal)
      try {
        await acceptKnowledgeProposal(proposal, {
          title: draft.title.trim(),
          category: draft.category,
          text: draft.text.trim(),
        })
        done++
        setProgress({ done, total: list.length })
      } catch (err) {
        toast.error(`« ${draft.title} » non validée : ${(err as Error).message}`)
        break
      }
    }
    setProgress(null)
    setConfirmAll(false)
    if (done > 0) toast.success(`${done} fiche${done > 1 ? "s" : ""} ajoutée${done > 1 ? "s" : ""} à la base`)
  }

  if (loading) {
    return (
      <div className={cn(CARD_CLASS, "flex justify-center px-10 py-16")}>
        <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (proposals.length === 0) {
    return (
      <div className={cn(CARD_CLASS, "flex flex-col items-center gap-4 px-10 py-16")}>
        <div className="flex size-16 items-center justify-center rounded-[18px] bg-[oklch(93%_0.05_150)]">
          <Lightbulb className="size-8 text-[oklch(38%_0.09_155)]" />
        </div>
        <div className="max-w-[520px] text-center text-[13.5px] text-muted-foreground">
          Aucune proposition en attente. Chaque lundi, Nodo relit les échanges de la semaine marqués comme à revoir
          (réponse contestée, lacune, source non lue…) et propose ici les fiches à ajouter ou à corriger.
        </div>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[13px] text-muted-foreground">
          <b className="text-foreground">{proposals.length}</b> proposition{proposals.length > 1 ? "s" : ""} en
          attente de validation
        </div>
        <Button
          onClick={() => setConfirmAll(true)}
          disabled={progress !== null || ready.length === 0}
          className={PRIMARY_CTA_CLASS}
        >
          <Check />
          Tout valider
        </Button>
      </div>

      {proposals.map((proposal) => (
        <ProposalCard
          key={proposal.id}
          proposal={proposal}
          draft={draftOf(proposal)}
          onDraftChange={(draft) => setDrafts((prev) => ({ ...prev, [proposal.id]: draft }))}
          locked={progress !== null}
        />
      ))}

      <Dialog open={confirmAll} onOpenChange={(open) => !open && progress === null && setConfirmAll(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="pb-4">
            <DialogTitle>Valider toutes les propositions ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {ready.length} fiche{ready.length > 1 ? "s" : ""} {ready.length > 1 ? "seront ajoutées" : "sera ajoutée"}{" "}
            à la base, telles qu'affichées ; pour une correction, l'ancienne version est retirée. Nodo s'en servira
            aussitôt pour toutes les agences et tous les résidents.
          </p>
          {progress && (
            <p className="text-sm font-semibold">
              Validation en cours : {progress.done} / {progress.total}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAll(false)} disabled={progress !== null}>
              Annuler
            </Button>
            <Button onClick={handleAcceptAll} disabled={progress !== null} className={PRIMARY_CTA_CLASS}>
              {progress ? <LoaderCircle className="animate-spin" /> : <Check />}
              Tout valider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ProposalCard({
  proposal,
  draft,
  onDraftChange,
  locked,
}: {
  proposal: KnowledgeProposal
  draft: ProposalDraft
  onDraftChange: (draft: ProposalDraft) => void
  locked: boolean
}) {
  const { title, category, text } = draft
  const setTitle = (value: string) => onDraftChange({ ...draft, title: value })
  const setCategory = (value: KnowledgeCategory) => onDraftChange({ ...draft, category: value })
  const setText = (value: string) => onDraftChange({ ...draft, text: value })
  const [editing, setEditing] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [busy, setBusy] = useState<"accept" | "reject" | null>(null)
  const correction = proposal.kind === "correction"

  async function handleAccept() {
    if (!title.trim() || !text.trim()) return
    setBusy("accept")
    try {
      await acceptKnowledgeProposal(proposal, { title: title.trim(), category, text: text.trim() })
      toast.success(correction ? "Fiche corrigée dans la base" : "Fiche ajoutée à la base")
    } catch (err) {
      toast.error("Validation impossible : " + (err as Error).message)
      setBusy(null)
    }
  }

  async function handleReject() {
    setBusy("reject")
    try {
      await rejectKnowledgeProposal(proposal, rejectReason)
      toast.success("Proposition rejetée")
    } catch (err) {
      toast.error("Rejet impossible : " + (err as Error).message)
      setBusy(null)
    }
  }

  return (
    <div className={cn(CARD_CLASS, "flex flex-col gap-4 px-7 py-6")}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span
          className={cn(
            "rounded-full px-2.5 py-1 font-bold",
            correction ? "bg-amber-50 text-amber-800" : "bg-[oklch(93%_0.05_150)] text-[oklch(36%_0.09_155)]"
          )}
        >
          {correction ? "Correction" : "Nouvelle fiche"}
        </span>
        <Badge variant="secondary">{category}</Badge>
        {proposal.createdAt && (
          <span className="text-muted-foreground">Proposée le {proposal.createdAt.toLocaleDateString("fr-FR")}</span>
        )}
      </div>

      {editing ? (
        <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Titre de la fiche" />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as KnowledgeCategory)}
            className={FIELD_CLASS}
            aria-label="Catégorie"
          >
            {KNOWLEDGE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="text-[16px] font-bold text-[oklch(22%_0.01_150)]">{title}</div>
      )}

      {correction && (
        <div className="text-[13px] text-muted-foreground">
          Remplace « {proposal.targetTitle} »
          {!proposal.targetSourceId && (
            <span className="ml-1 text-amber-800">
              (fiche d'origine introuvable : l'ancienne version ne sera pas retirée)
            </span>
          )}
        </div>
      )}

      <p className="text-[13.5px]">
        <b>Pourquoi :</b> {proposal.reason}
      </p>

      {editing ? (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={14}
          className={cn(FIELD_CLASS, "font-mono text-[12.5px] leading-relaxed")}
          aria-label="Texte de la fiche"
        />
      ) : (
        <div className="max-h-[320px] overflow-y-auto whitespace-pre-wrap rounded-[14px] bg-[oklch(98%_0.003_100)] px-4 py-3 text-[13px] leading-relaxed">
          {text}
        </div>
      )}

      {proposal.sources.length > 0 && (
        <div className="text-xs text-muted-foreground">
          <b>Vérifié sur :</b> {proposal.sources.join(" ; ")}
        </div>
      )}

      {proposal.cases.length > 0 && (
        <details className="rounded-[14px] border border-[oklch(93%_0.005_100)] px-4 py-3 text-[13px]">
          <summary className="cursor-pointer font-semibold">
            Échanges à l'origine ({proposal.cases.length})
          </summary>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {proposal.channels.map((channel) => (
              <Badge key={channel} variant="outline">
                {channel === "app" ? "App" : "BO"}
              </Badge>
            ))}
            {proposal.reasons.map((reason) => (
              <Badge key={reason} variant="secondary">
                {REASON_LABEL[reason] ?? reason}
              </Badge>
            ))}
          </div>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted-foreground">
            {proposal.cases.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </details>
      )}

      {rejecting ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Raison du rejet (facultatif)"
            aria-label="Raison du rejet"
          />
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setRejecting(false)} disabled={locked || busy !== null}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={locked || busy !== null}>
              {busy === "reject" && <LoaderCircle className="animate-spin" />}
              Rejeter
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => setRejecting(true)} disabled={locked || busy !== null}>
            <X />
            Rejeter
          </Button>
          <Button variant="outline" onClick={() => setEditing(!editing)} disabled={locked || busy !== null}>
            <Pencil />
            {editing ? "Terminer la modification" : "Modifier"}
          </Button>
          <Button
            onClick={handleAccept}
            disabled={locked || busy !== null || !title.trim() || !text.trim()}
            className={PRIMARY_CTA_CLASS}
          >
            {busy === "accept" ? <LoaderCircle className="animate-spin" /> : <Check />}
            {correction ? "Valider la correction" : "Ajouter à la base"}
          </Button>
        </div>
      )}
    </div>
  )
}

// Base de connaissances de Nodo : sources communes (articles, procédures,
// textes de loi...) consultées par l'assistant pour toutes les agences, en
// complément des données propres à chaque agence. superAdmin uniquement.
export default function NodoKnowledgePage() {
  const [sources, setSources] = useState<KnowledgeSource[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<KnowledgeSource | null>(null)
  const { vue } = useParams()
  const navigate = useNavigate()
  const view = (Object.keys(VIEW_PATH) as View[]).find((key) => VIEW_PATH[key] === vue) ?? "sources"
  const setView = (next: View) => navigate(`/nodo/connaissances/${VIEW_PATH[next]}`)
  const [proposals, setProposals] = useState<KnowledgeProposal[]>([])
  const [proposalsLoading, setProposalsLoading] = useState(true)

  useEffect(() => {
    return subscribeToKnowledgeProposals(
      (data) => {
        setProposals(data)
        setProposalsLoading(false)
      },
      (error) => {
        toast.error("Impossible de charger les propositions : " + error.message)
        setProposalsLoading(false)
      }
    )
  }, [])

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
      {/* Aligné en haut : la bascule reste à la même place, avec ou sans le bouton dessous. */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight text-[oklch(22%_0.01_150)]">
            Base de connaissances Nodo
          </h1>
          <p className="mt-1 max-w-[640px] text-[13.5px] text-muted-foreground">
            Articles, textes juridiques et procédures communs à toutes les agences. Nodo y cherche les passages
            utiles à une question, en plus des données de chaque résidence.
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <ViewToggle view={view} onChange={setView} proposalCount={proposals.length} />
          {view === "sources" && (
            <Button onClick={() => setAdding(true)} className={PRIMARY_CTA_CLASS}>
              <Plus />
              Ajouter une source
            </Button>
          )}
        </div>
      </div>

      {view === "web" ? (
        <WebDomainsPanel />
      ) : view === "proposals" ? (
        <ProposalsPanel proposals={proposals} loading={proposalsLoading} />
      ) : (
        <div className={CARD_CLASS}>
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
                        {source.status === "ready" && source.kind === "url" && (
                          <div
                            title={source.refreshError ?? undefined}
                            className={cn(
                              "mt-1 text-xs",
                              source.refreshError ? "text-amber-800" : "text-muted-foreground"
                            )}
                          >
                            {source.refreshError
                              ? "Lien inaccessible à la dernière vérification"
                              : source.contentChangedAt
                                ? `Mise à jour le ${source.contentChangedAt.toLocaleDateString("fr-FR")}`
                                : source.refreshedAt
                                  ? `Vérifiée le ${source.refreshedAt.toLocaleDateString("fr-FR")}`
                                  : null}
                          </div>
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
      )}

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
  const csvInputRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState<KnowledgeCategory>("Juridique")
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState("")
  const [text, setText] = useState("")
  const [allowWeb, setAllowWeb] = useState(false)
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
    setAllowWeb(false)
    setProgress(null)
  }, [open])

  // Sans doublon ni lien déjà présent dans la base.
  const parsedBulk = useMemo(() => {
    const unique = [...new Map(parseBulkLines(bulkUrls).map((e) => [e.url, e])).values()]
    return {
      entries: unique.filter((e) => !existingUrls.has(e.url)),
      skipped: unique.filter((e) => existingUrls.has(e.url)).length,
    }
  }, [bulkUrls, existingUrls])

  async function handleCsvFile(csvFile: File | undefined) {
    if (!csvFile) return
    try {
      const content = await csvFile.text()
      setBulkUrls(content.replace(/^\uFEFF/, ""))
      const count = parseBulkLines(content).length
      if (count === 0) toast.error("Aucune adresse http(s) trouvée dans ce fichier")
    } catch {
      toast.error("Lecture du fichier impossible")
    }
  }

  async function handleBulk() {
    const { entries } = parsedBulk
    if (entries.length === 0) return toast.error("Aucun nouveau lien à ajouter")
    setSaving(true)
    let failed = 0
    for (const [index, entry] of entries.entries()) {
      setProgress({ done: index, total: entries.length })
      try {
        await addKnowledgeSource({
          kind: "url",
          title: entry.title,
          category: entry.category ?? category,
          url: entry.url,
          allowWeb,
        })
      } catch {
        failed += 1
      }
      if (index < entries.length - 1) await new Promise((resolve) => setTimeout(resolve, BULK_DELAY_MS))
    }
    setSaving(false)
    setProgress(null)
    if (failed) toast.error(`${entries.length - failed} lien(s) ajouté(s), ${failed} refusé(s)`)
    else toast.success(`${entries.length} lien(s) ajouté(s) : indexation en cours`)
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
      else if (kind === "url")
        await addKnowledgeSource({ kind, title: title.trim(), category, url: url.trim(), allowWeb })
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
                    onClick={() => csvInputRef.current?.click()}
                  >
                    <FileUp />
                    Importer un CSV
                  </Button>
                  <input
                    ref={csvInputRef}
                    type="file"
                    accept=".csv,text/csv,.txt"
                    className="hidden"
                    onChange={(e) => {
                      handleCsvFile(e.target.files?.[0])
                      e.target.value = ""
                    }}
                  />
                </div>
                <textarea
                  id="kb-bulk"
                  className={cn(FIELD_CLASS, "min-h-48 resize-y font-mono text-xs")}
                  value={bulkUrls}
                  disabled={saving}
                  placeholder={"https://…\nhttps://…;Juridique;Titre facultatif"}
                  onChange={(e) => setBulkUrls(e.target.value)}
                />
                <span className="text-xs text-muted-foreground">
                  CSV : url;catégorie;titre (catégorie et titre facultatifs) · {parsedBulk.entries.length}{" "}
                  nouveau(x) lien(s)
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

            {(kind === "url" || kind === "bulk") && (
              <label className="flex items-start gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-muted/50">
                <input
                  type="checkbox"
                  checked={allowWeb}
                  disabled={saving}
                  onChange={(e) => setAllowWeb(e.target.checked)}
                  className="mt-0.5 size-[17px] shrink-0 rounded border-input accent-primary"
                />
                <span>
                  Ajouter {kind === "bulk" ? "leurs sites" : "ce site"} aux sites web autorisés
                  <span className="block text-xs text-muted-foreground">
                    Nodo pourra aussi y chercher l'actualité (recherche web).
                  </span>
                </span>
              </label>
            )}

            <p className="text-xs text-muted-foreground">
              Le document est découpé en passages, indexés par le sens et par mots-clés (une seule fois, coût
              négligeable). Nodo n'enverra ensuite au modèle que les passages utiles à chaque question.
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

// Sites web autorisés : la recherche web de Nodo ne garde que les résultats
// de ces sites (sous-domaines compris) et ne lit que leurs pages.
function WebDomainsPanel() {
  const [state, setState] = useState<WebDomainsState | null>(null)
  const [domain, setDomain] = useState("")
  const [family, setFamily] = useState<WebFamily>("presse")
  // "add" pendant un ajout, "detect:<site>" pendant un nouveau test, sinon le
  // site en cours de retrait.
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    listWebDomains()
      .then(setState)
      .catch((err) => toast.error("Impossible de charger les sites : " + (err as Error).message))
  }, [])

  async function handleAdd(event: FormEvent) {
    event.preventDefault()
    if (!domain.trim()) return
    setBusy("add")
    try {
      const known = new Set(state?.domains.map((d) => d.domain))
      const next = await addWebDomain(domain.trim(), family)
      setState(next)
      setDomain("")
      const added = next.domains.find((d) => !known.has(d.domain))
      toast.success(added ? `${added.domain} ajouté · ${SEARCH_MODE_LABEL[added.mode ?? "aucun"]}` : "Site déjà autorisé")
    } catch (err) {
      toast.error("Ajout impossible : " + (err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function handleDetect(value: string) {
    setBusy(`detect:${value}`)
    try {
      const next = await detectWebDomain(value)
      setState(next)
      const entry = next.domains.find((d) => d.domain === value)
      toast.success(`${value} · ${SEARCH_MODE_LABEL[entry?.mode ?? "aucun"]}`)
    } catch (err) {
      toast.error("Test impossible : " + (err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function handleRemove(value: string) {
    setBusy(value)
    try {
      setState(await removeWebDomain(value))
      toast.success(`${value} retiré`)
    } catch (err) {
      toast.error("Retrait impossible : " + (err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className={CARD_CLASS}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-7 pt-[22px] pb-4">
        <div className="text-[13px] text-muted-foreground">
          <b className="text-foreground">{state?.domains.length ?? "…"}</b> site
          {(state?.domains.length ?? 0) > 1 ? "s" : ""} autorisé{(state?.domains.length ?? 0) > 1 ? "s" : ""}
          {state &&
            (state.searxng
              ? ` · ${state.domains.filter((d) => d.direct).length} en recherche directe, ${
                  state.domains.filter((d) => !d.direct && d.filet).length
                } par le filet Anthropic, ${state.domains.filter((d) => !d.direct && !d.filet).length} en lecture seule`
              : " · recherche web par l'outil d'Anthropic")}
        </div>
        <form onSubmit={handleAdd} className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Input
            aria-label="Site à autoriser"
            placeholder="exemple.gouv.fr ou https://…"
            value={domain}
            disabled={busy !== null}
            onChange={(e) => setDomain(e.target.value)}
            className="min-w-0 flex-1 sm:w-64 sm:flex-none"
          />
          <select
            aria-label="Type de site"
            className={cn(FIELD_CLASS, "w-auto")}
            value={family}
            disabled={busy !== null}
            onChange={(e) => setFamily(e.target.value as WebFamily)}
          >
            <option value="presse">Presse / média</option>
            <option value="officiel">Officiel / collectivité</option>
          </select>
          <Button type="submit" disabled={busy !== null || !domain.trim()} className={PRIMARY_CTA_CLASS}>
            {busy === "add" ? <LoaderCircle className="animate-spin" /> : <Plus />}
            {busy === "add" ? "Test de la recherche…" : "Ajouter"}
          </Button>
        </form>
      </div>
      {!state ? (
        <div className="flex justify-center border-t border-[oklch(95%_0.003_100)] py-12">
          <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : state.domains.length === 0 ? (
        <div className="border-t border-[oklch(95%_0.003_100)] px-10 py-12 text-center text-[13.5px] text-muted-foreground">
          Aucun site autorisé : la recherche web de Nodo est désactivée.
        </div>
      ) : (
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead>Site</TableHead>
              <TableHead>Recherche</TableHead>
              <TableHead>Portée</TableHead>
              <TableHead>Origine</TableHead>
              <TableHead>Ajouté le</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="bg-white">
            {state.domains.map((entry) => (
              <TableRow key={entry.domain}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-[oklch(96%_0.01_155)] text-[oklch(38%_0.07_152)]">
                      <Globe className="size-4" />
                    </div>
                    <a
                      href={`https://${entry.domain}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold hover:underline"
                    >
                      {entry.domain}
                    </a>
                  </div>
                </TableCell>
                <TableCell>
                  <span
                    title={
                      (entry.direct
                        ? `${SEARCH_MODE_LABEL[entry.mode ?? "dediee"]}${entry.searchUrl ? ` : ${entry.searchUrl}` : ""}`
                        : entry.filet
                          ? "Pas de recherche directe : recherche par l'outil d'Anthropic (payant), pages lisibles"
                          : "Ni recherche directe ni outil d'Anthropic (le site bloque son robot) : Nodo peut seulement lire une page dont il a l'adresse") +
                      (entry.testedAt ? ` · testé le ${entry.testedAt.toLocaleDateString("fr-FR")}` : "")
                    }
                    className={cn(
                      "inline-flex rounded-full px-2.5 py-1 text-xs font-bold",
                      entry.direct
                        ? "bg-[oklch(93%_0.05_150)] text-[oklch(36%_0.09_155)]"
                        : entry.filet
                          ? "bg-[oklch(95%_0.005_100)] text-[oklch(45%_0.01_150)]"
                          : "bg-amber-50 text-amber-800"
                    )}
                  >
                    {entry.direct ? "Directe" : entry.filet ? "Filet Anthropic" : "Lecture seule"}
                  </span>
                </TableCell>
                <TableCell className="max-w-[220px]">
                  {entry.localTo ? (
                    <span
                      className="block truncate text-xs"
                      title="Site local : interrogé seulement pour une question sur une résidence de ce territoire"
                    >
                      <b>Local</b> · {entry.localTo.join(", ")}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">National</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{ORIGIN_LABEL[entry.origin] ?? entry.origin}</Badge>
                </TableCell>
                <TableCell>{entry.addedAt?.toLocaleDateString("fr-FR") ?? "—"}</TableCell>
                <TableCell className="text-right">
                  {state.searxng && entry.mode !== "dediee" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Retester la recherche de ${entry.domain}`}
                      title="Retester : Nodo cherche à nouveau comment interroger ce site"
                      disabled={busy !== null}
                      onClick={() => handleDetect(entry.domain)}
                    >
                      {busy === `detect:${entry.domain}` ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Retirer ${entry.domain}`}
                    disabled={busy !== null}
                    onClick={() => handleRemove(entry.domain)}
                  >
                    {busy === entry.domain ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <p className="border-t border-[oklch(95%_0.003_100)] px-7 py-4 text-xs text-muted-foreground">
        Un site couvre ses sous-domaines (service-public.gouv.fr inclut entreprendre.service-public.gouv.fr). Nodo
        ne garde que les résultats de ces sites et ne lit que leurs pages, en complément de la base de
        connaissances. Chaque nouveau site est testé à l'ajout : Nodo trouve seul comment y chercher (sa propre
        recherche, sinon une page d'articles récents), puis le reteste chaque semaine.
      </p>
    </div>
  )
}
