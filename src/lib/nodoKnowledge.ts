import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore"
import { httpsCallable } from "firebase/functions"
import { unzipSync } from "fflate"
import { auth, db, functions } from "@/firebase"

// Base de connaissances de Nodo (articles, procédures, textes de référence),
// commune à toutes les agences et alimentée par le superAdmin. Ajout et
// suppression passent par les callables nodo_kb_add_source /
// nodo_kb_delete_source ; l'indexation (découpage + vecteurs bge-m3 calculés
// par OVHcloud AI Endpoints) est faite côté serveur par nodo_kb_process
// (konodal_app/functions_python/nodo_knowledge.py), qui met à jour `status` au
// fil du traitement. Chaque lundi, nodo_kb_refresh relit les sources « lien »
// et réindexe celles qui ont changé (refreshedAt, contentChangedAt,
// refreshError).

// Domaines (CATEGORIES de nodo_knowledge.py, depuis le 2026-10-30 ; avant :
// type de document). Une source rangée avant (categoryVersion absent)
// attend reclassifyKnowledgeSources.
export const KNOWLEDGE_CATEGORIES = [
  "Juridique",
  "Fiscal",
  "Métier",
  "Financement",
  "Technique",
  "Patrimoine",
  "Immobilier",
  "Autre",
] as const
export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number]
export const KNOWLEDGE_CATEGORY_VERSION = 2
export type KnowledgeKind = "file" | "url" | "text"
export type KnowledgeStatus = "pending" | "processing" | "ready" | "error"

export type KnowledgeSource = {
  id: string
  title: string
  category: string
  categoryVersion: number | null
  kind: KnowledgeKind
  status: KnowledgeStatus
  url?: string
  fileName?: string
  chunkCount: number
  charCount: number
  error?: string | null
  createdAt: Date | null
  refreshedAt: Date | null
  contentChangedAt: Date | null
  refreshError?: string | null
}

function toDate(value: unknown): Date | null {
  return value && typeof (value as { toDate?: unknown }).toDate === "function"
    ? (value as { toDate: () => Date }).toDate()
    : null
}

export function subscribeToKnowledgeSources(
  onData: (sources: KnowledgeSource[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "nodoKnowledge"), orderBy("createdAt", "desc")),
    (snapshot) =>
      onData(
        snapshot.docs.map((d) => {
          const data = d.data({ serverTimestamps: "estimate" })
          return {
            id: d.id,
            title: (data.title as string) || "Sans titre",
            category: (data.category as string) ?? "Autre",
            categoryVersion: (data.categoryVersion as number | undefined) ?? null,
            kind: data.kind as KnowledgeKind,
            status: data.status as KnowledgeStatus,
            url: data.url as string | undefined,
            fileName: data.fileName as string | undefined,
            chunkCount: (data.chunkCount as number) ?? 0,
            charCount: (data.charCount as number) ?? 0,
            error: data.error as string | null | undefined,
            createdAt: toDate(data.createdAt),
            refreshedAt: toDate(data.refreshedAt),
            contentChangedAt: toDate(data.contentChangedAt),
            refreshError: data.refreshError as string | null | undefined,
          }
        })
      ),
    onError
  )
}

// Limite côté serveur : 15 Mo (KB_MAX_FILE_BYTES). Le fichier transite en
// base64 dans l'appel : pas de règle Storage à ouvrir côté client.
export const KNOWLEDGE_MAX_FILE_BYTES = 15 * 1024 * 1024
// Formats lus par nodo_kb_process (_extract_text).
export const KNOWLEDGE_FILE_EXTENSIONS = ["pdf", "docx", "xlsx", "html", "htm", "txt", "md", "csv"]

export function fileExtension(name: string) {
  return name.includes(".") ? name.slice(name.lastIndexOf(".") + 1).toLowerCase() : ""
}

export type KnowledgeZipContent = { files: File[]; ignored: string[] }

