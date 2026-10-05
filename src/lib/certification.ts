import { deleteField, doc, getDoc, onSnapshot, serverTimestamp, writeBatch } from "firebase/firestore"
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

// Champs lus sur la pièce (clés de `extracted`, cf. certification_flow_page
// côté app) -> champs du groupe 'user' du compte. name = Nom de famille,
// surname = Prénom, comme à l'inscription (step0_name/step0_surname).
const EXTRACTED_TO_USER_FIELD: Record<string, string> = {
  name: "user.name",
  surname: "user.surname",
  sex: "user.sex",
  nationality: "user.nationality",
  placeOfBorn: "user.placeOfborn",
}

// "jj/mm/aaaa" -> Date (minuit UTC, même convention que _parse_birthday
// côté serveur) ; null si illisible.
function parseBirthday(value: string | undefined): Date | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((value ?? "").trim())
  if (!match) return null
  const [, day, month, year] = match
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  return date.getUTCDate() === Number(day) ? date : null
}

// Informations lues sur la pièce reportées sur le compte au moment de
// certifier, uniquement là où le compte n'a rien : jamais d'écrasement
// d'une valeur déjà saisie (même règle que submit_certification_request à
// la soumission, qui a pu tourner avant que le profil ne soit complet).
// Date de naissance considérée absente si nulle ou au 01/01/1970 (valeur
// par défaut côté app).
function missingIdentityFrom(
  extracted: Record<string, string>,
  userGroup: Record<string, unknown>
): Record<string, unknown> {
  const updates: Record<string, unknown> = {}
  for (const [key, field] of Object.entries(EXTRACTED_TO_USER_FIELD)) {
    const value = extracted[key]?.trim()
    const current = userGroup[field.slice("user.".length)]
    if (value && !(typeof current === "string" && current.trim())) updates[field] = value
  }
  const birthday = parseBirthday(extracted.birthday)
  const currentBirthday = userGroup.birthday as { toDate?: () => Date } | null | undefined
  const hasBirthday =
    typeof currentBirthday?.toDate === "function" && currentBirthday.toDate().getUTCFullYear() > 1970
  if (birthday && !hasBirthday) updates["user.birthday"] = birthday
  return updates
}

export async function approveCertification(request: CertificationRequest, deciderUid: string) {
  const userSnap = await getDoc(doc(db, "users", request.uid))
  const userGroup = (userSnap.data()?.user as Record<string, unknown> | undefined) ?? {}
  const missing = missingIdentityFrom(request.extracted, userGroup)
  const batch = writeBatch(db)
  // Sous-fiche identité (audit sécurité point 9, étape 3) : mêmes valeurs,
  // écrites aussi dans users/{uid}/private/identity pendant la transition.
  const identity: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(missing)) {
    const field = key.slice("user.".length)
    if (["birthday", "sex", "nationality", "placeOfborn"].includes(field)) identity[field] = value
  }
  if (Object.keys(identity).length > 0) {
    batch.set(doc(db, "users", request.uid, "private", "identity"), identity, { merge: true })
  }
  batch.update(doc(db, "users", request.uid), {
    ...missing,
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
