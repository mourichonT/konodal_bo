import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { Eye, Megaphone, MousePointerClick, Plus, Settings, Trash2 } from "lucide-react"
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
import { PRIMARY_CTA_CLASS } from "@/lib/utils"
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

  // "Impressions"/"Clics" : cumul depuis toujours (impressionCount/clickCount
  // sur AdCampaign n'est pas horodaté jour par jour) - pas de fenêtre "30j"
  // affichable honnêtement avec les données actuelles, contrairement à la
  // maquette qui suppose un historique par jour.
  const activeCampaignsCount = campaigns.filter((c) => campaignStatus(c, today) === "Active").length
  const totalImpressions = campaigns.reduce((sum, c) => sum + c.impressionCount, 0)
  const totalClicks = campaigns.reduce((sum, c) => sum + c.clickCount, 0)
  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(1) + " %" : "—"

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[26px] font-extrabold tracking-tight text-[oklch(22%_0.01_150)]">Publicités</h1>
        <div className="flex gap-2.5">
          <Button variant="outline" onClick={() => setConfiguring(true)}>
            <Settings />
            Réglage global
          </Button>
          <Button onClick={() => setCreating(true)} className={PRIMARY_CTA_CLASS}>
            <Plus />
            Ajouter une campagne
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-[18px] border border-[oklch(93%_0.005_100)] bg-white p-[18px_20px]">
          <div className="mb-1.5 text-xs font-semibold text-muted-foreground">Campagnes actives</div>
          <div className="text-[23px] font-extrabold text-[oklch(22%_0.01_150)]">{activeCampaignsCount}</div>
        </div>
        <div className="rounded-[18px] border border-[oklch(93%_0.005_100)] bg-white p-[18px_20px]">
          <div className="mb-1.5 text-xs font-semibold text-muted-foreground">Impressions</div>
          <div className="text-[23px] font-extrabold text-[oklch(22%_0.01_150)]">{totalImpressions}</div>
        </div>
        <div className="rounded-[18px] border border-[oklch(93%_0.005_100)] bg-white p-[18px_20px]">
          <div className="mb-1.5 text-xs font-semibold text-muted-foreground">Clics</div>
          <div className="text-[23px] font-extrabold text-[oklch(22%_0.01_150)]">{totalClicks}</div>
        </div>
        <div className="rounded-[18px] border border-[oklch(93%_0.005_100)] bg-white p-[18px_20px]">
          <div className="mb-1.5 text-xs font-semibold text-muted-foreground">CTR moyen</div>
          <div className="text-[23px] font-extrabold text-[oklch(22%_0.01_150)]">{ctr}</div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[24px] border border-[oklch(93%_0.005_100)] bg-white shadow-[0_1px_2px_oklch(20%_0_0/0.03),0_14px_34px_-22px_oklch(20%_0_0/0.12)]">
        <div className="px-7 pt-[26px] pb-5">
          <h2 className="mb-1 text-[17px] font-bold text-[oklch(22%_0.01_150)]">Campagnes publicitaires</h2>
          <p className="text-[13.5px] text-muted-foreground">
            Cartes pub insérées dans le fil de l'app, ciblées par résidence.
          </p>
        </div>

        {!loading && campaigns.length === 0 ? (
          <div className="flex flex-col items-center gap-4 border-t border-[oklch(95%_0.003_100)] px-10 py-16">
            <div className="flex size-16 items-center justify-center rounded-[18px] bg-[oklch(93%_0.05_150)]">
              <Megaphone className="size-7 text-[oklch(38%_0.09_155)]" />
            </div>
            <div className="text-center">
              <div className="mb-1.5 text-base font-bold text-[oklch(24%_0.01_150)]">
                Aucune campagne pour l'instant
              </div>
              <p className="max-w-[380px] text-[13.5px] leading-relaxed text-muted-foreground">
                Créez une carte pub pour la mettre en avant dans le fil de l'app, ciblée sur une ou plusieurs
                résidences.
              </p>
            </div>
            <Button onClick={() => setCreating(true)} className={PRIMARY_CTA_CLASS}>
              <Plus />
              Créer votre première campagne
            </Button>
          </div>
        ) : (
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
          </TableBody>
        </Table>
        )}
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