// Archive ZIP du dialogue d'ajout, ouverte dans le navigateur : une source
// « fichier » par document lisible, envoyée par nodo_kb_add_source comme un
// fichier choisi seul, avec autoMeta (titre et catégorie déduits du texte
// par nodo_kb_process). Dossiers aplatis ; fichiers cachés et __MACOSX
// passés sous silence ; autre format ou plus de 15 Mo : ignoré (listé).
export async function readKnowledgeZip(archive: File): Promise<KnowledgeZipContent> {
  const ignored: string[] = []
  const files = unzipSync(new Uint8Array(await archive.arrayBuffer()), {
    filter: ({ name, originalSize }) => {
      const base = name.split(/[\\/]/).pop() ?? ""
      if (!base || base.startsWith(".") || name.startsWith("__MACOSX/")) return false
      const readable = KNOWLEDGE_FILE_EXTENSIONS.includes(fileExtension(base)) && originalSize <= KNOWLEDGE_MAX_FILE_BYTES
      if (!readable) ignored.push(base)
      return readable
    },
  })
  return {
    files: Object.entries(files)
      .map(([name, bytes]) => new File([bytes], name.split(/[\\/]/).pop()!))
      .sort((a, b) => a.name.localeCompare(b.name, "fr")),
    ignored,
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1] ?? "")
    reader.onerror = () => reject(reader.error ?? new Error("Lecture du fichier impossible"))
    reader.readAsDataURL(file)
  })
}

export type KnowledgeSourceInput =
  // autoMeta : titre et catégorie déduits du texte à l'indexation (fichiers
  // d'un ZIP) ; title et category sont alors ignorés.
  | { kind: "file"; title: string; category: KnowledgeCategory; file: File; autoMeta?: boolean }
  // allowWeb : ajoute aussi le site du lien aux sites web autorisés.
  | { kind: "url"; title: string; category: KnowledgeCategory; url: string; allowWeb?: boolean }
  | { kind: "text"; title: string; category: KnowledgeCategory; text: string }

export async function addKnowledgeSource(input: KnowledgeSourceInput): Promise<string> {
  const call = httpsCallable<Record<string, unknown>, { id: string }>(functions, "nodo_kb_add_source", {
    timeout: 120_000,
  })
  const base = { kind: input.kind, title: input.title, category: input.category }
  if (input.kind === "file") {
    const contentBase64 = await fileToBase64(input.file)
    return (await call({ ...base, fileName: input.file.name, contentBase64, autoMeta: !!input.autoMeta })).data.id
  }
  if (input.kind === "url") {
    return (await call({ ...base, url: input.url, allowWeb: !!input.allowWeb })).data.id
  }
  return (await call({ ...base, text: input.text })).data.id
}

export type ReclassifyResult = { done: number; failed: number; remaining: number }

// Range par domaine les sources classées avant (nodo_kb_reclassify), par
// lots : rappelé tant qu'il en reste et que l'appel avance. Le décompte suit
// en direct par subscribeToKnowledgeSources (categoryVersion).
export async function reclassifyKnowledgeSources(): Promise<ReclassifyResult> {
  const call = httpsCallable<Record<string, never>, ReclassifyResult>(functions, "nodo_kb_reclassify", {
    timeout: 540_000,
  })
  let total = 0
  for (;;) {
    const result = (await call({})).data
    total += result.done
    if (result.remaining === 0 || result.done === 0) return { ...result, done: total }
  }
}

// Propositions de fiches écrites chaque lundi par la relecture du journal de
// Nodo (konodal_app/functions_python/nodo_review.py), à partir des échanges
// marqués chaque nuit (réponse contestée, lacune, source non lue…). Rien
// n'entre dans la base sans validation ici : valider ajoute la fiche (et, pour
// une correction, retire l'ancienne version) ; rejeter la classe. Politique de
// confidentialité : aucun extrait de conversation ici, seulement des cas
// décrits sans nom, adresse, lot ni résidence (les échanges restent dans le
// journal, réservé au superAdmin).

export type KnowledgeProposal = {
  id: string
  kind: "nouvelle" | "correction"
  title: string
  category: KnowledgeCategory
  text: string
  reason: string
  sources: string[]
  cases: string[]
  reasons: string[]
  channels: string[]
  targetTitle: string | null
  targetSourceId: string | null
  createdAt: Date | null
}

export function subscribeToKnowledgeProposals(
  onData: (proposals: KnowledgeProposal[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "nodoKnowledgeProposals"), where("status", "==", "pending")),
    (snapshot) =>
      onData(
        snapshot.docs
          .map((d) => {
            const data = d.data({ serverTimestamps: "estimate" })
            const category = KNOWLEDGE_CATEGORIES.find((c) => c === data.category) ?? "Juridique"
            return {
              id: d.id,
              kind: data.kind === "correction" ? "correction" : "nouvelle",
              title: (data.title as string) ?? "",
              category,
              text: (data.text as string) ?? "",
              reason: (data.reason as string) ?? "",
              sources: (data.sources as string[]) ?? [],
              cases: (data.cases as string[]) ?? [],
              reasons: (data.reasons as string[]) ?? [],
              channels: (data.channels as string[]) ?? [],
              targetTitle: (data.targetTitle as string | null) ?? null,
              targetSourceId: (data.targetSourceId as string | null) ?? null,
              createdAt: toDate(data.createdAt),
            } satisfies KnowledgeProposal
          })
          .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
      ),
    onError
  )
}

