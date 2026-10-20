import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore"
import { db } from "@/firebase"
import { emailButtonHtml, emailContactHtml, konodalEmailHtml } from "@/lib/emailTemplate"
import type { Address } from "@/types/residence"

// Envoi de l'ordre d'intervention au prestataire : lien de partage
// (shareTokens -> SharedInterventionPage) + mail via residences/{id}/mail
// (send_email_on_create côté functions_python). Utilisé par la fiche
// intervention (EvenementDetailPage) et par Nodo (NodoActionCard).

// Le lien reste valable jusqu'à 48h après la date d'intervention (le temps
// pour le prestataire de consulter/déclarer un compte-rendu autour de sa
// venue), pas une durée fixe depuis l'envoi - fallback 30j si jamais
// eventDate est absent (ne devrait pas arriver, EventInput l'exige).
const SHARE_LINK_GRACE_PERIOD_MS = 48 * 60 * 60 * 1000
const SHARE_LINK_FALLBACK_VALIDITY_MS = 30 * 24 * 60 * 60 * 1000

export type InterventionEmailEvent = {
  title: string
  description: string
  eventDate: Date | null
  prestaName: string
  pathImage: string
}

// Cherche l'email du prestataire choisi parmi les contacts de la résidence
// en matchant sur le nom - la gérance n'est pas couverte (pas d'email
// d'agent résolu ici).
export async function findPrestataireMail(
  contactRefs: Record<string, boolean> | undefined,
  prestaName: string
): Promise<string | undefined> {
  if (!contactRefs || !prestaName) return undefined
  for (const contactId of Object.keys(contactRefs)) {
    const snap = await getDoc(doc(db, "contacts", contactId))
    if (snap.exists() && (snap.data().name as string) === prestaName) {
      return (snap.data().mail as string) || undefined
    }
  }
  return undefined
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)
}

// Gabarit commun des mails (lib/emailTemplate.ts). `message` : mot
// personnalisé au prestataire (rédigé par Nodo), affiché en tête.
function buildInterventionEmailHtml({
  residenceName,
  address,
  event,
  link,
  message,
}: {
  residenceName: string
  address: Address
  event: InterventionEmailEvent
  link: string
  message?: string
}): string {
  const dateLabel = event.eventDate
    ? `${event.eventDate.toLocaleDateString("fr-FR")} à ${event.eventDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
    : "—"
  const messageHtml = message?.trim()
    ? message
        .trim()
        .split(/\n\s*\n/)
        .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
        .join("")
    : ""
  return konodalEmailHtml({
    title: "Intervention programmée",
    bodyHtml: `
            ${messageHtml ? `<div style="margin-bottom: 24px;">${messageHtml}</div>` : ""}
            <div style="text-align: center;">
                <p>Une intervention vous a été assignée dans la résidence :</p>
                <h2>${residenceName}</h2>
                <p>${address.street}<br>${address.zipCode} ${address.city}</p>
            </div>

            <p style="font-size: 16px; text-align: center; margin-top: 20px;"><strong>Intitulé : ${event.title || "Sans titre"}</strong></p>

            ${
              event.pathImage
                ? `<div style="text-align: center; margin: 20px 0;">
                <img src="${event.pathImage}" alt="Illustration Intervention" width="400" style="max-width: 100%; border-radius: 8px;" />
            </div>`
                : ""
            }
            <p><strong>Prestataire :</strong> ${event.prestaName || "—"}</p>
            <p><strong>Date d'intervention :</strong> ${dateLabel}</p>
            <p><strong>Description :</strong><br>
            ${event.description || "Aucune description."}
            </p>

        <p style="margin: 30px 0 5px; text-align: center;">Pour plus d'informations</p>
        ${emailButtonHtml(link, "Consulter l'intervention")}
        ${emailContactHtml}`,
  })
}

export async function sendInterventionEmail({
  residenceId,
  postId,
  residenceName,
  address,
  event,
  prestataireMail,
  message,
}: {
  residenceId: string
  postId: string
  residenceName: string
  address: Address
  event: InterventionEmailEvent
  prestataireMail: string
  message?: string
}) {
  const token = crypto.randomUUID()
  const expiresAt = event.eventDate
    ? new Date(event.eventDate.getTime() + SHARE_LINK_GRACE_PERIOD_MS)
    : new Date(Date.now() + SHARE_LINK_FALLBACK_VALIDITY_MS)
  await setDoc(doc(db, "shareTokens", token), {
    residenceId,
    postId,
    createdAt: serverTimestamp(),
    expiresAt,
  })

  // BASE_URL porte déjà le préfixe de déploiement (ex: /portail/ sous
  // konodal.com, / en local) et se termine par un slash - cf.
  // base dans vite.config.ts.
  const link = `${window.location.origin}${import.meta.env.BASE_URL}partage/${token}`
  await addDoc(collection(db, "residences", residenceId, "mail"), {
    to: [prestataireMail],
    message: {
      subject: `Intervention : ${event.title || "Sans titre"}`,
      html: buildInterventionEmailHtml({ residenceName, address, event, link, message }),
    },
  })
}
