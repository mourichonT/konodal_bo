import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { ArrowLeft, Building2, Check, ExternalLink, Home, Info, Mail, Paperclip, Send, Upload, UserCheck, UserX, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AddressAutocompleteInput } from "@/components/AddressAutocompleteInput"
import { ZipCodeCityInput } from "@/components/ZipCodeCityInput"
import { useAuth } from "@/lib/auth-context"
import {
  addRequestAttachment,
  approveResidenceRequest,
  lotRefs,
  requestAttachmentUrl,
  sendRequestEmail,
  REQUEST_STATUS_BADGE_CLASS as STATUS_BADGE_CLASS,
  REQUEST_STATUS_LABEL as STATUS_LABEL,
  rejectResidenceRequest,
  requestBuildings,
  requesterAccountUid,
  subscribeToResidenceRequest,
} from "@/lib/residenceRequests"
import { cn, PRIMARY_CTA_CLASS } from "@/lib/utils"
import { defaultIsLinkableForType } from "@/types/lot"
import type { ResidenceRequest, ResidenceRequestAttachment } from "@/types/residenceRequest"

// Examen d'une demande d'inscription (konodal.com/inscription-residence),
// présenté comme la fiche d'une résidence (ResidenceDetailPage) : mêmes
// onglets Information / Bâtiments / Lots, avant même que la résidence
// existe. Nom et adresse restent corrigeables jusqu'à la validation ;
// bâtiments et lots se modifient ensuite depuis la vraie fiche.
const tabs = [
  { key: "information", label: "Information", icon: Info },
  { key: "buildings", label: "Bâtiments", icon: Building2 },
  { key: "lots", label: "Lots", icon: Home },
  { key: "documents", label: "Documents", icon: Paperclip },
  { key: "exchanges", label: "Échanges", icon: Mail },
] as const
type TabKey = (typeof tabs)[number]["key"]

export default function ResidenceRequestDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [request, setRequest] = useState<ResidenceRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>("information")

  useEffect(() => {
    if (!id) return
    return subscribeToResidenceRequest(
      id,
      (data) => {
        setRequest(data)
        setLoading(false)
      },
      (error) => {
        toast.error("Impossible de charger la demande : " + error.message)
        setLoading(false)
      }
    )
  }, [id])

  return (
    <div className="-mt-[20px] flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Link
          to="/residences/demandes"
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Demandes
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-extrabold tracking-tight text-[oklch(22%_0.01_150)]">
            {request?.residence.name || (loading ? "…" : "Demande introuvable")}
          </h1>
          {request && (
            <Badge variant="outline" className={STATUS_BADGE_CLASS[request.status]}>
              {STATUS_LABEL[request.status]}
            </Badge>
          )}
          {request?.status === "approved" && request.residenceId && (
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => navigate(`/residences/${request.residenceId}`)}>
              Voir la résidence
            </Button>
          )}
        </div>
      </div>

      {!loading && !request && <p className="text-muted-foreground">Cette demande n'existe pas ou a été supprimée.</p>}

      {request && user && (
        <>
          <div className="flex w-full items-center gap-1 rounded-2xl bg-[oklch(93%_0.005_100)] p-1.5">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-[13.5px] font-semibold transition-colors",
                  activeTab === tab.key
                    ? "bg-[oklch(45%_0.1_155)] font-bold text-white shadow-[0_6px_16px_-6px_oklch(38%_0.08_155/0.5)]"
                    : "text-[oklch(45%_0.01_150)] hover:bg-[oklch(98%_0.003_100)]"
                )}
              >
                <tab.icon className="size-4" />
                {tab.label}
                {tab.key === "documents" && (request.attachments?.length ?? 0) > 0 && (
                  <span className="text-xs opacity-75">({request.attachments?.length})</span>
                )}
                {tab.key === "exchanges" && (request.messages?.length ?? 0) > 0 && (
                  <span className="text-xs opacity-75">({request.messages?.length})</span>
                )}
              </button>
            ))}
          </div>

          {/* Monté en permanence (masqué hors onglet) : garde les corrections
              de nom/adresse en cours en changeant d'onglet. */}
          <div className={cn("flex flex-col gap-5", activeTab !== "information" && "hidden")}>
            <InformationTab key={request.id} request={request} processedBy={user.uid} />
          </div>
          {activeTab === "buildings" && <BuildingsTab request={request} />}
          {activeTab === "lots" && <LotsTab request={request} />}
          {activeTab === "documents" && <DocumentsTab request={request} />}
          {/* Monté en permanence : un brouillon d'email survit au changement d'onglet. */}
          <div className={cn(activeTab !== "exchanges" && "hidden")}>
            <ExchangesTab request={request} sentBy={user.uid} />
          </div>
        </>
      )}
    </div>
  )
}

