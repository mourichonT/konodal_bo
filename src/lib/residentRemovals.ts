import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  type Timestamp,
  type Unsubscribe,
} from "firebase/firestore"
import { httpsCallable } from "firebase/functions"
import { db, functions } from "@/firebase"

// Demandes de retrait d'un résident (residentRemovalRequests), envoyées par
// un membre du CS depuis l'annuaire des voisins de l'app. Décision par un
// superAdmin : decide_resident_removal (blocage de l'accès à la résidence,
// rien n'est supprimé) ; unblock_resident lève le blocage.

export type RemovalRequestStatus = "pending" | "accepted" | "rejected"

export type RemovalRequest = {
  id: string
  residenceId: string
  targetUid: string
  requestedBy: string
  reason: string
  description: string
  attachments: string[]
  status: RemovalRequestStatus
  createdAt: Timestamp | null
  decidedAt: Timestamp | null
  rejectionReason: string | null
}

// Mêmes clés que REMOVAL_REASON_LABELS (functions_python/main.py).
export const REMOVAL_REASON_LABEL: Record<string, string> = {
  charter: "Non-respect de la charte",
  behavior: "Comportement irrespectueux",
  spam: "Spam / publicité",
  not_resident: "N'habite pas la résidence",
  other: "Autre",
}

export const REMOVAL_STATUS_LABEL: Record<RemovalRequestStatus, string> = {
  pending: "En attente",
  accepted: "Accès bloqué",
  rejected: "Refusée",
}

export const REMOVAL_STATUS_BADGE_CLASS: Record<RemovalRequestStatus, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  accepted: "border-rose-200 bg-rose-50 text-rose-700",
  rejected: "border-slate-200 bg-slate-50 text-slate-600",
}

export function subscribeToRemovalRequests(
  onData: (requests: RemovalRequest[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "residentRemovalRequests"), orderBy("createdAt", "desc")),
    (snapshot) =>
      onData(
        snapshot.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            residenceId: (data.residenceId as string) ?? "",
            targetUid: (data.targetUid as string) ?? "",
            requestedBy: (data.requestedBy as string) ?? "",
            reason: (data.reason as string) ?? "other",
            description: (data.description as string) ?? "",
            attachments: (data.attachments as string[] | undefined) ?? [],
            status: (data.status as RemovalRequestStatus) ?? "pending",
            createdAt: (data.createdAt as Timestamp) ?? null,
            decidedAt: (data.decidedAt as Timestamp) ?? null,
            rejectionReason: (data.rejectionReason as string) ?? null,
          }
        })
      ),
    onError
  )
}

export async function residenceNameOf(residenceId: string): Promise<string> {
  const snapshot = await getDoc(doc(db, "residences", residenceId))
  return (snapshot.data()?.name as string) ?? residenceId
}

export async function decideRemovalRequest(
  requestId: string,
  decision: "accept" | "reject",
  rejectionReason?: string
) {
  const call = httpsCallable<
    { requestId: string; decision: string; rejectionReason?: string },
    { status: string }
  >(functions, "decide_resident_removal")
  await call({ requestId, decision, rejectionReason })
}

export async function unblockResident(residenceId: string, uid: string) {
  const call = httpsCallable<{ residenceId: string; uid: string }, { ok: boolean }>(
    functions,
    "unblock_resident"
  )
  await call({ residenceId, uid })
}
