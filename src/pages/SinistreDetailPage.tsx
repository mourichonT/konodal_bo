import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { ArrowLeft, ChevronLeft, ChevronRight, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SinistreThumbnail } from "@/components/SinistreThumbnail"
import {
  deleteSinistre,
  subscribeToSinistre,
  subscribeToSinistreSignalements,
  updateSinistreStatut,
} from "@/lib/sinistres"
import { useAllSinistres } from "@/hooks/useAllSinistres"
import { SINISTRE_STATUSES, sinistreStatusLabels, type SinistreStatus } from "@/types/sinistre"
import type { Sinistre } from "@/types/sinistre"

export default function SinistreDetailPage() {
  const { residenceId, postId } = useParams<{ residenceId: string; postId: string }>()
  const navigate = useNavigate()
  const [sinistre, setSinistre] = useState<Sinistre | null>(null)
  const [loading, setLoading] = useState(true)
  const [signalements, setSignalements] = useState<Sinistre[]>([])
  const [updating, setUpdating] = useState(false)

  const { sinistres: allSinistres } = useAllSinistres((message) => toast.error(message))

  useEffect(() => {
    if (!residenceId || !postId) return
    setLoading(true)
    return subscribeToSinistre(
      residenceId,
      postId,
      (data) => {
        setSinistre(data)
        setLoading(false)
      },
      (error) => {
        toast.error("Impossible de charger le sinistre : " + error.message)
        setLoading(false)
      }
    )
  }, [residenceId, postId])

  useEffect(() => {
    if (!residenceId || !postId) return
    return subscribeToSinistreSignalements(
      residenceId,
      postId,
      (data) => setSignalements(data),
      (error) => toast.error("Impossible de charger les déclarations associées : " + error.message)
    )
  }, [residenceId, postId])

  if (!residenceId || !postId) return null

  const currentIndex = allSinistres.findIndex(
    (s) => s.residenceId === residenceId && s.id === postId
  )
  const previous = currentIndex > 0 ? allSinistres[currentIndex - 1] : null
  const next =
    currentIndex >= 0 && currentIndex < allSinistres.length - 1 ? allSinistres[currentIndex + 1] : null

  async function handleStatusChange(statut: SinistreStatus) {
    if (!residenceId || !postId) return
    setUpdating(true)
    try {
      await updateSinistreStatut(residenceId, postId, statut)
      toast.success("Statut mis à jour")
    } catch (err) {
      toast.error("Échec de la mise à jour : " + (err as Error).message)
    } finally {
      setUpdating(false)
    }
  }

  async function handleDelete() {
    if (!residenceId || !postId) return
    try {
      await deleteSinistre(residenceId, postId)
      toast.success("Sinistre supprimé")
      navigate("/sinistres/liste")
    } catch (err) {
      toast.error("Échec de la suppression : " + (err as Error).message)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/sinistres/liste"
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Sinistres
        </Link>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!previous}
            render={
              previous ? (
                <Link to={`/sinistres/${previous.residenceId}/${previous.id}`} />
              ) : undefined
            }
          >
            <ChevronLeft />
            Précédent
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!next}
            render={next ? <Link to={`/sinistres/${next.residenceId}/${next.id}`} /> : undefined}
          >
            Suivant
            <ChevronRight />
          </Button>
        </div>
      </div>

      {!loading && !sinistre && (
        <p className="text-muted-foreground">Ce sinistre n'existe pas ou a été supprimé.</p>
      )}

      {sinistre && (
        <>
          <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
            <CardHeader>
              <CardTitle className="text-lg">{sinistre.title || "Sans titre"}</CardTitle>
              <CardDescription>{sinistre.description || "Aucune description."}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <SinistreThumbnail pathImage={sinistre.pathImage} className="h-64 w-full rounded-lg" />

              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <span className="text-muted-foreground">Emplacement : </span>
                  {sinistre.locationElement || "—"}
                  {sinistre.locationFloor ? ` (${sinistre.locationFloor})` : ""}
                </div>
                <div>
                  <span className="text-muted-foreground">Déclaré le : </span>
                  {sinistre.timeStamp ? sinistre.timeStamp.toLocaleDateString("fr-FR") : "—"}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">Statut :</span>
                {SINISTRE_STATUSES.map((statut) => (
                  <Badge
                    key={statut}
                    variant={sinistre.statut === statut ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => !updating && statut !== sinistre.statut && handleStatusChange(statut)}
                  >
                    {sinistreStatusLabels[statut]}
                  </Badge>
                ))}
              </div>

              <div>
                <Button variant="destructive" size="sm" onClick={handleDelete}>
                  <Trash2 />
                  Supprimer le ticket
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
            <CardHeader>
              <CardTitle className="text-lg">Déclarations associées</CardTitle>
              <CardDescription>
                Doublons détectés pour ce même sinistre (autres résidents ayant signalé le même événement).
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {signalements.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune déclaration associée.</p>
              ) : (
                signalements.map((signalement) => (
                  <div key={signalement.id} className="flex items-center gap-3 rounded-lg border p-2 text-sm">
                    <SinistreThumbnail pathImage={signalement.pathImage} className="size-10 shrink-0 rounded-md" />
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">{signalement.title || "Sans titre"}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {signalement.description}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
