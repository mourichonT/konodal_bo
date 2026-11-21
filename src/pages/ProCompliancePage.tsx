import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { CheckCircle2, ExternalLink, RefreshCw, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/PageHeader"
import {
  listProDocumentsToReview,
  openProDocument,
  reviewProDocument,
  type ProDocumentToReview,
} from "@/lib/proAccounts"

// Konodal Pro : relecture par Konodal (superAdmin) des pièces de conformité
// déposées par les entreprises (URSSAF, Kbis, assurances…). Rien n'est
// valide sans cette relecture (pro_review_document) : la lecture
// automatique propose une date de fin et signale les écarts (SIREN, type de
// pièce, mention « SPÉCIMEN »…).
export default function ProCompliancePage() {
  const [documents, setDocuments] = useState<ProDocumentToReview[] | null>(null)

  const load = useCallback(() => {
    setDocuments(null)
    listProDocumentsToReview()
      .then(setDocuments)
      .catch((err) => {
        toast.error("Chargement impossible : " + (err as Error).message)
        setDocuments([])
      })
  }, [])

  useEffect(load, [load])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Conformité Konodal Pro"
        actions={
          <Button variant="outline" onClick={load}>
            <RefreshCw />
            Actualiser
          </Button>
        }
      />
      {documents === null && <p className="text-muted-foreground">Chargement…</p>}
      {documents?.length === 0 && <p className="text-muted-foreground">Aucune pièce à vérifier.</p>}
      {documents?.map((d) => (
        <ReviewCard
          key={`${d.entrepriseId}/${d.documentId}`}
          document={d}
          onDone={() => setDocuments((list) => list?.filter((x) => x !== d) ?? null)}
        />
      ))}
    </div>
  )
}

function ReviewCard({ document: d, onDone }: { document: ProDocumentToReview; onDone: () => void }) {
  const [validUntil, setValidUntil] = useState(d.validUntil?.slice(0, 10) ?? "")
  const [busy, setBusy] = useState(false)
  const facts = (d.extraction ?? {}) as Record<string, unknown>
  const checks = d.checks

  async function decide(decision: "valide" | "refuse") {
    let reason: string | undefined
    if (decision === "refuse") {
      reason = window.prompt("Motif du refus (envoyé au gérant de l'entreprise) :") ?? undefined
      if (!reason) return
    }
    setBusy(true)
    try {
      const result = await reviewProDocument({
        entrepriseId: d.entrepriseId,
        documentId: d.documentId,
        decision,
        reason,
        validUntil: decision === "valide" && validUntil ? validUntil : undefined,
      })
      toast.success(`Pièce ${decision === "valide" ? "validée" : "refusée"} (entreprise : ${result.conformite})`)
      onDone()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const warnings = [
    checks?.sirenMatch === false && "SIREN lu différent de celui de l'entreprise",
    checks?.typeMatch === false && "Le document ne ressemble pas au type déclaré",
    checks?.datesOk === false && "Dates de validité incohérentes",
    !!checks?.suspectMarks?.length && `Mention suspecte : ${checks.suspectMarks.join(", ")}`,
    d.extractionError && `Lecture automatique impossible : ${d.extractionError}`,
  ].filter(Boolean) as string[]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          {d.label}
          <span className="font-normal text-muted-foreground">· {d.raisonSociale} (SIREN {d.siren})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <div className="grid gap-1 sm:grid-cols-2">
          <span>Fichier : {d.fileName}</span>
          <span>Déposé le {d.uploadedAt ? new Date(d.uploadedAt).toLocaleDateString("fr-FR") : "?"}</span>
          {!!facts.documentType && <span>Lu : {String(facts.documentType)}</span>}
          {!!facts.holderName && <span>Titulaire : {String(facts.holderName)}</span>}
          {!!facts.insurer && <span>Assureur : {String(facts.insurer)}</span>}
          {!!facts.policyNumber && <span>Police : {String(facts.policyNumber)}</span>}
          {!!facts.securityCode && <span>Code de sécurité URSSAF : {String(facts.securityCode)}</span>}
          {Array.isArray(facts.activities) && facts.activities.length > 0 && (
            <span className="sm:col-span-2">Activités : {(facts.activities as string[]).join(", ")}</span>
          )}
        </div>
        {warnings.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {warnings.map((w) => (
              <Badge key={w} variant="outline" className="border-transparent bg-amber-100 text-amber-800">
                {w}
              </Badge>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              Fin de validité{d.validUntilSource === "duree" ? " (calculée depuis la date du document)" : ""}
            </span>
            <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="w-44" />
          </label>
          <Button variant="outline" onClick={() => openProDocument(d.entrepriseId, d.documentId)}>
            <ExternalLink />
            Ouvrir la pièce
          </Button>
          <Button disabled={busy || !validUntil} onClick={() => decide("valide")}>
            <CheckCircle2 />
            Valider
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => decide("refuse")}>
            <XCircle />
            Refuser
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
