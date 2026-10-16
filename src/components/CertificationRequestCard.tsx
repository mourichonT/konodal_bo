import { useEffect, useState } from "react"
import { toast } from "sonner"
import { BadgeCheck, Ban, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DocumentThumbnail } from "@/components/DocumentThumbnail"
import { useAuth } from "@/lib/auth-context"
import { setUserCertified, subscribeToUserDocuments, type UserDocument } from "@/lib/users"
import {
  approveCertification,
  rejectCertification,
  subscribeToCertificationRequest,
  type CertificationRequest,
} from "@/lib/certification"
import { cn } from "@/lib/utils"

const EXTRACTED_LABELS: Record<string, string> = {
  name: "Nom",
  surname: "Prénom",
  birthday: "Date de naissance",
  sex: "Sexe",
  nationality: "Nationalité",
  placeOfBorn: "Lieu de naissance",
}

const ACTION_BUTTON_CLASS = "h-10 rounded-[12px] px-4 text-[13px] font-bold"

// Score SFace (similarité cosinus) : ≥ 0,363 = même personne selon les
// auteurs du modèle. Indicatif : la pièce et le selfie restent à comparer à
// l'œil avant de décider (aucune preuve de vie côté app).
function ScoreBadge({ request }: { request: CertificationRequest }) {
  if (request.faceScore === null) {
    return <span className="text-sm text-[oklch(52%_0.01_150)]">Score indisponible</span>
  }
  const percent = Math.round(Math.max(0, Math.min(1, request.faceScore)) * 100)
  const match = request.faceMatch === true
  return (
    <span
      className={
        match
          ? "rounded-full bg-green-100 px-2.5 py-1 text-sm font-semibold text-green-800"
          : "rounded-full bg-red-100 px-2.5 py-1 text-sm font-semibold text-red-800"
      }
    >
      Ressemblance {percent} % · {match ? "correspondance probable" : "ne correspond pas"}
    </span>
  )
}

