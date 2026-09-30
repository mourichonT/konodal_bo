import { deleteField, doc, onSnapshot, serverTimestamp, writeBatch } from "firebase/firestore"
import { deleteObject, ref } from "firebase/storage"
import { db, storage } from "@/firebase"

// certificationRequests/{uid} : demande de certification d'identité envoyée
// depuis l'app résident (profil "Certifiez votre compte") - créée
// uniquement par la Cloud Function submit_certification_request
// (functions_python/main.py), qui compare le visage de la pièce et le selfie
// (OpenCV, score indicatif). La décision reste ici, manuelle, réservée au
// Super Admin (firestore.rules : update isSuperAdmin).
export type CertificationRequest = {
  uid: string
  status: "pending" | "approved" | "rejected"
  idType: string
  idRectoUrl: string
  idVersoUrl: string | null
  selfieUrl: string | null
  selfiePath: string | null
  faceScore: number | null
  faceMatch: boolean | null
  extracted: Record<string, string>
  submittedAt: Date | null
  decidedAt: Date | null
  rejectionReason: string | null
}

function toDate(value: unknown): Date | null {
  return value && typeof (value as { toDate?: unknown }).toDate === "function"
    ? (value as { toDate: () => Date }).toDate()
    : null
}

export function subscribeToCertificationRequest(
  uid: string,
  onData: (request: CertificationRequest | null) => void,
  onError: (error: Error) => void
) {
  return onSnapshot(
    doc(db, "certificationRequests", uid),
    (snap) => {
      if (!snap.exists()) {
        onData(null)
        return
      }
      const data = snap.data()
      onData({
        uid,
        status: data.status ?? "pending",
        idType: data.idType ?? "",
        idRectoUrl: data.idRectoUrl ?? "",
        idVersoUrl: data.idVersoUrl ?? null,
        selfieUrl: data.selfieUrl ?? null,
        selfiePath: data.selfiePath ?? null,
        faceScore: typeof data.faceScore === "number" ? data.faceScore : null,
        faceMatch: typeof data.faceMatch === "boolean" ? data.faceMatch : null,
        extracted: data.extracted ?? {},
        submittedAt: toDate(data.submittedAt),
        decidedAt: toDate(data.decidedAt),
        rejectionReason: data.rejectionReason ?? null,
      })
    },
    onError
  )
}

// Selfie supprimé dès la décision (donnée biométrique, cf. consentement
// affiché dans l'app) - la pièce d'identité, elle, est conservée comme les
// autres pièces du dossier.
async function deleteSelfie(request: CertificationRequest) {
  if (!request.selfiePath) return
  try {
    await deleteObject(ref(storage, request.selfiePath))
  } catch (err) {
    console.warn("Suppression du selfie impossible", err)
  }
}

export async function approveCertification(request: CertificationRequest, deciderUid: string) {
  const batch = writeBatch(db)
  batch.update(doc(db, "users", request.uid), {
    isCertified: true,
    certificationStatus: deleteField(),
    certificationRejectionReason: deleteField(),
  })
  batch.update(doc(db, "certificationRequests", request.uid), {
    status: "approved",
    decidedAt: serverTimestamp(),
    decidedBy: deciderUid,
    selfieUrl: null,
    selfiePath: null,
  })
  await batch.commit()
  await deleteSelfie(request)
}

export async function rejectCertification(
  request: CertificationRequest,
  reason: string,
  deciderUid: string
) {
  const batch = writeBatch(db)
  batch.update(doc(db, "users", request.uid), {
    isCertified: false,
    certificationStatus: "rejected",
    certificationRejectionReason: reason,
  })
  batch.update(doc(db, "certificationRequests", request.uid), {
    status: "rejected",
    rejectionReason: reason,
    decidedAt: serverTimestamp(),
    decidedBy: deciderUid,
    selfieUrl: null,
    selfiePath: null,
  })
  await batch.commit()
  await deleteSelfie(request)
}
