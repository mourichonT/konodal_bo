import { useEffect, useRef, useState, type FormEvent } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { ArrowLeft, Eye, FileDown, ImagePlus, MousePointerClick, Save, Trash2 } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DateInput } from "@/components/DateInput"
import { subscribeToResidences } from "@/lib/residences"
import { departmentCodeFromZip, departmentLabel, groupResidencesByDepartment } from "@/lib/departments"
import { exportElementToPdf } from "@/lib/exportPdf"
import {
  campaignStatus,
  campaignTimeConsumed,
  CAMPAIGN_STATUS_BADGE_CLASS,
  deleteAdCampaign,
  subscribeToAdCampaign,
  subscribeToAdCampaignClicks,
  subscribeToAdCampaignImpressions,
  updateAdCampaign,
  uploadAdCampaignImage,
  type AdCampaignEvent,
} from "@/lib/adCampaigns"
import type { AdCampaign } from "@/types/adCampaign"
import type { Residence } from "@/types/residence"

type Granularity = "day" | "month" | "year"

function bucketKey(date: Date, granularity: Granularity): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  if (granularity === "year") return `${year}`
  if (granularity === "month") return `${year}-${month}`
  return `${year}-${month}-${day}`
}

function bucketLabel(key: string, granularity: Granularity): string {
  if (granularity === "year") return key
  if (granularity === "month") {
    const [year, month] = key.split("-").map(Number)
    return new Date(year, month - 1, 1).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })
  }
  return new Date(`${key}T00:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })
}

// Regroupe le journal détaillé (un document par événement) en points
// chronologiques - jour/mois/année choisi via le bouton segmenté, partagé
// entre le graphique impressions et le graphique clics.
function aggregateByTime(events: AdCampaignEvent[], granularity: Granularity) {
  const totals = new Map<string, number>()
  for (const event of events) {
    if (!event.timestamp) continue
    const key = bucketKey(event.timestamp, granularity)
    totals.set(key, (totals.get(key) ?? 0) + 1)
  }
  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => ({ key, label: bucketLabel(key, granularity), count }))
}

// Regroupe des compteurs par résidence (impressionsByResidence/
// clicksByResidence) en compteurs par département, triés du plus au moins
// représenté - c'est ce niveau de zone géographique qui est utilisé pour le
// ciblage et le quota de campagnes actives, donc le plus pertinent à
// afficher ici plutôt qu'une résidence par résidence.
function aggregateByDepartment(counts: Record<string, number>, residences: Residence[]) {
  const residenceById = new Map(residences.map((r) => [r.id, r]))
  const totals = new Map<string, number>()
  for (const [residenceId, count] of Object.entries(counts)) {
    const residence = residenceById.get(residenceId)
    const code = residence ? departmentCodeFromZip(residence.address.zipCode) : "?"
    totals.set(code, (totals.get(code) ?? 0) + count)
  }
  return [...totals.entries()]
    .map(([code, count]) => ({ code, label: code === "?" ? "Autre" : departmentLabel(code), count }))
    .sort((a, b) => b.count - a.count)
}

const STATUT_ORDER = ["Propriétaire", "Locataire", "Inconnu"]
const STATUT_COLOR: Record<string, string> = {
  Propriétaire: "#0ea5e9",
  Locataire: "#10b981",
  Inconnu: "#94a3b8",
}

// Répartition par profil résident (propriétaire/locataire) - dérivé du lot
// préféré côté app au moment de l'événement, pas d'un champ de compte
// unique (un même uid peut être propriétaire d'un lot et locataire d'un
// autre selon la résidence). Compte les UTILISATEURS DISTINCTS, pas les
// événements bruts : un même résident qui scrolle plusieurs fois devant la
// pub génère plusieurs impressions (cf. adv_widget.dart, pas de
// déduplication au niveau du compteur global) - ici on ne veut compter
// chaque personne qu'une fois par campagne, pas gonfler son profil.
function aggregateByStatut(events: AdCampaignEvent[]) {
  const statutByUid = new Map<string, string>()
  for (const event of events) {
    if (!statutByUid.has(event.uid)) statutByUid.set(event.uid, event.statutResident)
  }
  const totals = new Map<string, number>()
  for (const statut of statutByUid.values()) {
    totals.set(statut, (totals.get(statut) ?? 0) + 1)
  }
  return STATUT_ORDER.filter((statut) => totals.has(statut)).map((statut) => ({
    statut,
    count: totals.get(statut) ?? 0,
  }))
}

export default function AdCampaignDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const reportRef = useRef<HTMLDivElement>(null)
  const [campaign, setCampaign] = useState<AdCampaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [residences, setResidences] = useState<Residence[]>([])
  const [initialized, setInitialized] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [name, setName] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [targetUrl, setTargetUrl] = useState("")
  const [targetResidenceIds, setTargetResidenceIds] = useState<string[]>([])
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  const [impressionEvents, setImpressionEvents] = useState<AdCampaignEvent[]>([])
  const [clickEvents, setClickEvents] = useState<AdCampaignEvent[]>([])
  const [granularity, setGranularity] = useState<Granularity>("day")

  useEffect(() => {
    if (!id) return
    setLoading(true)
    return subscribeToAdCampaign(
      id,
      (data) => {
        setCampaign(data)
        setLoading(false)
      },
      (error) => {
        toast.error("Impossible de charger la campagne : " + error.message)
        setLoading(false)
      }
    )
  }, [id])

  useEffect(() => {
    return subscribeToResidences(setResidences, () => {})
  }, [])

  useEffect(() => {
    if (!id) return
    return subscribeToAdCampaignImpressions(id, setImpressionEvents, () => {})
  }, [id])

  useEffect(() => {
    if (!id) return
    return subscribeToAdCampaignClicks(id, setClickEvents, () => {})
  }, [id])

  // Ne préremplit le formulaire qu'une fois, au premier chargement - les
  // mises à jour temps réel suivantes (ex: active togglé par la Cloud
  // Function de réconciliation) ne doivent pas écraser une saisie en cours.
  useEffect(() => {
    if (campaign && !initialized) {
      setName(campaign.name)
      setImageUrl(campaign.imageUrl)
      setTargetUrl(campaign.targetUrl)
      setTargetResidenceIds(campaign.targetResidenceIds)
      setStartDate(campaign.startDate)
      setEndDate(campaign.endDate)
      setInitialized(true)
    }
  }, [campaign, initialized])

  function toggleResidence(residenceId: string, checked: boolean) {
    setTargetResidenceIds((prev) =>
      checked ? [...prev, residenceId] : prev.filter((r) => r !== residenceId)
    )
  }

  function toggleGroup(group: Residence[], checked: boolean) {
    const groupIds = group.map((r) => r.id)
    setTargetResidenceIds((prev) =>
      checked ? [...new Set([...prev, ...groupIds])] : prev.filter((rid) => !groupIds.includes(rid))
    )
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!id) return
    if (!name.trim()) {
      toast.error("Le nom de la campagne est requis")
      return
    }
    if (!imageFile && !imageUrl) {
      toast.error("Une image est requise")
      return
    }
    if (targetResidenceIds.length === 0) {
      toast.error("Sélectionnez au moins une résidence")
      return
    }
    if (!startDate || !endDate) {
      toast.error("La période de diffusion (début et fin) est requise")
      return
    }
    if (endDate < startDate) {
      toast.error("La date de fin doit être après la date de début")
      return
    }
    setSubmitting(true)
    try {
      const finalImageUrl = imageFile ? await uploadAdCampaignImage(imageFile) : imageUrl
      await updateAdCampaign(id, {
        name: name.trim(),
        imageUrl: finalImageUrl,
        targetUrl,
        targetResidenceIds,
        startDate,
        endDate,
      })
      toast.success("Campagne mise à jour")
    } catch (err) {
      toast.error("Échec de l'enregistrement : " + (err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!id) return
    try {
      await deleteAdCampaign(id)
      toast.success("Campagne supprimée")
      navigate("/publicites")
    } catch (err) {
      toast.error("Échec de la suppression : " + (err as Error).message)
    }
  }

  async function handleExportPdf() {
    if (!reportRef.current || !campaign) return
    setExportingPdf(true)
    try {
      await exportElementToPdf(reportRef.current, `rapport_campagne_${campaign.name || campaign.id}.pdf`)
    } catch (err) {
      toast.error("Échec de l'export PDF : " + (err as Error).message)
    } finally {
      setExportingPdf(false)
    }
  }

  if (!id) return null

  const today = new Date().toISOString().slice(0, 10)
  const timeConsumed = campaign ? campaignTimeConsumed(campaign, today) : null
  const impressionsByDepartment = campaign
    ? aggregateByDepartment(campaign.impressionsByResidence, residences)
    : []
  const clicksByDepartment = campaign ? aggregateByDepartment(campaign.clicksByResidence, residences) : []
  const impressionsOverTime = aggregateByTime(impressionEvents, granularity)
  const clicksOverTime = aggregateByTime(clickEvents, granularity)
  const impressionsByStatut = aggregateByStatut(impressionEvents)
  const clicksByStatut = aggregateByStatut(clickEvents)

  return (
    <div className="-mt-[20px] flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Link
          to="/publicites"
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Publicités
        </Link>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">
            {campaign ? campaign.name || "Sans nom" : loading ? "…" : "Campagne introuvable"}
          </h1>
          {campaign && (
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={CAMPAIGN_STATUS_BADGE_CLASS[campaignStatus(campaign, today)]}
              >
                {campaignStatus(campaign, today)}
              </Badge>
              <Button variant="outline" size="sm" onClick={() => setDeleting(true)}>
                <Trash2 />
                Supprimer
              </Button>
            </div>
          )}
        </div>
      </div>

      {!loading && !campaign && (
        <p className="text-muted-foreground">Cette campagne n'existe pas ou a été supprimée.</p>
      )}

      {campaign && (
        <div className="flex flex-col gap-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)] [--card-spacing:--spacing(6)]">
              <CardHeader>
                <CardTitle className="text-base">Campagne</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ad-name" className="p-2.5">Nom de la campagne</Label>
                    <Input id="ad-name" required value={name} onChange={(e) => setName(e.target.value)} />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ad-image" className="p-2.5">Image (format carré recommandé)</Label>
                    <label
                      htmlFor="ad-image"
                      className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-input p-4 text-sm text-muted-foreground hover:bg-muted/50"
                    >
                      {imageFile ? (
                        <img
                          src={URL.createObjectURL(imageFile)}
                          alt=""
                          className="size-32 rounded-md object-cover"
                        />
                      ) : imageUrl ? (
                        <img src={imageUrl} alt="" className="size-32 rounded-md object-cover" />
                      ) : (
                        <ImagePlus className="size-6" />
                      )}
                      {imageFile?.name ?? (imageUrl ? "Remplacer l'image" : "Choisir une image")}
                    </label>
                    <input
                      id="ad-image"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ad-url" className="p-2.5">Lien cible (optionnel)</Label>
                    <Input
                      id="ad-url"
                      type="url"
                      placeholder="https://…"
                      value={targetUrl}
                      onChange={(e) => setTargetUrl(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="p-2.5">Période de diffusion</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Du</span>
                      <DateInput value={startDate} onChange={setStartDate} />
                      <span className="text-sm text-muted-foreground">au</span>
                      <DateInput value={endDate} onChange={setEndDate} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Activation et désactivation automatiques selon ces dates et le nombre de
                      campagnes déjà actives sur les mêmes départements (max 3).
                    </p>
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={submitting}>
                      <Save />
                      Enregistrer
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
              <CardHeader>
                <CardTitle className="text-base">
                  Résidences ciblées ({targetResidenceIds.length} sélectionnée
                  {targetResidenceIds.length > 1 ? "s" : ""})
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <label className="flex w-fit items-center gap-2 text-sm font-medium text-primary">
                  <input
                    type="checkbox"
                    checked={residences.length > 0 && targetResidenceIds.length === residences.length}
                    onChange={(e) => toggleGroup(residences, e.target.checked)}
                    className="size-4 rounded border-input accent-primary"
                  />
                  France entière
                </label>
                <div className="flex max-h-96 flex-col gap-3 overflow-y-auto rounded-lg border border-input p-2">
                  {residences.length === 0 && (
                    <p className="px-1 py-1 text-sm text-muted-foreground">Aucune résidence.</p>
                  )}
                  {groupResidencesByDepartment(residences).map(([code, group]) => {
                    const allSelected = group.every((r) => targetResidenceIds.includes(r.id))
                    return (
                      <div key={code} className="flex flex-col gap-1">
                        <label className="flex items-center gap-2 rounded-md bg-muted/40 px-1.5 py-1 text-sm font-medium">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={(e) => toggleGroup(group, e.target.checked)}
                            className="size-4 rounded border-input accent-primary"
                          />
                          {departmentLabel(code)} ({group.length})
                        </label>
                        <div className="flex flex-col gap-0.5 pl-6">
                          {group.map((residence) => (
                            <label
                              key={residence.id}
                              className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-muted/50"
                            >
                              <input
                                type="checkbox"
                                checked={targetResidenceIds.includes(residence.id)}
                                onChange={(e) => toggleResidence(residence.id, e.target.checked)}
                                className="size-4 rounded border-input accent-primary"
                              />
                              {residence.name}
                            </label>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <div ref={reportRef}>
          <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
            <CardHeader>
              <CardTitle className="text-base">Rapport de campagne</CardTitle>
              <CardAction data-pdf-ignore>
                <Button
                  size="sm"
                  disabled={exportingPdf}
                  onClick={handleExportPdf}
                  className="bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-100 dark:hover:bg-slate-500"
                >
                  <FileDown />
                  Exporter en PDF
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {timeConsumed && (
                <div className="mb-6 flex flex-col gap-2 rounded-xl bg-muted/40 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">Temps de campagne consommé</span>
                    <span className="text-sm text-muted-foreground">
                      {timeConsumed.elapsedDays} / {timeConsumed.totalDays} jour
                      {timeConsumed.totalDays > 1 ? "s" : ""} · {timeConsumed.percent}%
                    </span>
                  </div>
                  <div className="h-4 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${timeConsumed.percent}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 rounded-xl bg-muted/40 p-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-600">
                    <Eye className="size-5" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm text-muted-foreground">Impressions</span>
                    <span className="text-2xl font-semibold">{campaign.impressionCount}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl bg-muted/40 p-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <MousePointerClick className="size-5" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm text-muted-foreground">Clics</span>
                    <span className="text-2xl font-semibold">{campaign.clickCount}</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium">Impressions par région</h3>
                  <div className="h-52">
                    {impressionsByDepartment.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        Aucune donnée pour l'instant.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={impressionsByDepartment} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                          <XAxis
                            dataKey="code"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                          />
                          <YAxis
                            allowDecimals={false}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                          />
                          <Tooltip
                            cursor={{ fill: "var(--muted)" }}
                            labelFormatter={(_, payload) => payload[0]?.payload.label ?? ""}
                            contentStyle={{
                              background: "var(--popover)",
                              border: "1px solid var(--border)",
                              borderRadius: "var(--radius-md)",
                              fontSize: 12,
                            }}
                          />
                          <Bar dataKey="count" fill="#0ea5e9" radius={[4, 4, 0, 0]} barSize={32} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium">Clics par région</h3>
                  <div className="h-52">
                    {clicksByDepartment.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        Aucune donnée pour l'instant.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={clicksByDepartment} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                          <XAxis
                            dataKey="code"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                          />
                          <YAxis
                            allowDecimals={false}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                          />
                          <Tooltip
                            cursor={{ fill: "var(--muted)" }}
                            labelFormatter={(_, payload) => payload[0]?.payload.label ?? ""}
                            contentStyle={{
                              background: "var(--popover)",
                              border: "1px solid var(--border)",
                              borderRadius: "var(--radius-md)",
                              fontSize: 12,
                            }}
                          />
                          <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} barSize={32} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between gap-3">
                <h3 className="text-sm font-medium">Évolution dans le temps</h3>
                <div className="flex items-center gap-1 rounded-lg border border-input p-0.5">
                  {(["day", "month", "year"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setGranularity(option)}
                      className={`rounded-md px-2 py-1 text-xs ${granularity === option ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                    >
                      {option === "day" ? "Jour" : option === "month" ? "Mois" : "Année"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-2 grid gap-6 lg:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <h4 className="text-xs text-muted-foreground">Impressions</h4>
                  <div className="h-52">
                    {impressionsOverTime.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        Aucune donnée pour l'instant.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={impressionsOverTime} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                          <XAxis
                            dataKey="label"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                          />
                          <YAxis
                            allowDecimals={false}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                          />
                          <Tooltip
                            cursor={{ stroke: "var(--border)" }}
                            contentStyle={{
                              background: "var(--popover)",
                              border: "1px solid var(--border)",
                              borderRadius: "var(--radius-md)",
                              fontSize: 12,
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="count"
                            name="Impressions"
                            stroke="#0ea5e9"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <h4 className="text-xs text-muted-foreground">Clics</h4>
                  <div className="h-52">
                    {clicksOverTime.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        Aucune donnée pour l'instant.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={clicksOverTime} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                          <XAxis
                            dataKey="label"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                          />
                          <YAxis
                            allowDecimals={false}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                          />
                          <Tooltip
                            cursor={{ stroke: "var(--border)" }}
                            contentStyle={{
                              background: "var(--popover)",
                              border: "1px solid var(--border)",
                              borderRadius: "var(--radius-md)",
                              fontSize: 12,
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="count"
                            name="Clics"
                            stroke="#10b981"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>

              <h3 className="mt-6 text-sm font-medium">Engagement par profil résident</h3>
              <p className="text-xs text-muted-foreground">
                Utilisateurs uniques (chaque personne comptée une seule fois sur cette campagne).
              </p>
              <div className="mt-2 grid gap-6 lg:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <h4 className="text-xs text-muted-foreground">A vu la pub</h4>
                  <div className="h-52">
                    {impressionsByStatut.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        Aucune donnée pour l'instant.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={impressionsByStatut} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                          <XAxis
                            dataKey="statut"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                          />
                          <YAxis
                            allowDecimals={false}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                          />
                          <Tooltip
                            cursor={{ fill: "var(--muted)" }}
                            contentStyle={{
                              background: "var(--popover)",
                              border: "1px solid var(--border)",
                              borderRadius: "var(--radius-md)",
                              fontSize: 12,
                            }}
                          />
                          <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={40}>
                            {impressionsByStatut.map(({ statut }) => (
                              <Cell key={statut} fill={STATUT_COLOR[statut]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <h4 className="text-xs text-muted-foreground">A cliqué</h4>
                  <div className="h-52">
                    {clicksByStatut.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        Aucune donnée pour l'instant.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={clicksByStatut} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                          <XAxis
                            dataKey="statut"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                          />
                          <YAxis
                            allowDecimals={false}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                          />
                          <Tooltip
                            cursor={{ fill: "var(--muted)" }}
                            contentStyle={{
                              background: "var(--popover)",
                              border: "1px solid var(--border)",
                              borderRadius: "var(--radius-md)",
                              fontSize: 12,
                            }}
                          />
                          <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={40}>
                            {clicksByStatut.map(({ statut }) => (
                              <Cell key={statut} fill={STATUT_COLOR[statut]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          </div>
        </div>
      )}

      <Dialog open={deleting} onOpenChange={setDeleting}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="pb-4">
            <DialogTitle>Supprimer cette campagne ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Cette campagne publicitaire sera définitivement supprimée et n'apparaîtra plus dans l'app.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(false)}>
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