// Emplacement d'une photo : vignette DocumentThumbnail (ratio réel,
// ouverture en grand dans un Dialog) ; le selfie, supprimé dès la décision,
// et la pièce, 30 jours après, laissent un emplacement vide explicite.
function Slot({ url, label, emptyText }: { url: string | null; label: string; emptyText: string }) {
  if (url) return <DocumentThumbnail path={url} label={label} />
  return (
    <div className="flex w-full max-w-64 flex-col items-center gap-1.5">
      <div className="flex aspect-[16/10] w-full items-center justify-center rounded-[16px] border-[1.5px] border-dashed border-[oklch(86%_0.01_150)] bg-[oklch(98%_0.003_100)] px-3 text-center text-[12.5px] font-semibold text-[oklch(62%_0.01_150)]">
        {emptyText}
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

// Carte "Demande de certification" (fiche utilisateur, Super Admin
// uniquement : pièce d'identité et selfie ne sont jamais montrés à une
// agence/agent) : pièce, selfie, score, informations lues, décision, et
// certification manuelle hors demande.
export function CertificationRequestCard({ uid, isCertified }: { uid: string; isCertified: boolean }) {
  const { user: authUser } = useAuth()
  const [request, setRequest] = useState<CertificationRequest | null>(null)
  const [saving, setSaving] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState("")

  useEffect(
    () =>
      // Toast plutôt que console seule : une règle firestore absente ou pas
      // encore déployée masquait silencieusement la demande.
      subscribeToCertificationRequest(uid, setRequest, (err) =>
        toast.error("Impossible de charger la demande de certification : " + err.message)
      ),
    [uid]
  )

  // Comptes antérieurs au parcours de certification : pas de demande, mais
  // une pièce déposée à l'inscription (users/{uid}/documents, lisible
  // superAdmin seulement), affichée à défaut de demande.
  const [legacyDocuments, setLegacyDocuments] = useState<UserDocument[]>([])
  useEffect(
    () =>
      subscribeToUserDocuments(uid, setLegacyDocuments, (err) =>
        toast.error("Impossible de charger la pièce d'identité : " + err.message)
      ),
    [uid]
  )

  // Certifié entre-temps à la main : plus de décision à prendre sur cette
  // demande.
  const pending = request?.status === "pending" && !isCertified
  const hasLegacy = !request && legacyDocuments.length > 0

  async function approve() {
    if (!request || !authUser) return
    setSaving(true)
    try {
      await approveCertification(request, authUser.uid)
      toast.success("Identité certifiée")
    } catch (err) {
      toast.error("Échec : " + (err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function reject() {
    if (!request || !authUser || !reason.trim()) return
    setSaving(true)
    try {
      await rejectCertification(request, reason.trim(), authUser.uid)
      toast.success("Demande refusée")
      setRejecting(false)
      setReason("")
    } catch (err) {
      toast.error("Échec : " + (err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  // Certification manuelle (hors demande) ou retrait - masquée tant qu'une
  // demande est en attente : la décision se prend alors ci-dessous, seule à
  // reporter les informations lues sur la pièce.
  async function toggleCertified() {
    setSaving(true)
    try {
      await setUserCertified(uid, !isCertified)
      toast.success(isCertified ? "Certification retirée" : "Identité certifiée")
    } catch (err) {
      toast.error("Échec de la mise à jour : " + (err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const submitted = request?.submittedAt ? ` Envoyée le ${request.submittedAt.toLocaleDateString("fr-FR")}.` : ""
  const description = pending
    ? "Pièce d'identité et selfie envoyés depuis l'application. Comparez-les avec les informations du profil avant de certifier." +
      submitted
    : request?.status === "rejected" && !isCertified
      ? `Demande refusée : ${request.rejectionReason ?? ""}.${submitted}`
      : request
        ? `Demande envoyée depuis l'application.${submitted}`
        : hasLegacy
          ? "Pièce d'identité déposée à l'inscription. Comparez-la avec les informations du profil."
          : isCertified
            ? "Identité certifiée manuellement."
            : "Aucune demande reçue."

  const extracted = request ? Object.entries(request.extracted).filter(([, v]) => v) : []

  return (
    <Card className="[--card-spacing:--spacing(7)]">
      <CardHeader>
        <CardTitle className="text-lg font-extrabold text-[oklch(22%_0.01_150)]">Demande de certification</CardTitle>
        <CardDescription className="max-w-[520px] leading-normal">{description}</CardDescription>
        {!pending && (
          <CardAction>
            {isCertified ? (
              <Button
                variant="outline"
                disabled={saving}
                onClick={toggleCertified}
                className={cn(ACTION_BUTTON_CLASS, "border-red-200 text-red-700 hover:bg-red-50 hover:text-red-700")}
              >
                Retirer la certification
              </Button>
            ) : (
              <Button
                variant="outline"
                disabled={saving}
                onClick={toggleCertified}
                className={cn(
                  ACTION_BUTTON_CLASS,
                  "border-[oklch(85%_0.06_155)] bg-[oklch(96%_0.02_150)] text-[oklch(36%_0.09_155)] hover:bg-[oklch(93%_0.04_150)] hover:text-[oklch(36%_0.09_155)]"
                )}
              >
                <Check />
                Certifier manuellement
              </Button>
            )}
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {isCertified && (
          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-[oklch(95%_0.03_250)] px-3.5 py-[7px] text-[12.5px] font-bold text-[oklch(42%_0.14_250)]">
            <BadgeCheck className="size-4" />
            Identité certifiée
            {request?.status === "approved" ? " · demande depuis l'application" : hasLegacy ? " · pièce déposée à l'inscription" : ""}
          </div>
        )}

        {request && (
          <div className="flex flex-wrap items-center gap-2">
            <ScoreBadge request={request} />
            <span className="text-sm text-[oklch(52%_0.01_150)]">{request.idType}</span>
          </div>
        )}

        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] justify-items-center gap-4">
          {request ? (
            <>
              <Slot
                url={request.idRectoUrl}
                label="Pièce d'identité · Recto"
                emptyText={
                  request.idPurgedAt
                    ? `Supprimée le ${request.idPurgedAt.toLocaleDateString("fr-FR")} (conservation 30 jours)`
                    : "Supprimée (conservation 30 jours)"
                }
              />
              {request.idVersoUrl && (
                <Slot url={request.idVersoUrl} label="Pièce d'identité · Verso" emptyText="Supprimée après décision" />
              )}
              <Slot url={request.selfieUrl} label="Selfie" emptyText="Supprimé après décision" />
            </>
          ) : hasLegacy ? (
            legacyDocuments.flatMap((document) => {
              const prefix = document.type ? `${document.type} · ` : ""
              return [
                <DocumentThumbnail key={`${document.id}-r`} path={document.documentPathRecto} label={`${prefix}Recto`} />,
                ...(document.documentPathVerso
                  ? [<DocumentThumbnail key={`${document.id}-v`} path={document.documentPathVerso} label={`${prefix}Verso`} />]
                  : []),
              ]
            })
          ) : (
            <>
              <Slot url={null} label="Pièce d'identité · Recto" emptyText="Non reçu" />
              <Slot url={null} label="Pièce d'identité · Verso" emptyText="Non reçu" />
              <Slot url={null} label="Selfie" emptyText="Non reçu" />
            </>
          )}
        </div>

        {extracted.length > 0 && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {extracted.map(([key, value]) => (
              <div key={key} className="contents">
                <dt className="text-[oklch(52%_0.01_150)]">{EXTRACTED_LABELS[key] ?? key}</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        )}

        {!request && !hasLegacy && !isCertified && (
          <div className="rounded-[14px] bg-[oklch(97%_0.012_90)] p-[14px_16px] text-[13px] leading-normal text-[oklch(45%_0.04_80)]">
            Aucune demande de certification pour le moment. L'utilisateur peut la lancer depuis son profil dans
            l'application.
          </div>
        )}

        {pending && (
          <p className="text-xs text-[oklch(52%_0.01_150)]">
            Le score est une aide : comparez la pièce et le selfie avant de décider. Le selfie est supprimé dès la
            décision. Certifier complète le compte avec les informations lues ci-dessus, sans écraser celles déjà
            renseignées.
          </p>
        )}
        {pending && !rejecting && (
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={saving}
              onClick={approve}
              className={cn(ACTION_BUTTON_CLASS, "bg-blue-600 text-white hover:bg-blue-700")}
            >
              <BadgeCheck />
              Certifier l'identité
            </Button>
            <Button
              variant="outline"
              disabled={saving}
              className={cn(ACTION_BUTTON_CLASS, "border-red-200 text-red-700 hover:bg-red-50 hover:text-red-700")}
              onClick={() => setRejecting(true)}
            >
              <Ban />
              Refuser
            </Button>
          </div>
        )}
        {pending && rejecting && (
          <div className="flex flex-col gap-2">
            <Input
              autoFocus
              placeholder="Motif affiché au résident (ex. photo floue, visage différent…)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-red-200 text-red-700 hover:bg-red-50"
                disabled={saving || !reason.trim()}
                onClick={reject}
              >
                Confirmer le refus
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>
                Annuler
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
