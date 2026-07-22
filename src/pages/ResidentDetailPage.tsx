import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { toast } from "sonner"
import { ArrowLeft, Ban, Check, Eye, FileText, RefreshCw, Save, X } from "lucide-react"
import { getDownloadURL, ref } from "firebase/storage"
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { storage, db } from "@/firebase"
import { useAccountRole } from "@/hooks/useAccountRole"
import { cn } from "@/lib/utils"
import {
  approveUserLot,
  rejectUser,
  setUserApproved,
  subscribeToUser,
  subscribeToUserDocuments,
  subscribeToUserLotDocuments,
  subscribeToUserLots,
  updateUserIdentity,
  type UserDocument,
  type UserLot,
} from "@/lib/users"
import type { KonodalUser } from "@/types/user"

export default function ResidentDetailPage() {
  const { uid } = useParams<{ uid: string }>()
  const { isSuperAdmin, isAgence } = useAccountRole()
  const [user, setUser] = useState<KonodalUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [documents, setDocuments] = useState<UserDocument[]>([])
  const [lots, setLots] = useState<UserLot[]>([])
  const [savingApproval, setSavingApproval] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [savingRejection, setSavingRejection] = useState(false)

  useEffect(() => {
    if (!uid) return
    setLoading(true)
    return subscribeToUser(
      uid,
      (data) => {
        setUser(data)
        setLoading(false)
      },
      (error) => {
        toast.error("Impossible de charger le résident : " + error.message)
        setLoading(false)
      }
    )
  }, [uid])

  useEffect(() => {
    if (!uid) return
    return subscribeToUserDocuments(
      uid,
      (data) => setDocuments(data),
      (error) => toast.error("Impossible de charger les documents : " + error.message)
    )
  }, [uid])

  useEffect(() => {
    if (!uid) return
    return subscribeToUserLots(
      uid,
      (data) => setLots(data),
      (error) => toast.error("Impossible de charger les lots : " + error.message)
    )
  }, [uid])

  if (!uid) return null

  async function handleToggleApproved() {
    if (!user) return
    setSavingApproval(true)
    try {
      await setUserApproved(user.uid, !user.isApproved)
      toast.success(user.isApproved ? "Identité révoquée" : "Identité approuvée")
    } catch (err) {
      toast.error("Échec de la mise à jour : " + (err as Error).message)
    } finally {
      setSavingApproval(false)
    }
  }

  async function handleReject() {
    if (!user || !rejectReason.trim()) return
    setSavingRejection(true)
    try {
      await rejectUser(user.uid, rejectReason.trim())
      toast.success("Identité refusée")
      setRejecting(false)
      setRejectReason("")
    } catch (err) {
      toast.error("Échec du refus : " + (err as Error).message)
    } finally {
      setSavingRejection(false)
    }
  }

  return (
    <div className="-mt-[20px] flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Link
          to="/residents"
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Utilisateurs
        </Link>
        <h1 className="text-2xl font-semibold">
          {user ? `${user.name} ${user.surname}`.trim() || user.email : loading ? "…" : "Résident introuvable"}
        </h1>
      </div>

      {!loading && !user && (
        <p className="text-muted-foreground">Ce compte n'existe pas ou a été supprimé.</p>
      )}

      {user && (
        <>
          <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
            <CardHeader>
              <CardTitle className="text-lg">Compte</CardTitle>
              <CardDescription>
                Vérifier les documents ci-dessous avant d'approuver l'accès à l'application.
              </CardDescription>
              <CardAction className="flex items-center gap-3">
                {user.isApproved ? (
                  <Badge variant="default">Identité approuvée</Badge>
                ) : user.rejectionReason ? (
                  <Badge variant="destructive">Refusée</Badge>
                ) : (
                  <Badge variant="outline" className="border-transparent bg-amber-100 text-amber-800">
                    En attente d'approbation
                  </Badge>
                )}
                {/* Validation d'identité (isApproved) réservée Superadmin -
                    ni Agence ni Agent, cf. matrice de droits BO : c'est une
                    vérification de pièce d'identité, pas une correction de
                    fiche courante. */}
                {isSuperAdmin && (
                  <Button
                    variant={user.isApproved ? "outline" : "default"}
                    size="sm"
                    disabled={savingApproval}
                    onClick={handleToggleApproved}
                  >
                    {user.isApproved ? <X /> : <Check />}
                    {user.isApproved ? "Révoquer l'identité" : "Approuver l'identité"}
                  </Button>
                )}
                {isSuperAdmin && !user.isApproved && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="bg-destructive text-white hover:bg-destructive/90"
                    onClick={() => setRejecting(true)}
                  >
                    <Ban />
                    Refuser
                  </Button>
                )}
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {user.rejectionReason && !user.isApproved && (
                <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  <span className="font-medium">Motif du refus : </span>
                  {user.rejectionReason}
                </div>
              )}
              <IdentityFields user={user} canEdit={isSuperAdmin || isAgence} />

              <div className="pr-[20px] flex flex-col gap-2 pt-[22px] pb-[20px]">
                <Label className="mb-[20px]">Document(s)</Label>
                {documents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun document déposé.</p>
                ) : (
                  documents.map((document) => <DocumentRow key={document.id} document={document} />)
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
            <CardHeader>
              <CardTitle className="text-lg">Lots</CardTitle>
              <CardDescription>
                {user.isApproved
                  ? "Rattachement propriétaire/locataire à valider par lot."
                  : "Approuve d'abord l'identité ci-dessus pour pouvoir valider les lots."}
              </CardDescription>
            </CardHeader>
            <CardContent
              className={cn(
                "flex flex-col gap-2",
                !user.isApproved && "pointer-events-none opacity-50"
              )}
            >
              {lots.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucun lot rattaché à ce compte.</p>
              )}
              {lots.map((lot) => (
                <LotRow
                  key={lot.id}
                  uid={uid}
                  lot={lot}
                  userApproved={user.isApproved}
                  canApprove={isSuperAdmin || isAgence}
                />
              ))}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={rejecting} onOpenChange={setRejecting}>
        <DialogContent className="sm:max-w-md">
          <div className="flex max-h-[calc(100vh-3rem)] min-w-0 flex-col gap-4">
            <DialogHeader className="pb-4">
              <DialogTitle>Refuser l'identité</DialogTitle>
            </DialogHeader>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden pr-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reject-reason">Motif du refus</Label>
                <textarea
                  id="reject-reason"
                  required
                  rows={4}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Ex : pièce d'identité illisible, document expiré…"
                  className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
                <p className="text-xs text-muted-foreground">
                  Ce motif sera visible par le résident dans l'application.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="destructive"
                className="bg-destructive text-white hover:bg-destructive/90"
                disabled={savingRejection || !rejectReason.trim()}
                onClick={handleReject}
              >
                <Ban />
                Confirmer le refus
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function toDateInputValue(date: Date | null): string {
  if (!date) return ""
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

// Champs corrigibles par un admin en cas d'erreur de reconnaissance (OCR à
// l'inscription) - tout sauf l'email, identifiant du compte Firebase Auth.
// canEdit=false (Agent) : consultation seule, cf. matrice de droits BO -
// une Agence garde le droit de correction, pas un simple Agent.
function IdentityFields({ user, canEdit }: { user: KonodalUser; canEdit: boolean }) {
  const [name, setName] = useState(user.name)
  const [surname, setSurname] = useState(user.surname)
  const [phone, setPhone] = useState(user.phone)
  const [birthday, setBirthday] = useState(toDateInputValue(user.birthday))
  const [sex, setSex] = useState(user.sex)
  const [nationality, setNationality] = useState(user.nationality)
  const [placeOfborn, setPlaceOfborn] = useState(user.placeOfborn)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(user.name)
    setSurname(user.surname)
    setPhone(user.phone)
    setBirthday(toDateInputValue(user.birthday))
    setSex(user.sex)
    setNationality(user.nationality)
    setPlaceOfborn(user.placeOfborn)
  }, [user.uid])

  async function handleSave() {
    setSaving(true)
    try {
      await updateUserIdentity(user.uid, {
        name,
        surname,
        phone,
        sex,
        nationality,
        placeOfborn,
        birthday: birthday ? new Date(birthday) : null,
      })
      toast.success("Identité mise à jour")
    } catch (err) {
      toast.error("Échec de l'enregistrement : " + (err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className={cn("grid gap-3 text-sm sm:grid-cols-2", !canEdit && "pointer-events-none opacity-50")}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="identity-email">Email</Label>
          <Input id="identity-email" value={user.email} disabled />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="identity-phone">Téléphone</Label>
          <Input id="identity-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="identity-name">Prénom</Label>
          <Input id="identity-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="identity-surname">Nom</Label>
          <Input id="identity-surname" value={surname} onChange={(e) => setSurname(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="identity-birthday">Date de naissance</Label>
          <Input
            id="identity-birthday"
            type="date"
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="identity-sex">Sexe</Label>
          <Input id="identity-sex" value={sex} onChange={(e) => setSex(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="identity-nationality">Nationalité</Label>
          <Input
            id="identity-nationality"
            value={nationality}
            onChange={(e) => setNationality(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="identity-placeofborn">Lieu de naissance</Label>
          <Input
            id="identity-placeofborn"
            value={placeOfborn}
            onChange={(e) => setPlaceOfborn(e.target.value)}
          />
        </div>
      </div>

      <p className="text-sm">
        <span className="text-muted-foreground">Infos confirmées par l'utilisateur : </span>
        {user.isInfoCorrect ? "Oui" : "Non"}
      </p>

      {canEdit && (
        <div className="mb-[20px] flex justify-end">
          <Button size="sm" disabled={saving} onClick={handleSave}>
            <Save />
            Enregistrer les modifications
          </Button>
        </div>
      )}
    </div>
  )
}

function DocumentRow({ document }: { document: UserDocument }) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!document.documentPathRecto) return
    getDownloadURL(ref(storage, document.documentPathRecto))
      .then((resolved) => {
        if (!cancelled) setUrl(resolved)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [document.documentPathRecto])

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
      <div className="flex items-center gap-2 text-sm">
        <FileText className="size-4 text-muted-foreground" />
        <span className="font-medium">{document.type || document.name || "Document"}</span>
      </div>
      {url ? (
        <Button variant="outline" size="sm" render={<a href={url} target="_blank" rel="noreferrer" />}>
          <Eye />
          Ouvrir
        </Button>
      ) : (
        <span className="text-xs text-muted-foreground">
          {error ? "Fichier introuvable" : "Chargement…"}
        </span>
      )}
    </div>
  )
}

function LotRow({
  uid,
  lot,
  userApproved,
  canApprove,
}: {
  uid: string
  lot: UserLot
  userApproved: boolean
  // Approuver/actualiser l'accès à un lot (isApprovedLot) réservé
  // Superadmin/Agence - un simple Agent reste en lecture seule, cf.
  // matrice de droits BO (même logique que isApproved sur l'identité, en
  // moins strict : ici une Agence gérance/syndic garde la main).
  canApprove: boolean
}) {
  const [residenceName, setResidenceName] = useState<string | null>(null)
  const [lotInfo, setLotInfo] = useState<{ refLot: string; batiment: string; lot: string } | null>(
    null
  )
  const [parentLotInfo, setParentLotInfo] = useState<{
    refLot: string
    batiment: string
    lot: string
  } | null>(null)
  const [resolvedStatut, setResolvedStatut] = useState<string | null>(null)
  const [groupedChildren, setGroupedChildren] = useState<
    { id: string; refLot: string; batiment: string; lot: string }[]
  >([])
  const [approving, setApproving] = useState(false)
  const [documents, setDocuments] = useState<UserDocument[]>([])

  useEffect(() => {
    if (!lot.residenceId) return
    getDoc(doc(db, "residences", lot.residenceId)).then((snap) => {
      setResidenceName(snap.exists() ? ((snap.data().name as string) ?? null) : null)
    })
  }, [lot.residenceId])

  useEffect(() => {
    if (!lot.residenceId) return
    // Un lot enfant "groupé" (groupedWithParent) n'a jamais son propre
    // document users/{uid}/lots : son attribution est entièrement portée
    // par le lot parent (idProprietaire/idLocataire recopiés dessus par
    // sync_lot_tenants), il est volontairement masqué des listes "mes
    // biens" côté app. Sans cette requête dédiée côté résidence, ce lot
    // n'apparaîtrait donc nulle part dans la fiche.
    const childrenQuery = query(
      collection(db, "residences", lot.residenceId, "lots"),
      where("parentLotId", "==", lot.id),
      where("groupedWithParent", "==", true)
    )
    getDocs(childrenQuery).then((snapshot) => {
      setGroupedChildren(
        snapshot.docs.map((d) => ({
          id: d.id,
          refLot: (d.data().refLot as string) ?? "",
          batiment: (d.data().batiment as string) ?? "",
          lot: (d.data().lot as string) ?? "",
        }))
      )
    })
  }, [lot.residenceId, lot.id])

  useEffect(() => {
    if (!lot.residenceId) return
    // refLot/batiment identifient le lot sans ambiguïté (contrairement à
    // nameLot, un simple surnom choisi par le résident) - utile quand deux
    // users/{uid}/lots pointent vers des lots liés (parent/enfant) mais
    // distincts. Si ce lot est un enfant (parentLotId renseigné), le lot
    // parent auquel il est rattaché n'a pas forcément son propre document
    // users/{uid}/lots (un enfant groupé est masqué des listes "mes biens"
    // côté app, cf. mémoire du domain model) : on va donc aussi chercher ses
    // informations pour ne pas perdre cette moitié de l'attribution.
    setParentLotInfo(null)
    getDoc(doc(db, "residences", lot.residenceId, "lots", lot.id)).then((snap) => {
      if (!snap.exists()) return
      const data = snap.data()
      setLotInfo({
        refLot: (data.refLot as string) ?? "",
        batiment: (data.batiment as string) ?? "",
        lot: (data.lot as string) ?? "",
      })
      // Filet de secours : un lot enfant groupé (groupedWithParent) peut
      // avoir son statutResident absent côté users/{uid}/lots selon la
      // façon dont son attribution a été synchronisée - on le déduit alors
      // directement de idProprietaire/idLocataire côté résidence, la
      // source de vérité réelle de l'attribution.
      const idProprietaire = (data.idProprietaire as string[] | undefined) ?? []
      const idLocataire = (data.idLocataire as string[] | undefined) ?? []
      if (idProprietaire.includes(uid)) setResolvedStatut("Propriétaire")
      else if (idLocataire.includes(uid)) setResolvedStatut("Locataire")
      const parentLotId = data.parentLotId as string | undefined
      if (!parentLotId) return
      getDoc(doc(db, "residences", lot.residenceId, "lots", parentLotId)).then((parentSnap) => {
        if (!parentSnap.exists()) return
        const parentData = parentSnap.data()
        setParentLotInfo({
          refLot: (parentData.refLot as string) ?? "",
          batiment: (parentData.batiment as string) ?? "",
          lot: (parentData.lot as string) ?? "",
        })
      })
    })
  }, [lot.residenceId, lot.id, uid])

  useEffect(() => {
    return subscribeToUserLotDocuments(
      uid,
      lot.id,
      (data) => setDocuments(data),
      (error) => toast.error("Impossible de charger les documents du lot : " + error.message)
    )
  }, [uid, lot.id])

  async function handleApprove() {
    setApproving(true)
    try {
      await approveUserLot(uid, lot.id)
      toast.success("Lot approuvé")
    } catch (err) {
      toast.error("Échec de l'approbation : " + (err as Error).message)
    } finally {
      setApproving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col text-sm">
          <span className="font-medium">
            {residenceName ?? lot.residenceId}
            {lotInfo?.batiment ? ` — ${lotInfo.batiment}` : ""}
            {lotInfo?.lot ? ` — ${lotInfo.lot}` : ""}
          </span>
          <span className="pl-3 text-muted-foreground">
            {lotInfo?.refLot ? `Réf. ${lotInfo.refLot}` : "—"}
          </span>
          {parentLotInfo && (
            <span className="text-muted-foreground">
              Rattaché à{parentLotInfo.batiment ? ` ${parentLotInfo.batiment}` : ""}
              {parentLotInfo.lot ? ` — ${parentLotInfo.lot}` : ""}
              {parentLotInfo.refLot ? ` · Réf. ${parentLotInfo.refLot}` : ""}
            </span>
          )}
        </div>
        <div className="flex-1 text-center text-sm text-muted-foreground">
          {lot.statutResident || resolvedStatut || "—"}
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={lot.isApprovedLot ? "default" : "destructive"}>
            {lot.isApprovedLot ? "Approuvé" : "En attente"}
          </Badge>
          {canApprove && (
            <Button
              variant="outline"
              size="sm"
              disabled={approving || !userApproved}
              title={!userApproved ? "Approuve d'abord l'identité pour que la synchronisation fonctionne" : undefined}
              onClick={handleApprove}
            >
              {lot.isApprovedLot ? <RefreshCw /> : <Check />}
              {lot.isApprovedLot ? "Actualiser" : "Approuver"}
            </Button>
          )}
        </div>
      </div>

      {groupedChildren.length > 0 && (
        <div className="flex flex-col gap-1 border-t pt-3 text-sm">
          <span className="font-medium text-muted-foreground">Lots groupés avec celui-ci</span>
          {groupedChildren.map((child) => (
            <span key={child.id} className="pl-3 text-muted-foreground">
              {child.batiment || child.id}
              {child.lot ? ` — ${child.lot}` : ""}
              {child.refLot ? ` · Réf. ${child.refLot}` : ""}
            </span>
          ))}
        </div>
      )}

      <div className="pr-[20px] flex flex-col gap-2 pt-[22px] pb-[20px]">
        <Label className="mb-[20px]">Document(s)</Label>
        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun document déposé pour ce lot.</p>
        ) : (
          documents.map((document) => <DocumentRow key={document.id} document={document} />)
        )}
      </div>
    </div>
  )
}
