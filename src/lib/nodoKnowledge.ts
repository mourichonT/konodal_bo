import { collection, onSnapshot, orderBy, query, type Unsubscribe } from "firebase/firestore"
import { httpsCallable } from "firebase/functions"
import { db, functions } from "@/firebase"

// Base de connaissances de Nodo (articles, procédures, textes de référence),
// commune à toutes les agences et alimentée par le superAdmin. Ajout et
// suppression passent par les callables nodo_kb_add_source /
// nodo_kb_delete_source ; l'indexation (découpage + mots-clés par Haiku) est
// faite côté serveur par nodo_kb_process (konodal_app/functions_python/
// nodo_knowledge.py), qui met à jour `status` au fil du traitement.

export const KNOWLEDGE_CATEGORIES = ["Juridique", "Procédure", "Technique", "Article", "Autre"] as const
export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number]
export type KnowledgeKind = "file" | "url" | "text"
export type KnowledgeStatus = "pending" | "processing" | "ready" | "error"

export type KnowledgeSource = {
  id: string
  title: string
  category: string
  kind: KnowledgeKind
  status: KnowledgeStatus
  url?: string
  fileName?: string
  chunkCount: number
  charCount: number
  error?: string | null
  createdAt: Date | null
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
            kind: data.kind as KnowledgeKind,
            status: data.status as KnowledgeStatus,
            url: data.url as string | undefined,
            fileName: data.fileName as string | undefined,
            chunkCount: (data.chunkCount as number) ?? 0,
            charCount: (data.charCount as number) ?? 0,
            error: data.error as string | null | undefined,
            createdAt: toDate(data.createdAt),
          }
        })
      ),
    onError
  )
}

// Limite côté serveur : 15 Mo (KB_MAX_FILE_BYTES). Le fichier transite en
// base64 dans l'appel : pas de règle Storage à ouvrir côté client.
export const KNOWLEDGE_MAX_FILE_BYTES = 15 * 1024 * 1024

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1] ?? "")
    reader.onerror = () => reject(reader.error ?? new Error("Lecture du fichier impossible"))
    reader.readAsDataURL(file)
  })
}

export type KnowledgeSourceInput =
  | { kind: "file"; title: string; category: KnowledgeCategory; file: File }
  | { kind: "url"; title: string; category: KnowledgeCategory; url: string }
  | { kind: "text"; title: string; category: KnowledgeCategory; text: string }

export async function addKnowledgeSource(input: KnowledgeSourceInput) {
  const call = httpsCallable<Record<string, unknown>, { id: string }>(functions, "nodo_kb_add_source", {
    timeout: 120_000,
  })
  const base = { kind: input.kind, title: input.title, category: input.category }
  if (input.kind === "file") {
    await call({ ...base, fileName: input.file.name, contentBase64: await fileToBase64(input.file) })
  } else if (input.kind === "url") {
    await call({ ...base, url: input.url })
  } else {
    await call({ ...base, text: input.text })
  }
}

export async function deleteKnowledgeSource(id: string) {
  await httpsCallable<{ id: string }, { ok: boolean }>(functions, "nodo_kb_delete_source")({ id })
}

// Fiches copropriété de service-public.gouv.fr (Licence Ouverte, réutilisables
// en citant la source) : les 5 dossiers copro (acteurs, documents, budget et
// charges, assemblée générale, copropriété en difficulté) + fiches isolées
// (vente, travaux, aides). Adresses et extraction du texte vérifiées le
// 16/10/2026. Légifrance (loi de 1965, décret de 1967) bloque les robots :
// à ajouter en PDF via l'onglet Fichier.
const SERVICE_PUBLIC_COPRO_CODES =
  "F2606 F38886 F2608 F2610 F32051 F11384 F1548 F31671 F896 F31644 F39760 F2589 F2665 F34051 F32059 F36760 F37504 F31672 F33877 F2127 F32058 F20586 F2590 F2603 F31418 F14745 F34026 F35451 F32920 F640 F2122 F31531 F2615 F2619 F2636 F2137 F3107 F35288 F20388 F2643 F32088 F2667 F37190 F32573 F38064 F2604 F31513 F37827 F37294"

export const SERVICE_PUBLIC_COPRO_URLS = SERVICE_PUBLIC_COPRO_CODES.split(" ").map(
  (code) => `https://www.service-public.gouv.fr/particuliers/vosdroits/${code}`
)
