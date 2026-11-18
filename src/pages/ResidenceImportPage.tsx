import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { AlertTriangle, ArrowLeft, Building2, Copy, Download, FileText, LoaderCircle, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AddressAutocompleteInput } from "@/components/AddressAutocompleteInput"
import { ZipCodeCityInput } from "@/components/ZipCodeCityInput"
import { LotImportPreview } from "@/components/LotImportDialog"
import { ImportStatusBadge } from "@/components/residence-import/ImportStatusBadge"
import { PRIMARY_CTA_CLASS } from "@/lib/utils"
import { subscribeToResidences } from "@/lib/residences"
import {
  createResidenceFromImport,
  downloadProposalXlsx,
  proposalLots,
  subscribeToResidenceImport,
  validateProposalLots,
  type ProposalState,
  type ResidenceImport,
} from "@/lib/residenceImport"
import type { Residence } from "@/types/residence"

function formatDateTime(value?: { toDate: () => Date }): string {
  return value ? value.toDate().toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : ""
}

function nameKey(name: string): string {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "")
}

// Import d'une résidence depuis ses documents (superAdmin) : suivi de la
// lecture par Claude (connecteur Konodal), vérification de la proposition,
// puis création avec les écritures habituelles du BO (lib/residenceImport.ts).
export default function ResidenceImportPage() {
  const { id = "" } = useParams()
  const [job, setJob] = useState<ResidenceImport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(
    () =>
      subscribeToResidenceImport(
        id,
        (data) => {
          setJob(data)
          setLoading(false)
        },
        (err) => {
          toast.error("Impossible de charger l'import : " + err.message)
          setLoading(false)
        }
      ),
    [id]
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link to="/residences" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Résidences
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl">{job?.label || "Créer avec Nodo"}</h1>
          {job && <ImportStatusBadge status={job.status} />}
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Chargement…</p>}
      {!loading && !job && <p className="text-sm text-muted-foreground">Import introuvable.</p>}
      {job && (job.status === "waiting" || job.status === "reading") && <ReadingCard job={job} />}
      {job && job.status === "ready" && job.proposal && <ProposalReview job={job} />}
      {job && job.status === "created" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Résidence créée</CardTitle>
            <CardDescription>
              Créée le {formatDateTime(job.residenceCreatedAt)} à partir de cet import
              {job.selectedState === "reglement" ? " (état du règlement seul)." : "."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {job.residenceId && (
              <Button className={PRIMARY_CTA_CLASS} render={<Link to={`/residences/${job.residenceId}`} />}>
                <Building2 />
                Ouvrir la résidence
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ReadingCard({ job }: { job: ResidenceImport }) {
  const phrase = `Avec Konodal, prépare la création de la résidence de l'import ${job.id} en suivant la méthode.`

  async function copy() {
    try {
      await navigator.clipboard.writeText(phrase)
      toast.success("Phrase copiée")
    } catch {
      toast.error("Copie impossible : sélectionnez la phrase à la main.")
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lecture par Claude</CardTitle>
          <CardDescription>
            Dans Claude (application ou claude.ai), dans une conversation où le connecteur Konodal est activé, dites :
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="rounded-lg border bg-muted/40 p-3 text-sm select-all">{phrase}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={copy}>
              <Copy />
              Copier la phrase
            </Button>
            <Button variant="outline" render={<a href="https://claude.ai/new" target="_blank" rel="noreferrer" />}>
              <Sparkles />
              Ouvrir Claude
            </Button>
          </div>
          {job.status === "reading" ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              {job.step || "Lecture en cours"} {job.stepAt && `(${formatDateTime(job.stepAt)})`}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              La proposition s'affichera ici dès que Claude l'aura envoyée (en général 10 à 20 minutes).
            </p>
          )}
        </CardContent>
      </Card>
      <FilesCard job={job} />
    </div>
  )
}

function FilesCard({ job }: { job: ResidenceImport }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Documents déposés</CardTitle>
        <CardDescription>Déposés le {formatDateTime(job.createdAt)}.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {(job.files ?? []).map((file, i) => (
          <div key={file.path} className="flex min-w-0 items-center gap-2 text-sm">
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <span className="shrink-0 text-muted-foreground">Fichier {i + 1}</span>
            <span className="min-w-0 truncate">{file.name}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function ProposalReview({ job }: { job: ResidenceImport }) {
  const proposal = job.proposal!
  const navigate = useNavigate()
  const hasInitialState = (proposal.lotsReglement?.length ?? 0) > 0
  const [state, setState] = useState<ProposalState>("actuel")
  const [name, setName] = useState(proposal.residence.nom ?? job.label ?? "")
  const [street, setStreet] = useState(proposal.residence.adresse ?? "")
  const [zipCode, setZipCode] = useState(proposal.residence.codePostal ?? "")
  const [city, setCity] = useState(proposal.residence.ville ?? "")
  const [residences, setResidences] = useState<Residence[]>([])
  const [creating, setCreating] = useState(false)

  useEffect(() => subscribeToResidences(setResidences, () => undefined), [])

  const lots = proposalLots(proposal, state)
  const validation = useMemo(() => validateProposalLots(lots), [lots])
  const total = lots.reduce((sum, l) => sum + l.tantiemes, 0)
  const base = state === "reglement" ? proposal.baseReglement : proposal.baseDeclaree
  const sameName = residences.filter((r) => name.trim() && nameKey(r.name) === nameKey(name))
  const points = [...(proposal.ecarts ?? [])]
  const canCreate =
    !creating && !!name.trim() && !!street.trim() && !!zipCode.trim() && !!city.trim() && validation.errors.length === 0 && validation.toCreate.length > 0

  async function handleCreate() {
    const warning = sameName.length ? `\n\nAttention : une résidence « ${sameName[0].name} » existe déjà.` : ""
    if (!window.confirm(`Créer la résidence « ${name.trim()} » avec ${validation.toCreate.length} lots ?${warning}`)) return
    setCreating(true)
    try {
      const residenceId = await createResidenceFromImport(job, state, { name, street, zipCode, city })
      toast.success("Résidence créée")
      navigate(`/residences/${residenceId}`)
    } catch (err) {
      toast.error("Échec de la création : " + (err as Error).message)
      setCreating(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Résidence</CardTitle>
            <CardDescription>Proposée le {formatDateTime(job.proposedAt)} : vérifiez le nom et l'adresse.</CardDescription>
          </CardHeader>
          <CardContent className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="imp-name">Nom</Label>
              <Input id="imp-name" value={name} onChange={(e) => setName(e.target.value)} />
              {sameName.length > 0 && (
                <p className="flex items-center gap-1.5 text-xs text-amber-700">
                  <AlertTriangle className="size-3.5" />
                  Une résidence porte déjà ce nom :{" "}
                  <Link className="underline" to={`/residences/${sameName[0].id}`}>
                    {sameName[0].name}
                  </Link>
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="imp-street">Adresse</Label>
              <AddressAutocompleteInput
                id="imp-street"
                value={street}
                onChange={setStreet}
                onSelect={(a) => {
                  setStreet(a.street)
                  setZipCode(a.zipCode)
                  setCity(a.city)
                }}
              />
            </div>
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="imp-zip">Code postal</Label>
                <ZipCodeCityInput id="imp-zip" value={zipCode} onChange={setZipCode} onCityResolved={setCity} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="imp-city">Ville</Label>
                <Input id="imp-city" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Documents lus</CardTitle>
            <CardDescription>Ce que Claude a tiré de chaque document.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {(proposal.documents ?? []).map((d, i) => (
              <div key={i} className="flex flex-col">
                <span className="font-medium">
                  {d.titre || `Fichier ${d.fichier ?? i + 1}`}
                  {d.date && <span className="font-normal text-muted-foreground"> · {d.date}</span>}
                  {d.role && <span className="font-normal text-muted-foreground"> · {d.role}</span>}
                </span>
                {d.utilisation && <span className="text-muted-foreground">{d.utilisation}</span>}
              </div>
            ))}
            {(proposal.documents ?? []).length === 0 && <FilesList job={job} />}
          </CardContent>
        </Card>
      </div>

      {hasInitialState && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">État retenu</CardTitle>
            <CardDescription>Un modificatif change les lots du règlement de copropriété.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {(
              [
                ["actuel", `Après modificatifs : ${proposal.lots.length} lots, base ${proposal.baseDeclaree ?? "?"}`],
                ["reglement", `Règlement seul : ${proposal.lotsReglement.length} lots, base ${proposal.baseReglement ?? "?"}`],
              ] as [ProposalState, string][]
            ).map(([value, text]) => (
              <Button key={value} type="button" variant={state === value ? "default" : "outline"} onClick={() => setState(value)}>
                {text}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Points à vérifier</CardTitle>
          <CardDescription>
            {lots.length} lots, {total} tantièmes
            {base != null && (total === base ? ` (base déclarée ${base})` : ` pour une base déclarée de ${base}`)}.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <LotImportPreview validation={validation} />
          <PointList title="Écarts relevés par Konodal" items={points} tone="red" />
          <PointList title="Anomalies des documents" items={proposal.anomalies ?? []} tone="amber" />
          <PointList
            title="Lots supprimés par un modificatif"
            items={(proposal.lotsSupprimes ?? []).map((l) => `Lot ${l.ref ?? "?"} : ${l.motif ?? ""}`)}
            tone="muted"
          />
          <PointList title="Hypothèses de lecture" items={proposal.hypotheses ?? []} tone="muted" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base">Lots</CardTitle>
            <CardDescription>
              N° sans la lettre de la cage et sans le P des places ; la colonne Source renvoie à la page lue.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void downloadProposalXlsx(lots, name)}>
              <Download />
              Télécharger en Excel
            </Button>
            <Button type="button" className={PRIMARY_CTA_CLASS} disabled={!canCreate} onClick={handleCreate}>
              <Building2 />
              {creating ? "Création…" : "Créer la résidence"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Réf.</TableHead>
                <TableHead>Bâtiment</TableHead>
                <TableHead>N°</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Étage</TableHead>
                <TableHead className="text-right">Tantièmes</TableHead>
                <TableHead>N° commercial</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Remarque</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lots.map((lot) => (
                <TableRow key={lot.refLot} className={lot.remarque ? "bg-amber-50/60" : undefined}>
                  <TableCell className="font-medium">{lot.refLot}</TableCell>
                  <TableCell>{lot.batiment}</TableCell>
                  <TableCell>{lot.lot}</TableCell>
                  <TableCell>{lot.typeLot}</TableCell>
                  <TableCell>{lot.etage || "-"}</TableCell>
                  <TableCell className="text-right tabular-nums">{lot.tantiemes}</TableCell>
                  <TableCell className="text-muted-foreground">{lot.numeroCommercial}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {lot.page ? `F${lot.fichier ?? "?"} p.${lot.page}` : ""}
                    {lot.origine && lot.origine !== "reglement" ? ` · ${lot.origine}` : ""}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{lot.remarque}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function FilesList({ job }: { job: ResidenceImport }) {
  return (
    <>
      {(job.files ?? []).map((file, i) => (
        <span key={file.path} className="text-muted-foreground">
          Fichier {i + 1} : {file.name}
        </span>
      ))}
    </>
  )
}

function PointList({ title, items, tone }: { title: string; items: string[]; tone: "red" | "amber" | "muted" }) {
  if (items.length === 0) return null
  const colors = {
    red: "border-red-200 bg-red-50 text-red-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    muted: "text-muted-foreground",
  }[tone]
  return (
    <details className={`rounded-lg border p-3 ${colors}`} open={tone !== "muted"}>
      <summary className="cursor-pointer font-medium">
        {title} ({items.length})
      </summary>
      <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-xs">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </details>
  )
}
