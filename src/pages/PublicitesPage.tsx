import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { Eye, MousePointerClick, Plus, Settings, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AdCampaignFormDialog } from "@/components/AdCampaignFormDialog"
import { AdCampaignConfigDialog } from "@/components/AdCampaignConfigDialog"
import { subscribeToResidences } from "@/lib/residences"
import { departmentCodeFromZip } from "@/lib/departments"
import {
  campaignStatus,
  CAMPAIGN_STATUS_BADGE_CLASS,
  createAdCampaign,
  deleteAdCampaign,
  subscribeToAdCampaigns,
} from "@/lib/adCampaigns"
import { subscribeToAdCampaignConfig, updateAdCampaignConfig } from "@/lib/adCampaignConfig"
import type { AdCampaign, AdCampaignConfig, AdCampaignInput } from "@/types/adCampaign"
import type { Residence } from "@/types/residence"

export default function PublicitesPage() {
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([])
  const [residences, setResidences] = useState<Residence[]>([])
  const [config, setConfig] = useState<AdCampaignConfig>({ displayFrequency: 0 })
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<AdCampaign | null>(null)
  const [configuring, setConfiguring] = useState(false)

  useEffect(() => {
    setLoading(true)
    return subscribeToAdCampaigns(
      (data) => {
        setCampaigns(data)
        setLoading(false)
      },
      (error) => {
        toast.error("Impossible de charger les campagnes : " + error.message)
        setLoading(false)
      }
    )
  }, [])

  useEffect(() => {
    return subscribeToResidences(setResidences, () => {})
  }, [])

  useEffect(() => {
    return subscribeToAdCampaignConfig(setConfig, (error) => {
      toast.error("Impossible de charger la configuration : " + error.message)
    })
  }, [])

  const today = new Date().toISOString().slice(0, 10)

  const residenceById = new Map(residences.map((r) => [r.id, r]))

  // Une résidence par badge devient illisible dès qu'une campagne cible
  // beaucoup de résidences (ex: "France entière") - on résume en un seul
  // badge : "France" si toutes les résidences connues sont ciblées, sinon
  // le nombre de départements distincts couverts.
  function targetSummary(campaign: AdCampaign): string {
    if (residences.length > 0 && campaign.targetResidenceIds.length === residences.length) {
      return "France"
    }
    const codes = new Set(
      campaign.targetResidenceIds.map((id) => {
        const residence = residenceById.get(id)
        return residence ? departmentCodeFromZip(residence.address.zipCode) : "?"
      })
    )
    return `${codes.size} région${codes.size > 1 ? "s" : ""}`
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      await deleteAdCampaign(deleting.id)
      toast.success("Campagne supprimée")
      setDeleting(null)
    } catch (err) {
      toast.error("Échec de la suppression : " + (err as Error).message)
    }
  }

  async function handleCreate(input: AdCampaignInput) {
    await createAdCampaign(input)
    toast.success("Campagne créée")
    setCreating(false)
  }

  async function handleConfigSubmit(displayFrequency: number) {
    await updateAdCampaignConfig(displayFrequency)
    toast.success("Configuration mise à jour")
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Publicités</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setConfiguring(true)}>
            <Settings />
            Réglage global
          </Button>
          <Button onClick={() => setCreating(true)}>
            <Plus />
            Ajouter une campagne
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <h2 className="text-lg">Campagnes publicitaires</h2>
        <p className="text-sm text-muted-foreground">
          Cartes pub insérées dans le fil de l'app, ciblées par résidence.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)] ring-1 ring-foreground/10">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead>Image</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Résidences ciblées</TableHead>
              <TableHead>Période</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Impressions</TableHead>
              <TableHead>Clics</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="bg-white">
            {campaigns.map((campaign) => (
              <TableRow key={campaign.id}>
                <TableCell>
                  <img
                    src={campaign.imageUrl}
                    alt=""
                    className="size-10 rounded-md object-cover"
                  />
                </TableCell>
                <TableCell className="font-medium">{campaign.name || "Sans nom"}</TableCell>
                <TableCell>
                  {campaign.targetResidenceIds.length === 0 ? (
                    <span className="text-sm text-muted-foreground">—</span>
                  ) : (
                    <Badge variant="secondary">{targetSummary(campaign)}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {campaign.startDate && campaign.endDate
                    ? `${new Date(`${campaign.startDate}T00:00:00`).toLocaleDateString("fr-FR")} → ${new Date(`${campaign.endDate}T00:00:00`).toLocaleDateString("fr-FR")}`
                    : "—"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={CAMPAIGN_STATUS_BADGE_CLASS[campaignStatus(campaign, today)]}
                  >
                    {campaignStatus(campaign, today)}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{campaign.impressionCount}</TableCell>
                <TableCell className="text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <MousePointerClick className="size-3.5" />
                    {campaign.clickCount}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" render={<Link to={`/publicites/${campaign.id}`} />}>
                      <Eye />
                      Gérer
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setDeleting(campaign)}>
                      <Trash2 />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!loading && campaigns.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  Aucune campagne pour l'instant.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AdCampaignConfigDialog
        open={configuring}
        onOpenChange={setConfiguring}
        config={config}
        onSubmit={handleConfigSubmit}
      />

      <AdCampaignFormDialog
        open={creating}
        onOpenChange={setCreating}
        title="Ajouter une campagne"
        residences={residences}
        onSubmit={handleCreate}
      />

      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="pb-4">
            <DialogTitle>Supprimer cette campagne ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Cette campagne publicitaire sera définitivement supprimée et n'apparaîtra plus dans l'app.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
