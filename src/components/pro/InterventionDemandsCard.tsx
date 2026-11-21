import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { Eye } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  cancelProMission,
  missionStatusLine,
  PRO_MISSION_LABELS,
  subscribeToResidenceMissions,
  type ProMission,
} from "@/lib/proAccounts"

// Refusées ou restées sans réponse : affichées encore 14 jours, le temps de
// mandater un autre prestataire.
const RECENT_MS = 14 * 24 * 60 * 60 * 1000

// Demandes d'intervention à suivre (page Interventions) : en attente de
// réponse, refusées ou sans réponse. Une demande acceptée devient une
// intervention de la liste et du calendrier, elle n'apparaît plus ici.
export function InterventionDemandsCard({ residences }: { residences: { id: string; name: string }[] }) {
  const [byResidence, setByResidence] = useState<Record<string, ProMission[]>>({})
  const residenceIds = residences.map((r) => r.id).join(",")

  useEffect(() => {
    const ids = residenceIds.split(",").filter(Boolean)
    const unsubscribes = ids.map((id) =>
      subscribeToResidenceMissions(
        id,
        (missions) => setByResidence((current) => ({ ...current, [id]: missions })),
        (error) => toast.error("Impossible de charger les demandes d'intervention : " + error.message)
      )
    )
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe())
  }, [residenceIds])

  const names = new Map(residences.map((r) => [r.id, r.name]))
  const since = Date.now() - RECENT_MS
  const demands = Object.values(byResidence)
    .flat()
    .filter(
      (m) =>
        m.statut === "proposee" ||
        ((m.statut === "refusee" || m.statut === "sans_reponse") && (m.updatedAt?.getTime() ?? 0) > since)
    )
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))

  async function handleCancel(m: ProMission) {
    const reason = window.prompt(
      `Annuler la demande faite à ${m.contactName} ? Motif (envoyé au prestataire, facultatif) :`
    )
    if (reason === null) return
    try {
      await cancelProMission(m.id, reason)
      toast.success("Demande annulée")
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  if (demands.length === 0) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Demandes d'intervention en cours</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {demands.map((m) => (
          <div
            key={m.id}
            className="flex flex-wrap items-start justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="font-medium">
                {m.title || "Sans titre"}
                <span className="font-normal text-muted-foreground"> · {names.get(m.residenceId) ?? "—"}</span>
              </span>
              <span>
                {m.contactName}
                <span className="text-xs text-muted-foreground">
                  {" "}
                  · {m.canal === "lien" ? "par mail" : "Konodal Pro"}
                </span>
              </span>
              {missionStatusLine(m) && <span className="text-muted-foreground">{missionStatusLine(m)}</span>}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Badge
                variant="outline"
                className={
                  m.statut === "proposee"
                    ? "border-transparent bg-sky-100 text-sky-800"
                    : "border-transparent bg-amber-100 text-amber-800"
                }
              >
                {PRO_MISSION_LABELS[m.statut] ?? m.statut}
              </Badge>
              {m.sinistreId && (
                <Button size="sm" variant="outline" render={<Link to={`/sinistres/${m.residenceId}/${m.sinistreId}`} />}>
                  <Eye />
                  Sinistre
                </Button>
              )}
              {m.statut === "proposee" && (
                <Button size="sm" variant="outline" onClick={() => handleCancel(m)}>
                  Annuler
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
