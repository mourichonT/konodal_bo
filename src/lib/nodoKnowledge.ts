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
