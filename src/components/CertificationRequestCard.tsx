import { useEffect, useState } from "react"
import { toast } from "sonner"
import { BadgeCheck, Ban, ShieldQuestion } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/lib/auth-context"
import {
  approveCertification,
  rejectCertification,
  subscribeToCertificationRequest,
  type CertificationRequest,
} from "@/lib/certification"

const EXTRACTED_LABELS: Record<string, string> = {
  name: "Nom",
  surname: "Prénom",
  birthday: "Date de naissance",
  sex: "Sexe",
  nationality: "Nationalité",
  placeOfBorn: "Lieu de naissance",
}

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

function Photo({ url, label }: { url: string | null; label: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-[oklch(52%_0.01_150)]">
        {label}
      </span>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer">
          <img src={url} alt={label} className="h-44 w-full rounded-lg border object-cover" />
        </a>
      ) : (
        <div className="flex h-44 items-center justify-center rounded-lg border border-dashed text-sm text-[oklch(52%_0.01_150)]">
          Supprimé après décision
        </div>
      )}
    </div>
  )
}

// Carte "Demande de certification" (fiche résident, Super Admin) : pièce,
// selfie, score de ressemblance, informations lues, et décision.
export function CertificationRequestCard({ uid, isCertified }: { uid: string; isCertified: boolean }) {
  const { user: authUser } = useAuth()
  const [request, setRequest] = useState<CertificationRequest | null>(null)
  const [saving, setSaving] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState("")

  useEffect(
    () =>
      subscribeToCertificationRequest(uid, setRequest, (err) =>
        console.error("Demande de certification illisible", err)
      ),
    [uid]
  )

  if (!request) return null
  // Certifié entre-temps à la main (bouton de la carte Compte) : plus de
  // décision à prendre sur cette demande.
  const pending = request.status === "pending" && !isCertified

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

  const extracted = Object.entries(request.extracted).filter(([, v]) => v)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldQuestion className="size-5" />
          Demande de certification
        </CardTitle>
        <CardDescription>
          {pending
            ? "En attente de décision"
            : request.status === "approved" || isCertified
              ? "Certifiée"
              : `Refusée : ${request.rejectionReason ?? ""}`}
          {request.submittedAt && ` · envoyée le ${request.submittedAt.toLocaleDateString("fr-FR")}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <ScoreBadge request={request} />
          <span className="text-sm text-[oklch(52%_0.01_150)]">{request.idType}</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Photo url={request.idRectoUrl} label="Recto" />
          {request.idVersoUrl ? <Photo url={request.idVersoUrl} label="Verso" /> : <div />}
          <Photo url={request.selfieUrl} label="Selfie" />
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
        {pending && (
          <p className="text-xs text-[oklch(52%_0.01_150)]">
            Le score est une aide : comparez la pièce et le selfie avant de décider. Le selfie est supprimé
            dès la décision.
          </p>
        )}
        {pending && !rejecting && (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={saving}
              onClick={approve}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              <BadgeCheck />
              Certifier l'identité
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={saving}
              className="border-red-200 text-red-700 hover:bg-red-50"
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