function InformationTab({ request, processedBy }: { request: ResidenceRequest; processedBy: string }) {
  const pending = request.status === "pending"
  const [name, setName] = useState(request.residence.name)
  const [street, setStreet] = useState(request.residence.address.street)
  const [complement, setComplement] = useState(request.residence.address.complement)
  const [zipCode, setZipCode] = useState(request.residence.address.zipCode)
  const [city, setCity] = useState(request.residence.address.city)
  const [accountUid, setAccountUid] = useState<string | null | undefined>(undefined)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    requesterAccountUid(request)
      .then((uid) => !cancelled && setAccountUid(uid))
      .catch(() => !cancelled && setAccountUid(null))
    return () => {
      cancelled = true
    }
  }, [request])

  async function handleApprove() {
    if (!name.trim() || !street.trim() || !/^\d{5}$/.test(zipCode) || !city.trim()) {
      toast.error("Nom et adresse complète requis avant validation")
      return
    }
    setBusy(true)
    try {
      const { csMemberUid, emailSent } = await approveResidenceRequest(request, processedBy, {
        name: name.trim(),
        address: { street: street.trim(), complement: complement.trim(), zipCode, city: city.trim() },
      })
      toast.success(
        `Résidence ${name.trim()} créée` +
          (csMemberUid ? ", demandeur ajouté au CS" : " (le demandeur n'a pas encore de compte)") +
          (emailSent ? "" : " - email au demandeur non envoyé")
      )
    } catch (err) {
      toast.error("Échec de la validation : " + (err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function handleReject() {
    setBusy(true)
    try {
      const { emailSent } = await rejectResidenceRequest(request, reason.trim(), processedBy)
      toast.success("Demande refusée" + (emailSent ? "" : " - email au demandeur non envoyé"))
      setRejecting(false)
    } catch (err) {
      toast.error("Échec du refus : " + (err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Informations</CardTitle>
          {pending && <CardDescription>Corrigez le nom ou l'adresse si besoin avant de valider.</CardDescription>}
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="req-name">Nom</Label>
            <Input id="req-name" value={name} onChange={(e) => setName(e.target.value)} disabled={!pending} />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="req-street">Adresse</Label>
            {pending ? (
              <AddressAutocompleteInput
                id="req-street"
                value={street}
                onChange={setStreet}
                onSelect={(a) => {
                  setStreet(a.street)
                  setZipCode(a.zipCode)
                  setCity(a.city)
                }}
              />
            ) : (
              <Input id="req-street" value={street} disabled />
            )}
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="req-complement">Complément</Label>
            <Input id="req-complement" value={complement} onChange={(e) => setComplement(e.target.value)} disabled={!pending} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="req-zip">Code postal</Label>
            {pending ? (
              <ZipCodeCityInput id="req-zip" value={zipCode} onChange={setZipCode} onCityResolved={setCity} />
            ) : (
              <Input id="req-zip" value={zipCode} disabled />
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="req-city">Ville</Label>
            <Input id="req-city" value={city} onChange={(e) => setCity(e.target.value)} disabled={!pending} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Demandeur</CardTitle>
          <CardDescription>
            Envoyée le {request.createdAt ? request.createdAt.toDate().toLocaleDateString("fr-FR") : "—"} depuis
            konodal.com · offre gratuite (sans tantièmes ni syndic)
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <div className="text-xs font-semibold text-muted-foreground">Nom</div>
            {request.requester.firstName} {request.requester.lastName}
          </div>
          <div>
            <div className="text-xs font-semibold text-muted-foreground">Lien avec la résidence</div>
            {request.requester.role}
          </div>
          <div>
            <div className="text-xs font-semibold text-muted-foreground">Email</div>
            <a href={`mailto:${request.requester.email}`} className="hover:underline">
              {request.requester.email}
            </a>
          </div>
          <div>
            <div className="text-xs font-semibold text-muted-foreground">Téléphone</div>
            {request.requester.phone || "—"}
          </div>
          <div className="sm:col-span-2">
            {accountUid ? (
              <span className="flex flex-wrap items-center gap-2 text-[oklch(38%_0.09_155)]">
                <UserCheck className="size-4" />
                Compte Konodal lié : {pending ? "ajouté" : "membre"} du conseil syndical
                {pending ? " à la validation." : "."}
                <Link to={`/residents/${accountUid}`} className="font-semibold underline underline-offset-2">
                  Voir le compte
                </Link>
              </span>
            ) : accountUid === null ? (
              <span className="flex items-center gap-2 text-destructive">
                <UserX className="size-4" />
                Demande sans compte Konodal : elle ne peut pas être validée (la résidence n'aurait aucun membre du CS).
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {request.status === "rejected" && (
        <Card>
          <CardHeader>
            <CardTitle>Demande refusée</CardTitle>
            <CardDescription>{request.rejectionReason ? `Motif : ${request.rejectionReason}` : "Sans motif."}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {pending && (
        <Card>
          <CardHeader>
            <CardTitle>Décision</CardTitle>
            <CardDescription>
              Valider crée la résidence, ses {requestBuildings(request).length} bâtiment(s) et ses{" "}
              {request.lots.length} lot(s). Le demandeur est prévenu par email.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {rejecting && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="req-reason">Motif du refus (envoyé au demandeur, facultatif)</Label>
                <textarea
                  id="req-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="rounded-lg border border-input px-3 py-2 text-sm"
                />
              </div>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              {rejecting ? (
                <>
                  <Button variant="outline" onClick={() => setRejecting(false)} disabled={busy}>
                    Annuler
                  </Button>
                  <Button variant="destructive" onClick={handleReject} disabled={busy}>
                    Confirmer le refus
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setRejecting(true)} disabled={busy}>
                    <X />
                    Refuser
                  </Button>
                  <Button onClick={handleApprove} disabled={busy || !accountUid} className={PRIMARY_CTA_CLASS}>
                    <Check />
                    Valider et créer la résidence
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  )
}

function BuildingsTab({ request }: { request: ResidenceRequest }) {
  const buildings = requestBuildings(request)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bâtiments</CardTitle>
        <CardDescription>Créés à la validation, dans cet ordre.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Lots</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {buildings.map((b) => (
              <TableRow key={b.label}>
                <TableCell>{b.type}</TableCell>
                <TableCell className="font-medium">{b.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {request.lots.filter((l) => l.batiment === b.label).length}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function LotsTab({ request }: { request: ResidenceRequest }) {
  const refs = useMemo(() => lotRefs(request.lots), [request.lots])
  const linkedCount = request.lots.filter((l) => l.parent).length
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lots</CardTitle>
        <CardDescription>
          {request.lots.length} lot(s){linkedCount ? `, dont ${linkedCount} rattaché(s) à un lot principal` : ""} ·
          tantièmes à 0 (offre gratuite).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bâtiment</TableHead>
              <TableHead>N°</TableHead>
              <TableHead>Référence</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Rattachable</TableHead>
              <TableHead>Rattaché à</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {request.lots.map((lot, i) => (
              <TableRow key={`${lot.batiment}|${lot.lot}`}>
                <TableCell>{lot.batiment}</TableCell>
                <TableCell className="font-medium">{lot.lot}</TableCell>
                <TableCell className="text-muted-foreground">{refs[i]}</TableCell>
                <TableCell>{lot.typeLot}</TableCell>
                <TableCell className="text-muted-foreground">
                  {defaultIsLinkableForType(lot.typeLot) ? "Oui" : "Non"}
                </TableCell>
                <TableCell>
                  {lot.parent ? `${lot.parent.batiment} · ${lot.parent.lot}` : <span className="text-muted-foreground">—</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} Ko` : `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`
}

function DocumentsTab({ request }: { request: ResidenceRequest }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const attachments = request.attachments ?? []

  async function open(attachment: ResidenceRequestAttachment) {
    try {
      window.open(await requestAttachmentUrl(attachment), "_blank", "noopener")
    } catch (err) {
      toast.error("Impossible d'ouvrir le document : " + (err as Error).message)
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) await addRequestAttachment(request, file)
      toast.success(files.length > 1 ? "Documents ajoutés" : "Document ajouté")
    } catch (err) {
      toast.error("Échec de l'ajout : " + (err as Error).message)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Documents</CardTitle>
        <CardDescription>
          Pièces qui donnent du contexte à la demande : règlement de copropriété, tantièmes, plan de masse… envoyées
          par le demandeur ou ajoutées ici (par exemple reçues par email).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun document pour l'instant.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Taille</TableHead>
                <TableHead>Ajouté par</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attachments.map((a) => (
                <TableRow key={a.path}>
                  <TableCell className="max-w-[360px] truncate font-medium">{a.name}</TableCell>
                  <TableCell className="text-muted-foreground">{formatSize(a.size)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {a.addedBy === "requester" ? "Demandeur (formulaire)" : "Backoffice"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => open(a)}>
                      <ExternalLink />
                      Ouvrir
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <div>
          <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
            <Upload />
            {uploading ? "Ajout en cours…" : "Ajouter des documents"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function emailTemplate(request: ResidenceRequest): string {
  return `Bonjour ${request.requester.firstName},\n\n\n\nL'équipe Konodal`
}

function ExchangesTab({ request, sentBy }: { request: ResidenceRequest; sentBy: string }) {
  const [subject, setSubject] = useState(`Votre demande d'inscription pour ${request.residence.name}`)
  const [body, setBody] = useState(() => emailTemplate(request))
  const [sending, setSending] = useState(false)
  const messages = [...(request.messages ?? [])].sort((a, b) => b.sentAt.toMillis() - a.sentAt.toMillis())

  async function handleSend() {
    if (!subject.trim() || !body.trim()) {
      toast.error("Objet et message requis")
      return
    }
    setSending(true)
    try {
      const sent = await sendRequestEmail(request, subject.trim(), body.trim(), sentBy)
      if (sent) {
        toast.success("Email envoyé au demandeur")
        setBody(emailTemplate(request))
      } else {
        toast.error("L'email n'a pas pu être envoyé (enregistré dans l'historique)")
      }
    } catch (err) {
      toast.error("Échec de l'envoi : " + (err as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Écrire au demandeur</CardTitle>
          <CardDescription>
            Pour obtenir des informations complémentaires. Envoyé à {request.requester.email || "—"} depuis
            support@konodal.com : sa réponse arrivera dans cette boîte.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mail-subject">Objet</Label>
            <Input id="mail-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mail-body">Message</Label>
            <textarea
              id="mail-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={9}
              className="rounded-lg border border-input px-3 py-2 text-sm leading-relaxed"
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSend} disabled={sending || !request.requester.email} className={PRIMARY_CTA_CLASS}>
              <Send />
              {sending ? "Envoi…" : "Envoyer"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historique</CardTitle>
          <CardDescription>Emails envoyés au demandeur depuis cette page.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {messages.length === 0 && <p className="text-sm text-muted-foreground">Aucun email envoyé pour l'instant.</p>}
          {messages.map((m) => (
            <div key={m.sentAt.toMillis()} className="rounded-xl border border-[oklch(93%_0.005_100)] p-4">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{m.subject}</span>
                <span className="text-xs text-muted-foreground">
                  {m.sentAt.toDate().toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                  {!m.emailSent && <span className="ml-2 text-destructive">non envoyé</span>}
                </span>
              </div>
              <p className="text-sm whitespace-pre-line text-muted-foreground">{m.body}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
