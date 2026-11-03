import { collection, onSnapshot, type Timestamp, type Unsubscribe } from "firebase/firestore"
import { httpsCallable } from "firebase/functions"
import { db, functions } from "@/firebase"

// Modération des contenus (Contenus > Modération, superAdmin) : un document
// moderationReports/{id} par contenu signalé depuis l'app (« Signaler » sur
// un post, un commentaire ou une réponse), cf. konodal_app/functions_python/
// moderation.py. Une suppression depuis Contenus > Posts crée aussi un
// document, déjà traité (source « bo »).

export type ModerationStatus = "A_TRAITER" | "IGNORE" | "SUPPRIME"
export type ModerationTarget = "post" | "comment" | "reply"

// Motifs du parcours « Signaler » de l'app (REASONS de moderation.py) ;
// chaque signalement porte aussi ses libellés (reasonLabel, subReasonLabel).
export const REASON_LABELS: Record<string, string> = {
  harcelement: "Harcèlement ou intimidation",
  haine: "Propos haineux ou insultants",
  violence: "Contenu violent ou choquant",
  vie_privee: "Atteinte à la vie privée",
  mineur: "Problème impliquant un mineur",
  adulte: "Contenu réservé aux adultes",
  arnaque: "Arnaque, fraude ou fausse information",
  spam: "Publicité ou spam",
  vente_restreinte: "Vente d'articles soumis à restrictions",
}

export const TARGET_LABELS: Record<ModerationTarget, string> = {
  post: "Publication",
  comment: "Commentaire",
  reply: "Réponse",
}

export type ContentReport = {
  uid: string
  name: string
  reason: string
  reasonLabel: string
  subReasonLabel: string
  details: string
  at: Date | null
}

export type ModerationReport = {
  id: string
  residenceId: string
  postId: string
  commentId: string
  replyId: string
  targetType: ModerationTarget
  status: ModerationStatus
  source: "app" | "bo"
  // Masqué pour tous dans l'app (3 signalements de 3 personnes) en attendant la décision.
  hidden: boolean
  content: {
    residenceName: string
    authorUid: string
    authorName: string
    title: string
    text: string
    imageUrl: string
    isVideo: boolean
    postType: string
    postTitle: string
    createdAt: Date | null
  }
  reports: ContentReport[]
  reasons: string[]
  createdAt: Date | null
  lastReportAt: Date | null
  decidedAt: Date | null
  decisionReason: string
}

const toDate = (value: unknown): Date | null =>
  value && typeof (value as Timestamp).toDate === "function" ? (value as Timestamp).toDate() : null

export function subscribeToModerationReports(
  onData: (reports: ModerationReport[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, "moderationReports"),
    (snap) =>
      onData(
        snap.docs.map((d) => {
          const data = d.data()
          const content = (data.content as Record<string, unknown>) ?? {}
          return {
            id: d.id,
            residenceId: (data.residenceId as string) ?? "",
            postId: (data.postId as string) ?? "",
            commentId: (data.commentId as string) ?? "",
            replyId: (data.replyId as string) ?? "",
            targetType: (data.targetType as ModerationTarget) ?? "post",
            status: (data.status as ModerationStatus) ?? "A_TRAITER",
            source: data.source === "bo" ? "bo" : "app",
            hidden: data.hidden === true,
            content: {
              residenceName: (content.residenceName as string) ?? "",
              authorUid: (content.authorUid as string) ?? "",
              authorName: (content.authorName as string) ?? "",
              title: (content.title as string) ?? "",
              text: (content.text as string) ?? "",
              imageUrl: (content.imageUrl as string) ?? "",
              isVideo: content.isVideo === true,
              postType: (content.postType as string) ?? "",
              postTitle: (content.postTitle as string) ?? "",
              createdAt: toDate(content.createdAt),
            },
            reports: ((data.reports as Record<string, unknown>[]) ?? []).map((r) => ({
              uid: (r.uid as string) ?? "",
              name: (r.name as string) ?? "",
              reason: (r.reason as string) ?? "",
              reasonLabel: (r.reasonLabel as string) || REASON_LABELS[r.reason as string] || "",
              subReasonLabel: (r.subReasonLabel as string) ?? "",
              details: (r.details as string) ?? "",
              at: toDate(r.at),
            })),
            reasons: (data.reasons as string[]) ?? [],
            createdAt: toDate(data.createdAt),
            lastReportAt: toDate(data.lastReportAt),
            decidedAt: toDate(data.decidedAt),
            decisionReason: (data.decisionReason as string) ?? "",
          }
        })
      ),
    onError
  )
}

// Contenu visé : un signalement (reportId), ou directement un post, un
// commentaire ou une réponse (page Posts, sans signalement).
export type ModerationTargetRef =
  | { reportId: string }
  | { residenceId: string; postId: string; commentId?: string; replyId?: string }

/** « Supprimer » (archive, suppression, notification à l'auteur avec le motif),
 * « Ignorer » ou « Rétablir » (même action : le masquage éventuel est levé). */
export async function moderateContent(
  target: ModerationTargetRef,
  action: "delete" | "ignore",
  reason: string
): Promise<void> {
  const call = httpsCallable<Record<string, unknown>, { success: boolean }>(functions, "moderate_content")
  await call({ ...target, action, reason })
}
