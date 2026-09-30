import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { ArrowLeft, Ban, BadgeCheck, Check, Eye, Home, ImageOff, PlusCircle, Play, Save, Trash2, Unlink } from "lucide-react"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { db } from "@/firebase"
import { CertificationRequestCard } from "@/components/CertificationRequestCard"
import { useAccountRole } from "@/hooks/useAccountRole"
import { useScopedResidenceIds } from "@/hooks/useScopedResidenceIds"
import { useSinistreMedia } from "@/hooks/useSinistreMedia"
import { cn, PRIMARY_CTA_CLASS } from "@/lib/utils"
import { subscribeToResidences } from "@/lib/residences"
import { subscribeToLots, grantLotRole, revokeLotRole, type LotRole } from "@/lib/lots"
import {
  approveUserLot,
  deleteUserAccount,
  rejectUser,
  setUserApproved,
  setUserCertified,
  subscribeToUser,
  subscribeToUserDocuments,
  subscribeToUserLotDocuments,
  subscribeToUserLots,
  updateUserIdentity,
  updateUserPhone,
  type UserDocument,
  type UserLot,
} from "@/lib/users"
import type { KonodalUser } from "@/types/user"
import type { Residence } from "@/types/residence"
import type { Lot } from "@/types/lot"

function initialsFor(nameOrEmail: string): string {
  const parts = nameOrEmail.trim().split(/\s+/)
  if (parts.length >= 2 && parts[0] && parts[1]) return (parts[0][0] + parts[1][0]).toUpperCase()
  return (nameOrEmail[0] ?? "?").toUpperCase()
}