// La nouvelle fiche est ajoutée avant de retirer l'ancienne : en cas d'échec,
// Nodo garde toujours une version.
export async function acceptKnowledgeProposal(
  proposal: KnowledgeProposal,
  edited: { title: string; category: KnowledgeCategory; text: string }
) {
  const sourceId = await addKnowledgeSource({ kind: "text", ...edited })
  if (proposal.kind === "correction" && proposal.targetSourceId) {
    await deleteKnowledgeSource(proposal.targetSourceId)
  }
  await updateDoc(doc(db, "nodoKnowledgeProposals", proposal.id), {
    status: "accepted",
    ...edited,
    sourceId,
    decidedAt: serverTimestamp(),
    decidedBy: auth.currentUser?.uid ?? null,
  })
}

export async function rejectKnowledgeProposal(proposal: KnowledgeProposal, reason: string) {
  await updateDoc(doc(db, "nodoKnowledgeProposals", proposal.id), {
    status: "rejected",
    rejectReason: reason.trim() || null,
    decidedAt: serverTimestamp(),
    decidedBy: auth.currentUser?.uid ?? null,
  })
}

export async function deleteKnowledgeSource(id: string) {
  await httpsCallable<{ id: string }, { ok: boolean }>(functions, "nodo_kb_delete_source")({ id })
}

// Sites web autorisés de la recherche web de Nodo (nodoConfig/web, lu et
// écrit par le callable nodo_web_domains, cf. nodo_web.py) : les 9 sites
// officiels par défaut tant que la liste n'a jamais été modifiée.
// residence : site local (mairie, intercommunalité) ajouté par Nodo pour une
// résidence de son territoire (nodo_local.py).
export type WebDomainOrigin = "défaut" | "manuel" | "base" | "residence"
// Comment Nodo cherche dans le site : moteur écrit pour lui (« dediee »), ou
// détecté automatiquement à l'ajout - sa propre recherche (« recherche ») ou
// une page d'articles (« rubrique ») ; « aucun » ; null = pas encore testé.
export type WebSearchMode = "dediee" | "recherche" | "rubrique" | "aucun" | null
export type WebFamily = "officiel" | "presse"
// direct : recherche dans le site lui-même (SearXNG, cf. konodal_app/searxng) ;
// sinon par l'outil web d'Anthropic (payant), sauf si le site bloque son
// robot (filet à false : pages lisibles seulement).
export type WebDomain = {
  domain: string
  origin: WebDomainOrigin
  addedAt: Date | null
  direct: boolean
  filet: boolean
  mode: WebSearchMode
  family: WebFamily | null
  searchUrl: string | null
  testedAt: Date | null
  // Site local : territoires couverts (ville, intercommunalité) ; null =
  // site national, interrogé pour toutes les questions.
  localTo: string[] | null
}
// searxng : recherche directe configurée ; sinon tout passe par l'outil
// web d'Anthropic, limité aux mêmes sites.
export type WebDomainsState = { domains: WebDomain[]; searxng: boolean }

type WebDomainsPayload = { action: "list" | "add" | "remove" | "detect"; domain?: string; family?: WebFamily }
type WebDomainJson = Omit<WebDomain, "addedAt" | "testedAt"> & { addedAt: string | null; testedAt: string | null }

async function callWebDomains(payload: WebDomainsPayload) {
  // Ajout et nouveau test : Nodo teste la recherche du site (jusqu'à ~1 min).
  const { data } = await httpsCallable<WebDomainsPayload, { domains: WebDomainJson[]; searxng: boolean }>(
    functions,
    "nodo_web_domains",
    { timeout: 120_000 }
  )(payload)
  return {
    searxng: data.searxng,
    domains: data.domains.map((d) => ({
      ...d,
      addedAt: d.addedAt ? new Date(d.addedAt) : null,
      testedAt: d.testedAt ? new Date(d.testedAt) : null,
    })),
  } satisfies WebDomainsState
}

export const listWebDomains = () => callWebDomains({ action: "list" })
export const addWebDomain = (domain: string, family: WebFamily) => callWebDomains({ action: "add", domain, family })
export const detectWebDomain = (domain: string) => callWebDomains({ action: "detect", domain })
export const removeWebDomain = (domain: string) => callWebDomains({ action: "remove", domain })