export default function ResidentDetailPage() {
  const { uid } = useParams<{ uid: string }>()
  const navigate = useNavigate()
  const { isSuperAdmin, isAgence } = useAccountRole()
  const { scopedResidenceIds, loading: scopeLoading } = useScopedResidenceIds()
  const [user, setUser] = useState<KonodalUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [lots, setLots] = useState<UserLot[]>([])
  const [identityDocuments, setIdentityDocuments] = useState<UserDocument[]>([])
  const [savingApproval, setSavingApproval] = useState(false)
  const [savingCertification, setSavingCertification] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [savingRejection, setSavingRejection] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [addingLot, setAddingLot] = useState(false)
  const [addResidences, setAddResidences] = useState<Residence[]>([])
  const [addResidenceId, setAddResidenceId] = useState("")
  const [addLots, setAddLots] = useState<Lot[]>([])
  const [addLotId, setAddLotId] = useState("")
  const [addRole, setAddRole] = useState<LotRole>("Propriétaire")
  const [addingSaving, setAddingSaving] = useState(false)

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
    // users/{uid}/documents (pièce d'identité déposée à l'inscription) n'est
    // lisible que par isSuperAdmin côté firestore.rules - souscrire sans ce
    // garde renverrait une erreur de permission pour Agence/Agent, qui
    // consultent pourtant cette fiche (identité en lecture seule pour eux).
    if (!uid || !isSuperAdmin) return
    return subscribeToUserDocuments(
      uid,
      (data) => setIdentityDocuments(data),
      (error) => toast.error("Impossible de charger la pièce d'identité : " + error.message)
    )
  }, [uid, isSuperAdmin])

  useEffect(() => {
    // Attend la résolution du périmètre (agence/agent) avant de souscrire :
    // Firestore exige un where("residenceId","in",...) pour que
    // isProfessionnelResidence autorise cette lecture (cf. lib/users.ts,
    // subscribeToUserLots) - interroger trop tôt sans ce filtre échouerait.
    if (!uid || scopeLoading) return
    return subscribeToUserLots(
      uid,
      (data) => setLots(data),
      (error) => toast.error("Impossible de charger les lots : " + error.message),
      scopedResidenceIds ? [...scopedResidenceIds] : scopedResidenceIds
    )
  }, [uid, scopeLoading, scopedResidenceIds])

  // Résidences/lots du dialogue "Ajouter un lot" - chargés seulement une
  // fois le dialogue ouvert (pas de fan-out permanent sur toutes les
  // résidences pour une fiche résident qui n'en a pas besoin par défaut).
  useEffect(() => {
    if (!addingLot) return
    return subscribeToResidences(
      (data) => setAddResidences(data),
      (error) => toast.error("Impossible de charger les résidences : " + error.message)
    )
  }, [addingLot])

  useEffect(() => {
    if (!addResidenceId) {
      setAddLots([])
      return
    }
    return subscribeToLots(
      addResidenceId,
      // Un lot enfant groupé (groupedWithParent) a son attribution
      // entièrement mirroir de son parent (cf. sync_lot_tenants côté
      // konodal_app) - lui attribuer un propriétaire/locataire directement
      // ici serait écrasé au prochain écrit du parent, donc exclu du choix.
      (data) => setAddLots(data.filter((l) => !l.groupedWithParent)),
      (error) => toast.error("Impossible de charger les lots : " + error.message)
    )
  }, [addResidenceId])

  if (!uid) return null

  const canApproveLots = isSuperAdmin || isAgence
  const pendingLots = lots.filter((lot) => !lot.isApprovedLot)
  // Lots en attente en tête : c'est l'action à mener sur la fiche.
  const sortedLots = [...pendingLots, ...lots.filter((lot) => lot.isApprovedLot)]

  // Un compte refusé est gelé : plus aucune modification (identité,
  // téléphone, statut) tant qu'une nouvelle soumission n'est pas faite
  // depuis l'application (qui remet isApproved/rejectionReason à zéro, cf.
  // submit_user.dart) - évite qu'une correction silencieuse côté BO
  // maquille un refus sans repasser par une vraie resoumission.
  const isRejected = !!user && !user.isApproved && !!user.rejectionReason

  // N'approuve plus que dans un sens (le bouton n'est visible que pour un
  // compte non certifié, cf. plus bas) - bloquer se fait exclusivement via
  // "Bloquer" (motif obligatoire), jamais ce toggle.
  async function handleApprove() {
    if (!user) return
    setSavingApproval(true)
    try {
      await setUserApproved(user.uid, true)
      toast.success("Identité approuvée")
    } catch (err) {
      toast.error("Échec de la mise à jour : " + (err as Error).message)
    } finally {
      setSavingApproval(false)
    }
  }

  async function handleToggleCertified() {
    if (!user) return
    setSavingCertification(true)
    try {
      await setUserCertified(user.uid, !user.isCertified)
      toast.success(user.isCertified ? "Certification retirée" : "Identité certifiée")
    } catch (err) {
      toast.error("Échec de la mise à jour : " + (err as Error).message)
    } finally {
      setSavingCertification(false)
    }
  }

  async function handleReject() {
    if (!user || !rejectReason.trim()) return
    setSavingRejection(true)
    try {
      await rejectUser(user.uid, rejectReason.trim())
      toast.success("Identité bloquée")
      setRejecting(false)
      setRejectReason("")
    } catch (err) {
      toast.error("Échec du blocage : " + (err as Error).message)
    } finally {
      setSavingRejection(false)
    }
  }

  async function handleDeleteAccount() {
    if (!user) return
    setDeleting(true)
    try {
      await deleteUserAccount(user.uid)
      toast.success("Compte supprimé")
      navigate("/residents")
    } catch (err) {
      toast.error("Échec de la suppression : " + (err as Error).message)
      setDeleting(false)
    }
  }

  async function handleAddLot() {
    if (!uid || !addResidenceId || !addLotId) return
    setAddingSaving(true)
    try {
      await grantLotRole(addResidenceId, addLotId, uid, addRole)
      toast.success("Lot rattaché")
      setAddingLot(false)
      setAddResidenceId("")
      setAddLotId("")
      setAddRole("Propriétaire")
    } catch (err) {
      toast.error("Échec du rattachement : " + (err as Error).message)
    } finally {
      setAddingSaving(false)
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
        {!user && <h1 className="text-2xl font-extrabold tracking-tight text-[oklch(22%_0.01_150)]">{loading ? "…" : "Résident introuvable"}</h1>}
      </div>

      {!loading && !user && (
        <p className="text-muted-foreground">Ce compte n'existe pas ou a été supprimé.</p>
      )}

      {user && (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex size-[52px] shrink-0 items-center justify-center rounded-2xl bg-[oklch(93%_0.05_150)] text-lg font-extrabold text-[oklch(32%_0.09_155)]">
              {initialsFor(`${user.name} ${user.surname}`.trim() || user.email)}
            </div>
            <div className="min-w-[200px] flex-1">
              <h1 className="flex items-center gap-1.5 text-2xl font-extrabold tracking-tight text-[oklch(22%_0.01_150)]">
                {`${user.name} ${user.surname}`.trim() || user.email}
                {/* Statut à part de isApproved ci-dessous - vérification
                    manuelle de la pièce d'identité ET des données, jamais
                    posée automatiquement, cf. lib/users.ts setUserCertified. */}
                {user.isCertified && (
                  <span title="Identité certifiée">
                    <BadgeCheck className="size-5 shrink-0 fill-blue-500 text-white" />
                  </span>
                )}
              </h1>
              <div className="mt-0.5 text-[13px] text-[oklch(52%_0.01_150)]">{user.email}</div>
            </div>
            {/* Vocabulaire aligné sur ResidentsPage (colonne Statut) - depuis
                que isApproved n'est plus un prérequis d'accès à l'app
                (compte créé approuvé par défaut, cf. types/user.ts),
                "En attente d'approbation" laissait croire à un blocage qui
                n'existe plus : ce n'est qu'une certification optionnelle. */}
            {user.isApproved ? (
              <Badge variant="default" className="gap-1.5 rounded-full">
                Validé
              </Badge>
            ) : user.rejectionReason ? (
              <Badge variant="destructive" className="gap-1.5 rounded-full">
                Bloquée
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1.5 rounded-full border-transparent bg-amber-100 text-amber-800">
                <span className="size-[6px] rounded-full bg-current" />
                Non certifiée
              </Badge>
            )}
            {/* Suppression de compte réservée superAdmin (comme côté serveur,
                cf. requireSuperAdmin dans adminDeleteUser) - action
                irréversible (Auth + toutes les données via cleanupUserData),
                séparée visuellement des actions de validation d'identité. */}
            {isSuperAdmin && (
              <Button
                variant="outline"
                size="sm"
                className="ml-auto border-red-200 text-red-700 hover:bg-red-50"
                onClick={() => setDeletingAccount(true)}
              >
                <Trash2 />
                Supprimer le compte
              </Button>
            )}
          </div>

          {/* Depuis que isApproved est posé automatiquement à l'inscription
              (cf. types/user.ts), la seule action réellement en attente sur
              une fiche est la validation d'un lot (isApprovedLot) - sans ce
              bandeau, elle n'apparaissait qu'en bas de page. */}
          {canApproveLots && pendingLots.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-[14px] border border-amber-200 bg-amber-50 p-[12px_16px] text-sm text-amber-900">
              <Home className="size-4 shrink-0" />
              <span className="flex-1">
                <span className="font-semibold">
                  {pendingLots.length === 1
                    ? "1 demande de lot en attente de validation"
                    : `${pendingLots.length} demandes de lot en attente de validation`}
                </span>
                {" "}— vérifier le justificatif puis approuver.
              </span>
              <Button
                variant="outline"
                size="sm"
                className="border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
                onClick={() => document.getElementById("lots")?.scrollIntoView({ behavior: "smooth" })}
              >
                Voir les lots
              </Button>
            </div>
          )}

          <div className={cn("grid gap-5", isSuperAdmin ? "lg:grid-cols-[1.7fr_1fr]" : "grid-cols-1")}>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Informations du compte</CardTitle>
                <CardDescription>
                  Vérifier la pièce d'identité ci-contre avant d'approuver l'accès à l'application.
                </CardDescription>
                <CardAction className="flex items-center gap-2">
                  {/* Validation d'identité (isApproved) réservée Superadmin -
                      ni Agence ni Agent, cf. matrice de droits BO : c'est une
                      vérification de pièce d'identité, pas une correction de
                      fiche courante. Visible uniquement pour un compte non
                      certifié (ni déjà approuvé, ni bloqué) - une fois
                      approuvé, seul "Bloquer" (avec motif) permet de revenir
                      en arrière, jamais ce toggle muet (cf. discussion :
                      "Révoquer" bloquait sans motif, faisait doublon avec
                      Bloquer). Masqué une fois bloqué (isRejected) : plus
                      aucune action possible tant qu'une nouvelle soumission
                      n'arrive pas de l'application. */}
                  {isSuperAdmin && !isRejected && !user.isApproved && (
                    <Button
                      variant="default"
                      size="sm"
                      disabled={savingApproval}
                      onClick={handleApprove}
                      className={PRIMARY_CTA_CLASS}
                    >
                      <Check />
                      Approuver l'identité
                    </Button>
                  )}
                  {isSuperAdmin && !isRejected && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-red-200 text-red-700 hover:bg-red-50"
                      onClick={() => setRejecting(true)}
                    >
                      <Ban />
                      Bloquer
                    </Button>
                  )}
                  {/* Certification : statut à part de isApproved ci-dessus
                      (cf. types/user.ts) - toujours disponible, jamais gelée
                      par isRejected (une certification déjà accordée reste
                      un fait vérifié, indépendant d'un blocage ultérieur
                      pour un autre motif). */}
                  {isSuperAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={savingCertification}
                      onClick={handleToggleCertified}
                      className={
                        user.isCertified
                          ? undefined
                          : "border-blue-200 text-blue-700 hover:bg-blue-50"
                      }
                    >
                      <Check />
                      {user.isCertified ? "Retirer la certification" : "Certifier l'identité"}
                    </Button>
                  )}
                </CardAction>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {isRejected && (
                  <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                    <span className="font-medium">Motif du blocage : </span>
                    {user.rejectionReason}
                    <p className="mt-1.5 text-xs text-destructive/80">
                      Fiche gelée : plus aucune modification possible tant que ce compte n'a pas resoumis son
                      inscription depuis l'application.
                    </p>
                  </div>
                )}
                {/* Identité (nom/prénom/date de naissance/pièce...) réservée
                    superAdmin - une Agence reste en lecture seule ici, même
                    traitement qu'un Agent (correction d'une identité mal
                    reconnue = action superAdmin, distincte de la gestion de
                    ses propres lots/agents). locked (isRejected) prime sur
                    canEdit : gèle aussi le téléphone, éditable par
                    Agence/Agent en temps normal. */}
                <IdentityFields user={user} canEdit={isSuperAdmin} locked={isRejected} />
              </CardContent>
            </Card>

            {/* Carte séparée plutôt qu'empilée dans "Compte" : la pièce
                d'identité se consulte d'un coup d'œil pendant qu'on corrige
                les champs à gauche, pas en scrollant au-dessus. Même
                restriction de lecture que la sous-collection Firestore dont
                elle dépend (cf. l'useEffect de subscribeToUserDocuments) -
                absente pour Agence/Agent, pas juste vide. */}
            {/* Demande de certification envoyée depuis l'app (pièce +
                selfie + score de ressemblance), décision Super Admin. */}
            {isSuperAdmin && <CertificationRequestCard uid={user.uid} isCertified={user.isCertified} />}

            {isSuperAdmin && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Pièce d'identité</CardTitle>
                </CardHeader>
                <CardContent>
                  <IdentityDocuments documents={identityDocuments} />
                </CardContent>
              </Card>
            )}
          </div>

          <div id="lots" className="flex scroll-mt-6 flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold">Lots</h2>
                <p className="text-sm text-muted-foreground">
                  {user.isApproved
                    ? "Rattachement propriétaire/locataire à valider par lot."
                    : "Approuve d'abord l'identité ci-dessus pour pouvoir valider les lots."}
                </p>
              </div>
              {/* Rattacher un lot écrit directement idProprietaire/
                  idLocataire côté résidence (cf. lib/lots.ts, grantLotRole) -
                  réservé isSuperAdmin côté firestore.rules, jamais ouvert à
                  Agence/Agent sur ce champ précis (contrairement à
                  isApprovedLot, cf. canApprove plus bas). */}
              {isSuperAdmin && (
                <Button variant="outline" size="sm" onClick={() => setAddingLot(true)}>
                  <PlusCircle />
                  Ajouter un lot
                </Button>
              )}
            </div>
            <div
              className={cn(
                "flex flex-col gap-2",
                !user.isApproved && "pointer-events-none opacity-50"
              )}
            >
              {lots.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucun lot rattaché à ce compte.</p>
              )}
              {sortedLots.map((lot) => (
                <LotRow
                  key={lot.id}
                  uid={uid}
                  lot={lot}
                  userLotIds={lots.map((l) => l.id)}
                  userApproved={user.isApproved}
                  canApprove={canApproveLots}
                  canRevoke={isSuperAdmin}
                />
              ))}
            </div>
          </div>
        </>
      )}

      <Dialog open={rejecting} onOpenChange={setRejecting}>
        <DialogContent className="sm:max-w-md">
          <div className="flex max-h-[calc(100vh-3rem)] min-w-0 flex-col gap-4">
            <DialogHeader className="border-b border-[oklch(95%_0.003_100)] pb-4">
              <span className="text-[11.5px] font-bold tracking-wide text-primary uppercase">Identité</span>
              <DialogTitle>Bloquer l'identité</DialogTitle>
            </DialogHeader>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden pr-4 pl-[5px]">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reject-reason">Motif du blocage</Label>
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
              <Button type="button" variant="outline" onClick={() => setRejecting(false)}>
                Annuler
              </Button>
              <Button
                variant="destructive"
                className="bg-destructive text-white hover:bg-destructive/90"
                disabled={savingRejection || !rejectReason.trim()}
                onClick={handleReject}
              >
                <Ban />
                Confirmer le blocage
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deletingAccount} onOpenChange={setDeletingAccount}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <span className="text-[11.5px] font-bold tracking-wide text-destructive uppercase">Compte</span>
            <DialogTitle>Supprimer ce compte ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Cette action est irréversible : le compte{" "}
            <strong>{`${user?.name ?? ""} ${user?.surname ?? ""}`.trim() || user?.email}</strong> et toutes ses
            données (identité, documents, lots, annonces, commentaires…) seront définitivement supprimés.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeletingAccount(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deleting}
              onClick={handleDeleteAccount}
            >
              <Trash2 />
              Supprimer définitivement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addingLot} onOpenChange={setAddingLot}>
        <DialogContent className="sm:max-w-md">
          <div className="flex max-h-[calc(100vh-3rem)] min-w-0 flex-col gap-4">
            <DialogHeader className="border-b border-[oklch(95%_0.003_100)] pb-4">
              <span className="text-[11.5px] font-bold tracking-wide text-primary uppercase">Lots</span>
              <DialogTitle>Ajouter un lot</DialogTitle>
            </DialogHeader>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden pr-4 pl-[5px]">
              <div className="flex flex-col gap-1.5">
                <Label>Résidence</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 text-left text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
                    {addResidences.find((r) => r.id === addResidenceId)?.name ?? "Choisir une résidence…"}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-72">
                    <DropdownMenuRadioGroup
                      value={addResidenceId}
                      onValueChange={(v) => {
                        setAddResidenceId(v)
                        setAddLotId("")
                      }}
                    >
                      {addResidences.map((r) => (
                        <DropdownMenuRadioItem key={r.id} value={r.id}>
                          {r.name}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Lot</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    disabled={!addResidenceId}
                    className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 text-left text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                  >
                    {addLots.find((l) => l.id === addLotId)
                      ? [addLots.find((l) => l.id === addLotId)?.batiment, addLots.find((l) => l.id === addLotId)?.lot]
                          .filter(Boolean)
                          .join(" — ")
                      : "Choisir un lot…"}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-72">
                    <DropdownMenuRadioGroup value={addLotId} onValueChange={setAddLotId}>
                      {addLots.map((l) => (
                        <DropdownMenuRadioItem key={l.id} value={l.id}>
                          {[l.batiment, l.lot].filter(Boolean).join(" — ") || l.refLot || l.id}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Rôle</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 text-left text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
                    {addRole}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-72">
                    <DropdownMenuRadioGroup value={addRole} onValueChange={(v) => setAddRole(v as LotRole)}>
                      <DropdownMenuRadioItem value="Propriétaire">Propriétaire</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="Locataire">Locataire</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddingLot(false)}>
                Annuler
              </Button>
              <Button
                disabled={addingSaving || !addResidenceId || !addLotId}
                onClick={handleAddLot}
                className={PRIMARY_CTA_CLASS}
              >
                <PlusCircle />
                Rattacher
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
function IdentityFields({
  user,
  canEdit,
  locked,
}: {
  user: KonodalUser
  canEdit: boolean
  locked?: boolean
}) {
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

  // Le téléphone reste modifiable par Agence/Agent même sans le reste
  // (correction d'un numéro erroné = besoin courant, pas une correction
  // d'identité) - écrit isolément (profil.phone uniquement), jamais via
  // updateUserIdentity qui toucherait aussi user.* hors de portée pour eux.
  async function handleSavePhone() {
    setSaving(true)
    try {
      await updateUserPhone(user.uid, phone)
      toast.success("Téléphone mis à jour")
    } catch (err) {
      toast.error("Échec de l'enregistrement : " + (err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className={cn("grid gap-3 text-sm sm:grid-cols-2", locked && "pointer-events-none opacity-50")}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="identity-email">Email</Label>
          <Input id="identity-email" value={user.email} disabled />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="identity-phone">Téléphone</Label>
          <Input id="identity-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>

      {/* Le reste de l'identité (nom/prénom/date de naissance/pièce...)
          reste réservé superAdmin - seul le téléphone ci-dessus est
          modifiable par Agence/Agent. locked (compte refusé) prime sur
          canEdit : gèle tout le monde, superAdmin compris. */}
      <div className={cn("grid gap-3 text-sm sm:grid-cols-2", (!canEdit || locked) && "pointer-events-none opacity-50")}>
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

      {!locked && (
        <div className="mb-[20px] flex justify-end">
          <Button size="sm" disabled={saving} onClick={canEdit ? handleSave : handleSavePhone} className={PRIMARY_CTA_CLASS}>
            <Save />
            {canEdit ? "Enregistrer les modifications" : "Enregistrer le téléphone"}
          </Button>
        </div>
      )}
    </div>
  )
}

function IdentityDocuments({ documents }: { documents: UserDocument[] }) {
  return (
    <div className="flex flex-col items-center gap-4">
      {documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune pièce d'identité déposée.</p>
      ) : (
        documents.map((document) => (
          <div key={document.id} className="flex flex-col items-center gap-1.5">
            {document.type && (
              <span className="text-xs font-medium text-muted-foreground">{document.type}</span>
            )}
            <div className="flex flex-col items-center gap-3">
              <DocumentThumbnail path={document.documentPathRecto} label="Recto" />
              {document.documentPathVerso && (
                <DocumentThumbnail path={document.documentPathVerso} label="Verso" />
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

// Vignette cliquable ouvrant l'original en overlay (Dialog), pas dans un
// nouvel onglet : une pièce d'identité ou un justificatif de lot se vérifie
// sans quitter la fiche en cours d'examen. Un PDF (justificatif de
// domicile, bail...) est rendu dans une <iframe> - aperçu de la première
// page en vignette, document complet dans le Dialog.
function DocumentThumbnail({ path, label }: { path: string; label: string }) {
  const state = useSinistreMedia(path)
  const url = state.status === "ready" ? state.url : undefined
  const isPdf = state.status === "ready" && state.isPdf
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        disabled={!url}
        onClick={() => setOpen(true)}
        className="flex max-w-64 flex-col items-center gap-1.5 disabled:cursor-default"
      >
        {state.status === "ready" && !state.isVideo && !state.isPdf ? (
          // Pas de hauteur fixée ni object-cover : la vignette suit le ratio
          // réel du document (portrait ou paysage selon la pièce déposée)
          // plutôt que de le rogner dans une boîte imposée. Pas de w-full non
          // plus : sans ça l'image s'étirerait jusqu'au plafond max-w-64 même
          // sur un document naturellement plus étroit, au lieu de rester à sa
          // taille réelle et centrée (cf. items-center sur les parents).
          <img src={state.url} alt={label} className="max-w-full rounded-lg border" />
        ) : isPdf ? (
          // pointer-events-none : le clic doit atteindre le <button> (ouverture
          // du Dialog), pas le viewer PDF embarqué.
          <iframe
            src={`${url}#toolbar=0&navpanes=0&view=FitH`}
            title={label}
            className="pointer-events-none h-72 w-52 rounded-lg border bg-white"
          />
        ) : (
          <div className="flex h-40 w-64 items-center justify-center overflow-hidden rounded-lg border bg-muted">
            {state.status === "loading" && <div className="size-full animate-pulse" />}
            {state.status === "error" && <ImageOff className="size-5 text-muted-foreground" />}
            {state.status === "ready" && state.isVideo && <Play className="size-5 text-muted-foreground" />}
          </div>
        )}
        <span className="text-xs text-muted-foreground">{label}</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader className="pb-4">
            <DialogTitle>{label}</DialogTitle>
          </DialogHeader>
          {url &&
            (state.status === "ready" && state.isVideo ? (
              <video
                src={url}
                controls
                className="max-h-[75vh] w-full rounded-lg bg-black object-contain"
              />
            ) : isPdf ? (
              <iframe src={url} title={label} className="h-[75vh] w-full rounded-lg border" />
            ) : (
              <img src={url} alt={label} className="max-h-[75vh] w-full rounded-lg object-contain" />
            ))}
          {url && (
            <DialogFooter>
              <Button variant="outline" size="sm" render={<a href={url} target="_blank" rel="noreferrer" />}>
                <Eye />
                Ouvrir dans un onglet
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function LotRow({
  uid,
  lot,
  userLotIds,
  userApproved,
  canApprove,
  canRevoke,
}: {
  uid: string
  lot: UserLot
  // Ids de tous les users/{uid}/lots de la fiche - sert à masquer un lot
  // enfant groupé dont le parent est déjà affiché (cf. groupedParentId).
  userLotIds: string[]
  userApproved: boolean
  // Approuver/actualiser l'accès à un lot (isApprovedLot) réservé
  // Superadmin/Agence - un simple Agent reste en lecture seule, cf.
  // matrice de droits BO (même logique que isApproved sur l'identité, en
  // moins strict : ici une Agence gérance/syndic garde la main).
  canApprove: boolean
  // Révoquer écrit idProprietaire/idLocataire (cf. lib/lots.ts,
  // revokeLotRole) - réservé isSuperAdmin côté firestore.rules, contrairement
  // à isApprovedLot ci-dessus qui reste ouvert à Agence.
  canRevoke: boolean
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
  const [groupedParentId, setGroupedParentId] = useState<string | null>(null)
  const [groupedChildren, setGroupedChildren] = useState<
    { id: string; refLot: string; batiment: string; lot: string }[]
  >([])
  const [pendingChildrenInfo, setPendingChildrenInfo] = useState<
    { id: string; refLot: string; batiment: string; lot: string }[]
  >([])
  const [approving, setApproving] = useState(false)
  const [revoking, setRevoking] = useState(false)
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
    // Info seule, jamais un lien réel (pas encore de parentLotId/
    // groupedWithParent tant que ce lot principal n'est pas approuvé) :
    // sans ça, le CS member approuve l'identité/le lot principal sans savoir
    // qu'un second lot a été demandé en même temps à l'inscription (cf.
    // sync_lot_approval/_process_pending_child_lots, functions_python/main.py).
    if (!lot.residenceId || lot.pendingChildLotIds.length === 0) {
      setPendingChildrenInfo([])
      return
    }
    Promise.all(
      lot.pendingChildLotIds.map((childId) =>
        getDoc(doc(db, "residences", lot.residenceId, "lots", childId)).then((snap) =>
          snap.exists()
            ? {
                id: childId,
                refLot: (snap.data().refLot as string) ?? "",
                batiment: (snap.data().batiment as string) ?? "",
                lot: (snap.data().lot as string) ?? "",
              }
            : null
        )
      )
    ).then((results) => setPendingChildrenInfo(results.filter((r) => r !== null)))
  }, [lot.residenceId, lot.pendingChildLotIds])

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
      setGroupedParentId(data.groupedWithParent && parentLotId ? parentLotId : null)
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

  const role = lot.statutResident || resolvedStatut

  async function handleRevoke() {
    if (!lot.residenceId || (role !== "Propriétaire" && role !== "Locataire")) return
    setRevoking(true)
    try {
      await revokeLotRole(lot.residenceId, lot.id, uid, role)
      toast.success("Accès au lot révoqué")
    } catch (err) {
      toast.error("Échec de la révocation : " + (err as Error).message)
    } finally {
      setRevoking(false)
    }
  }

  // Lot enfant groupé (parking/cave...) dont le lot parent est aussi sur
  // cette fiche : déjà listé dans "Lots groupés avec celui-ci" du parent,
  // l'afficher une seconde fois en ligne à part ferait doublon. Un enfant
  // simplement rattaché (non groupé) garde sa propre ligne.
  if (groupedParentId && userLotIds.includes(groupedParentId)) return null

  return (
    // Même découpage que "Informations du compte" / "Pièce d'identité" : le
    // justificatif dans sa propre carte à droite, sur la même ligne que le
    // lot, se vérifie d'un coup d'œil à côté du bouton "Approuver".
    <div className="grid items-start gap-5 lg:grid-cols-[1.7fr_1fr]">
      <div
        className={cn(
          "flex flex-col overflow-hidden rounded-[18px] border bg-white",
          lot.isApprovedLot ? "border-[oklch(93%_0.005_100)]" : "border-amber-300 ring-2 ring-amber-100"
        )}
      >
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-3 p-[14px_18px]",
            lot.isApprovedLot ? "bg-[oklch(98%_0.003_100)]" : "bg-amber-50"
          )}
        >
          <div className="flex flex-col text-sm">
            <span className="font-bold text-[oklch(22%_0.01_150)]">
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
            <Badge variant={lot.isApprovedLot ? "default" : "destructive"} className="rounded-full">
              {lot.isApprovedLot ? "Approuvé" : "En attente"}
            </Badge>
            {canApprove && !lot.isApprovedLot && (
              <Button
                size="sm"
                disabled={approving || !userApproved}
                title={!userApproved ? "Approuve d'abord l'identité pour que la synchronisation fonctionne" : undefined}
                onClick={handleApprove}
                className={PRIMARY_CTA_CLASS}
              >
                <Check />
                Approuver
              </Button>
            )}
            {canRevoke && (role === "Propriétaire" || role === "Locataire") && (
              <Button
                size="sm"
                variant="outline"
                disabled={revoking}
                onClick={handleRevoke}
                className="border-red-200 text-red-700 hover:bg-red-50"
              >
                <Unlink />
                Révoquer
              </Button>
            )}
          </div>
        </div>

        {groupedChildren.length > 0 && (
          <div className="flex flex-col gap-1 border-b border-[oklch(95%_0.003_100)] p-[14px_18px] text-sm">
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

        {pendingChildrenInfo.length > 0 && (
          <div className="flex flex-col gap-1 border-b border-[oklch(95%_0.003_100)] p-[14px_18px] text-sm">
            <span className="font-medium text-muted-foreground">
              Lot(s) supplémentaire(s) demandé(s) à l'inscription (rattaché(s) automatiquement à l'approbation de ce lot)
            </span>
            {pendingChildrenInfo.map((child) => (
              <span key={child.id} className="pl-3 text-muted-foreground">
                {child.batiment || child.id}
                {child.lot ? ` — ${child.lot}` : ""}
                {child.refLot ? ` · Réf. ${child.refLot}` : ""}
              </span>
            ))}
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Justificatif(s)</CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun document déposé pour ce lot.</p>
          ) : (
            // Aperçu direct (comme la pièce d'identité) plutôt qu'un simple
            // bouton "Ouvrir" : le justificatif se vérifie sans quitter la
            // fiche avant d'approuver le lot.
            <div className="flex flex-col items-center gap-4">
              {documents.map((document) => (
                <div key={document.id} className="flex flex-col items-center gap-1.5">
                  {document.documentPathVerso && (
                    <span className="text-xs font-medium text-muted-foreground">
                      {document.type || document.name || "Document"}
                    </span>
                  )}
                  <div className="flex flex-col items-center gap-3">
                    <DocumentThumbnail
                      path={document.documentPathRecto}
                      label={document.documentPathVerso ? "Recto" : document.type || document.name || "Document"}
                    />
                    {document.documentPathVerso && (
                      <DocumentThumbnail path={document.documentPathVerso} label="Verso" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
