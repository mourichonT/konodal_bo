import { useEffect, useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import {
  ArrowLeft,
  Ban,
  BadgeCheck,
  CalendarDays,
  Check,
  ChevronRight,
  Home,
  Mail,
  Phone,
  Plus,
  PlusCircle,
  Save,
  Trash2,
  TriangleAlert,
  Unlink,
} from "lucide-react"
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore"
import { Button } from "@/components/ui/button"
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
import { DocumentThumbnail } from "@/components/DocumentThumbnail"
import { UserEmailsCard } from "@/components/UserEmailsCard"
import { useAccountRole } from "@/hooks/useAccountRole"
import { useScopedResidenceIds } from "@/hooks/useScopedResidenceIds"
import { cn, PRIMARY_CTA_CLASS } from "@/lib/utils"
import { residenceNameOf, unblockResident } from "@/lib/residentRemovals"
import { subscribeToResidences } from "@/lib/residences"
import { subscribeToLots, grantLotRole, revokeLotRole, type LotRole } from "@/lib/lots"
import {
  approveUserLot,
  deleteUserAccount,
  rejectUser,
  resolveUserLabels,
  setUserApproved,
  subscribeToUser,
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

type DetailTab = "profil" | "lots" | "mails"
const DETAIL_TABS: DetailTab[] = ["profil", "lots", "mails"]

type TodoItem = { key: string; title: string; hint: string; done: boolean; tab: DetailTab }

const PILL_CLASS = "rounded-full px-[11px] py-1 text-xs font-bold"
const HEADER_BUTTON_CLASS = "h-10 rounded-[12px] px-4 text-[13px] font-bold"

function initialsFor(nameOrEmail: string): string {
  const parts = nameOrEmail.trim().split(/\s+/)
  if (parts.length >= 2 && parts[0] && parts[1]) return (parts[0][0] + parts[1][0]).toUpperCase()
  return (nameOrEmail[0] ?? "?").toUpperCase()
}

export default function ResidentDetailPage() {
  const { uid } = useParams<{ uid: string }>()
  const navigate = useNavigate()
  const { isSuperAdmin } = useAccountRole()
  const { scopedResidenceIds, loading: scopeLoading } = useScopedResidenceIds()
  const [user, setUser] = useState<KonodalUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [lots, setLots] = useState<UserLot[]>([])
  const [savingApproval, setSavingApproval] = useState(false)
  const [emailCount, setEmailCount] = useState(0)
  // Onglet dans l'URL (?onglet=lots) : survit au rechargement et se partage.
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get("onglet") as DetailTab | null
  const tab: DetailTab = tabParam && DETAIL_TABS.includes(tabParam) ? tabParam : "profil"
  function setTab(next: DetailTab) {
    setSearchParams(next === "profil" ? {} : { onglet: next }, { replace: true })
  }
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
    // Attend la résolution du périmètre (agence/agent) avant de souscrire :
    // Firestore exige un where("residenceId","in",...) pour que
    // isProfessionnelResidence autorise cette lecture (cf. lib/users.ts,
    // subscribeToUserLots) - interroger trop tôt sans ce filtre échouerait.
    if (!uid || scopeLoading) return
    return subscribeToUserLots(
      uid,
      // Double sécurité côté affichage : jamais un lot hors portefeuille,
      // même si la requête ci-dessous venait à en renvoyer un.
      (data) => setLots(scopedResidenceIds ? data.filter((l) => scopedResidenceIds.has(l.residenceId)) : data),
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

  // Valider un lot revient à Konodal (superAdmin) : une agence/agent voit
  // les lots de son portefeuille, demandes en cours comprises (suivi), sans
  // pouvoir les approuver.
  const canApproveLots = isSuperAdmin
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

  const fullName = user ? `${user.name ?? ""} ${user.surname ?? ""}`.trim() || user.email : ""

  // Colonne "À traiter" : ce qui reste à faire sur la fiche, chaque ligne
  // ouvre l'onglet concerné. La certification n'y figure que pour le
  // superAdmin, seul à pouvoir la décider.
  const todo: TodoItem[] = []
  if (user) {
    if (isSuperAdmin) {
      todo.push(
        user.isCertified
          ? { key: "cert", title: "Identité certifiée", hint: "Pièce vérifiée", done: true, tab: "profil" }
          : user.certificationStatus === "pending"
            ? { key: "cert", title: "Demande de certification", hint: "Pièce et selfie à examiner", done: false, tab: "profil" }
            : {
                key: "cert",
                title: "Certifier l'identité",
                hint: user.certificationStatus === "rejected" ? "Dernière demande refusée" : "Aucune demande reçue",
                done: false,
                tab: "profil",
              }
      )
    }
    todo.push({
      key: "infos",
      title: "Infos confirmées",
      hint: user.isInfoCorrect ? "Confirmées par l'utilisateur" : "Non confirmées par l'utilisateur",
      done: user.isInfoCorrect,
      tab: "profil",
    })
    todo.push(
      pendingLots.length > 0
        ? {
            key: "lots",
            title: isSuperAdmin ? "Valider les lots" : "Lots en attente",
            hint: isSuperAdmin
              ? pendingLots.length === 1
                ? "1 demande en attente de validation"
                : `${pendingLots.length} demandes en attente de validation`
              : "En cours de validation par Konodal",
            done: false,
            tab: "lots",
          }
        : lots.length === 0
          ? { key: "lots", title: "Rattacher un lot", hint: "Aucun lot sur ce compte", done: false, tab: "lots" }
          : {
              key: "lots",
              title: "Lot rattaché",
              hint: lots.length === 1 ? "1 lot approuvé" : `${lots.length} lots approuvés`,
              done: true,
              tab: "lots",
            }
    )
  }
  const openTodo = todo.filter((item) => !item.done)

  const tabs: { key: DetailTab; label: string; count?: number }[] = [
    { key: "profil", label: "Profil" },
    { key: "lots", label: "Lots", count: lots.length },
    { key: "mails", label: "Échanges", count: emailCount > 0 ? emailCount : undefined },
  ]

  return (
    <div className="-mt-[20px] flex flex-col gap-5">
      <Link
        to="/residents"
        className="flex w-fit items-center gap-1.5 text-[13px] font-semibold text-[oklch(50%_0.01_150)] hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Utilisateurs
      </Link>

      {!user && (
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-extrabold tracking-tight text-[oklch(22%_0.01_150)]">
            {loading ? "…" : "Utilisateur introuvable"}
          </h1>
          {!loading && <p className="text-muted-foreground">Ce compte n'existe pas ou a été supprimé.</p>}
        </div>
      )}

      {user && (
        <>
          <div className="flex flex-wrap items-center gap-5 rounded-[24px] border border-[oklch(93%_0.005_100)] bg-white p-[24px_28px] shadow-[0_14px_34px_-24px_oklch(20%_0_0/0.14)]">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-[20px] bg-[oklch(93%_0.05_150)] text-[22px] font-extrabold text-[oklch(32%_0.09_155)]">
              {initialsFor(fullName)}
            </div>
            <div className="min-w-[240px] flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-[26px] font-extrabold tracking-tight text-[oklch(22%_0.01_150)]">{fullName}</h1>
                {/* Statut à part de isApproved - vérification manuelle de la
                    pièce d'identité ET des données, jamais posée
                    automatiquement, cf. lib/users.ts setUserCertified. */}
                {user.isCertified && (
                  <span title="Identité certifiée">
                    <BadgeCheck className="size-[22px] shrink-0 fill-blue-500 text-white" />
                  </span>
                )}
                {/* Vocabulaire aligné sur ResidentsPage (colonne Statut) :
                    isApproved n'est plus un prérequis d'accès à l'app
                    (compte créé approuvé par défaut, cf. types/user.ts). */}
                {user.isApproved ? (
                  <span className={cn(PILL_CLASS, "bg-[oklch(93%_0.05_150)] text-[oklch(36%_0.09_155)]")}>
                    Compte validé
                  </span>
                ) : user.rejectionReason ? (
                  <span className={cn(PILL_CLASS, "bg-red-100 text-red-700")}>Bloqué</span>
                ) : (
                  <span className={cn(PILL_CLASS, "bg-amber-100 text-amber-800")}>Non certifiée</span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-[18px] gap-y-1 text-[13px] font-medium text-[oklch(48%_0.01_150)]">
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="size-3.5" />
                  {user.email}
                </span>
                {user.phone && (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="size-3.5" />
                    {user.phone}
                  </span>
                )}
                {user.createdDate && (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="size-3.5" />
                    Inscrit(e) le {user.createdDate.toLocaleDateString("fr-FR")}
                  </span>
                )}
              </div>
            </div>
            {/* Validation d'identité, blocage (motif obligatoire) et
                suppression du compte réservés superAdmin, comme côté
                serveur (requireSuperAdmin dans adminDeleteUser). Plus
                aucune action d'identité sur un compte bloqué (isRejected)
                tant qu'une nouvelle soumission n'arrive pas de l'app. */}
            {isSuperAdmin && (
              <div className="flex flex-wrap gap-2">
                {!isRejected && !user.isApproved && (
                  <Button disabled={savingApproval} onClick={handleApprove} className={cn(HEADER_BUTTON_CLASS, PRIMARY_CTA_CLASS)}>
                    <Check />
                    Approuver l'identité
                  </Button>
                )}
                {!isRejected && (
                  <Button variant="outline" className={HEADER_BUTTON_CLASS} onClick={() => setRejecting(true)}>
                    <Ban />
                    Bloquer
                  </Button>
                )}
                <Button
                  variant="outline"
                  className={cn(HEADER_BUTTON_CLASS, "border-red-200 text-red-700 hover:bg-red-50 hover:text-red-700")}
                  onClick={() => setDeletingAccount(true)}
                >
                  <Trash2 />
                  Supprimer
                </Button>
              </div>
            )}
          </div>

          <div className={cn("grid items-start gap-5", openTodo.length > 0 && "lg:grid-cols-[minmax(0,1fr)_320px]")}>
            <div className="flex min-w-0 flex-col gap-4">
              <div
                role="tablist"
                className="flex w-fit max-w-full flex-wrap gap-1 rounded-[16px] bg-[oklch(94%_0.006_100)] p-[5px]"
              >
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={tab === t.key}
                    onClick={() => setTab(t.key)}
                    className={cn(
                      "flex items-center gap-2 rounded-[12px] px-[18px] py-[9px] text-[13.5px] font-bold transition-colors",
                      tab === t.key
                        ? "bg-white text-[oklch(24%_0.01_150)] shadow-[0_1px_3px_oklch(20%_0_0/0.1)]"
                        : "text-[oklch(48%_0.01_150)] hover:text-[oklch(30%_0.01_150)]"
                    )}
                  >
                    {t.label}
                    {t.count !== undefined && (
                      <span className="min-w-5 rounded-full bg-[oklch(45%_0.1_155/0.12)] px-1.5 py-px text-center text-[11.5px] font-extrabold text-[oklch(38%_0.09_155)]">
                        {t.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Les trois onglets restent montés (simplement masqués) : le
                  compteur "Échanges" vient de la card mails, et les lots ne
                  sont pas rechargés à chaque changement d'onglet. */}
              <div className={cn("flex flex-col gap-4", tab !== "profil" && "hidden")}>
                {isSuperAdmin && user.blockedResidencesIds.length > 0 && (
                  <BlockedResidencesCard uid={user.uid} residenceIds={user.blockedResidencesIds} />
                )}
                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] items-start gap-4">
                  {/* Identité (nom/prénom/date de naissance...) réservée
                      superAdmin - une Agence reste en lecture seule ici, même
                      traitement qu'un Agent. locked (isRejected) prime sur
                      canEdit : gèle aussi le téléphone, éditable par
                      Agence/Agent en temps normal. */}
                  <IdentityFields user={user} canEdit={isSuperAdmin} locked={isRejected} />
                  {/* Demande de certification envoyée depuis l'app (pièce +
                      selfie + score de ressemblance), décision Super Admin -
                      à côté des champs d'identité pour les comparer d'un coup
                      d'œil. */}
                  {isSuperAdmin && <CertificationRequestCard uid={user.uid} isCertified={user.isCertified} />}
                </div>
              </div>

              <Card className={cn("[--card-spacing:--spacing(7)]", tab !== "lots" && "hidden")}>
                <CardHeader>
                  <CardTitle className="text-lg font-extrabold text-[oklch(22%_0.01_150)]">Lots</CardTitle>
                  <CardDescription>
                    {!isSuperAdmin
                      ? "Lots de ce compte dans les résidences de votre portefeuille."
                      : user.isApproved
                        ? "Rattachement propriétaire / locataire à valider par lot."
                        : "Approuvez d'abord l'identité pour pouvoir valider les lots."}
                  </CardDescription>
                  {/* Rattacher un lot écrit directement idProprietaire/
                      idLocataire côté résidence (cf. lib/lots.ts,
                      grantLotRole) - réservé isSuperAdmin côté
                      firestore.rules. */}
                  {isSuperAdmin && (
                    <CardAction>
                      <Button variant="outline" className={HEADER_BUTTON_CLASS} onClick={() => setAddingLot(true)}>
                        <Plus />
                        Ajouter un lot
                      </Button>
                    </CardAction>
                  )}
                </CardHeader>
                <CardContent
                  className={cn("flex flex-col gap-3.5", !user.isApproved && "pointer-events-none opacity-50")}
                >
                  {lots.length === 0 && (
                    <div className="flex flex-col items-center gap-2.5 rounded-[18px] border-[1.5px] border-dashed border-[oklch(88%_0.01_150)] px-5 py-10 text-center">
                      <div className="flex size-11 items-center justify-center rounded-[14px] bg-[oklch(95%_0.02_150)] text-[oklch(42%_0.08_155)]">
                        <Home className="size-5" />
                      </div>
                      <div className="text-[15px] font-bold text-[oklch(26%_0.01_150)]">Aucun lot rattaché à ce compte</div>
                      {isSuperAdmin && (
                        <div className="max-w-[320px] text-[13px] leading-normal text-[oklch(52%_0.01_150)]">
                          Rattachez un lot pour donner accès à la résidence correspondante.
                        </div>
                      )}
                    </div>
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
                      showDocuments={isSuperAdmin}
                    />
                  ))}
                </CardContent>
              </Card>

              <div className={cn(tab !== "mails" && "hidden")}>
                <UserEmailsCard
                  uid={user.uid}
                  userName={fullName}
                  residenceIds={[...new Set(lots.map((l) => l.residenceId))]}
                  lotIds={lots.map((l) => l.id)}
                  onCountChange={setEmailCount}
                />
              </div>
            </div>

            {openTodo.length > 0 && (
              <div className="order-first rounded-[24px] border border-[oklch(93%_0.005_100)] bg-white p-[22px] shadow-[0_14px_34px_-24px_oklch(20%_0_0/0.12)] lg:sticky lg:top-6 lg:order-none">
                <div className="flex items-center justify-between">
                  <h3 className="text-[15px] font-extrabold text-[oklch(22%_0.01_150)]">À traiter</h3>
                  <span className="rounded-full bg-[oklch(94%_0.06_75)] px-2.5 py-[3px] text-[11.5px] font-extrabold text-[oklch(45%_0.12_65)]">
                    {openTodo.length} / {todo.length}
                  </span>
                </div>
                <div className="mt-3.5 flex flex-col gap-1">
                  {openTodo.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setTab(item.tab)}
                      className="flex items-center gap-3 rounded-[14px] px-2.5 py-[11px] text-left hover:bg-[oklch(97%_0.006_100)]"
                    >
                      <span className="size-[22px] shrink-0 rounded-full border-2 border-[oklch(80%_0.06_75)]" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] font-bold text-[oklch(26%_0.01_150)]">{item.title}</span>
                        <span className="mt-px block text-xs text-[oklch(54%_0.01_150)]">{item.hint}</span>
                      </span>
                      <ChevronRight className="size-3.5 shrink-0 text-[oklch(65%_0.01_150)]" />
                    </button>
                  ))}
                </div>
              </div>
            )}
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

  // Le téléphone reste modifiable par Agence/Agent (correction d'un numéro
  // erroné = besoin courant) ; le reste de l'identité est réservé
  // superAdmin. locked (compte bloqué) gèle tout le monde, superAdmin compris.
  const identityDisabled = !canEdit || !!locked

  return (
    <Card className="[--card-spacing:--spacing(7)]">
      <CardContent className="flex flex-col gap-[26px]">
        {locked && (
          <div className="rounded-[14px] bg-destructive/10 p-[14px_16px] text-sm text-destructive">
            <span className="font-semibold">Motif du blocage : </span>
            {user.rejectionReason}
            <p className="mt-1.5 text-xs text-destructive/80">
              Fiche gelée : plus aucune modification possible tant que ce compte n'a pas resoumis son inscription
              depuis l'application.
            </p>
          </div>
        )}

        <FieldGroup title="Identité">
          <ProfileField id="identity-name" label="Nom">
            <Input
              id="identity-name"
              className={FIELD_INPUT_CLASS}
              placeholder="Non renseigné"
              disabled={identityDisabled}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </ProfileField>
          <ProfileField id="identity-surname" label="Prénom">
            <Input
              id="identity-surname"
              className={FIELD_INPUT_CLASS}
              placeholder="Non renseigné"
              disabled={identityDisabled}
              value={surname}
              onChange={(e) => setSurname(e.target.value)}
            />
          </ProfileField>
          <ProfileField id="identity-sex" label="Sexe">
            <Input
              id="identity-sex"
              className={FIELD_INPUT_CLASS}
              placeholder="Non renseigné"
              disabled={identityDisabled}
              value={sex}
              onChange={(e) => setSex(e.target.value)}
            />
          </ProfileField>
        </FieldGroup>

        <FieldGroup title="Contact">
          <ProfileField id="identity-email" label="Email">
            <Input id="identity-email" className={FIELD_INPUT_CLASS} value={user.email} disabled />
          </ProfileField>
          <ProfileField id="identity-phone" label="Téléphone">
            <Input
              id="identity-phone"
              className={FIELD_INPUT_CLASS}
              placeholder="Non renseigné"
              disabled={!!locked}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </ProfileField>
        </FieldGroup>

        <FieldGroup title="Naissance">
          <ProfileField id="identity-birthday" label="Date de naissance">
            <Input
              id="identity-birthday"
              type="date"
              className={FIELD_INPUT_CLASS}
              disabled={identityDisabled}
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
            />
          </ProfileField>
          <ProfileField id="identity-placeofborn" label="Lieu de naissance">
            <Input
              id="identity-placeofborn"
              className={FIELD_INPUT_CLASS}
              placeholder="Non renseigné"
              disabled={identityDisabled}
              value={placeOfborn}
              onChange={(e) => setPlaceOfborn(e.target.value)}
            />
          </ProfileField>
          <ProfileField id="identity-nationality" label="Nationalité">
            <Input
              id="identity-nationality"
              className={FIELD_INPUT_CLASS}
              placeholder="Non renseigné"
              disabled={identityDisabled}
              value={nationality}
              onChange={(e) => setNationality(e.target.value)}
            />
          </ProfileField>
        </FieldGroup>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[oklch(95%_0.003_100)] pt-5">
          <span className="text-[13px] font-medium text-[oklch(50%_0.01_150)]">
            Infos confirmées par l'utilisateur :{" "}
            <b className="text-[oklch(24%_0.01_150)]">{user.isInfoCorrect ? "Oui" : "Non"}</b>
          </span>
          {!locked && (
            <Button
              disabled={saving}
              onClick={canEdit ? handleSave : handleSavePhone}
              className={cn(HEADER_BUTTON_CLASS, PRIMARY_CTA_CLASS)}
            >
              <Save />
              {canEdit ? "Enregistrer les modifications" : "Enregistrer le téléphone"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

const FIELD_INPUT_CLASS =
  "h-10 rounded-[11px] border-[oklch(90%_0.008_150)] bg-white px-[13px] text-[13.5px] text-[oklch(26%_0.01_150)] disabled:bg-[oklch(97.5%_0.003_100)] disabled:opacity-100"

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3.5 text-xs font-extrabold tracking-[0.08em] text-[oklch(45%_0.09_155)] uppercase">{title}</div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-x-4 gap-y-3.5">{children}</div>
    </div>
  )
}

function ProfileField({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs font-bold text-[oklch(50%_0.01_150)]">
        {label}
      </Label>
      {children}
    </div>
  )
}

function LotRow({
  uid,
  lot,
  userLotIds,
  userApproved,
  canApprove,
  canRevoke,
  showDocuments,
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
  // Justificatifs (documents personnels du résident) réservés superAdmin :
  // la vue syndic (agence/agent) n'affiche que les informations du lot,
  // sans même lire les documents.
  showDocuments: boolean
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
  const [ownerLabel, setOwnerLabel] = useState<string | null>(null)

  useEffect(() => {
    setOwnerLabel(null)
    if (!lot.approvedByOwner || !lot.invitedBy) return
    const invitedBy = lot.invitedBy
    resolveUserLabels([invitedBy])
      .then((labels) => setOwnerLabel(labels.get(invitedBy) ?? null))
      .catch(() => {})
  }, [lot.approvedByOwner, lot.invitedBy])

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
    if (!showDocuments) return
    return subscribeToUserLotDocuments(
      uid,
      lot.id,
      (data) => setDocuments(data),
      (error) => toast.error("Impossible de charger les documents du lot : " + error.message)
    )
  }, [uid, lot.id, showDocuments])

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

  const lotLabel = (info: { refLot: string; batiment: string; lot: string; id?: string }) =>
    `${info.batiment || info.id || ""}${info.lot ? ` — ${info.lot}` : ""}${info.refLot ? ` · Réf. ${info.refLot}` : ""}`
  const hasBody = groupedChildren.length > 0 || pendingChildrenInfo.length > 0 || showDocuments

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[18px] border bg-white",
        lot.isApprovedLot ? "border-[oklch(93%_0.005_100)]" : "border-amber-300 ring-2 ring-amber-100"
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-4 p-[18px_20px]",
          lot.isApprovedLot ? "bg-[oklch(98%_0.003_100)]" : "bg-amber-50"
        )}
      >
        <div className="min-w-0">
          <div className="text-[15px] font-extrabold text-[oklch(22%_0.01_150)]">
            {residenceName ?? lot.residenceId}
            {lotInfo?.batiment ? ` — ${lotInfo.batiment}` : ""}
            {lotInfo?.lot ? ` — ${lotInfo.lot}` : ""}
          </div>
          <div className="mt-[3px] text-[12.5px] text-[oklch(52%_0.01_150)]">
            {[lotInfo?.refLot ? `Réf. ${lotInfo.refLot}` : null, role].filter(Boolean).join(" · ") || "—"}
          </div>
          {parentLotInfo && (
            <div className="mt-[3px] text-[12.5px] text-[oklch(52%_0.01_150)]">
              Rattaché à {lotLabel(parentLotInfo)}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span
            className={cn(
              "rounded-full px-3 py-[5px] text-xs font-bold",
              lot.isApprovedLot
                ? "bg-[oklch(93%_0.05_150)] text-[oklch(36%_0.09_155)]"
                : "bg-amber-100 text-amber-800"
            )}
          >
            {lot.isApprovedLot ? "Approuvé" : lot.pendingPeerApproval ? "En attente de l'occupant" : "En attente"}
          </span>
          {canApprove && !lot.isApprovedLot && (
            <Button
              size="sm"
              disabled={approving || !userApproved}
              title={!userApproved ? "Approuve d'abord l'identité pour que la synchronisation fonctionne" : undefined}
              onClick={handleApprove}
              className={cn("rounded-[10px] font-bold", PRIMARY_CTA_CLASS)}
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
              className="rounded-[10px] border-red-200 font-bold text-red-700 hover:bg-red-50 hover:text-red-700"
            >
              <Unlink />
              Révoquer
            </Button>
          )}
        </div>
      </div>

      {hasBody && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-x-6 gap-y-4 border-t border-[oklch(94%_0.004_100)] p-[16px_20px]">
          {groupedChildren.length > 0 && (
            <div>
              <div className={LOT_SUBTITLE_CLASS}>Lots groupés avec celui-ci</div>
              <div className="flex flex-col gap-1.5">
                {groupedChildren.map((child) => (
                  <div key={child.id} className={LOT_CHIP_CLASS}>
                    {lotLabel(child)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info seule (pas encore de lien réel tant que ce lot principal
              n'est pas approuvé), cf. pendingChildLotIds plus haut. */}
          {pendingChildrenInfo.length > 0 && (
            <div>
              <div className={LOT_SUBTITLE_CLASS}>Lot(s) supplémentaire(s) demandé(s) à l'inscription</div>
              <div className="flex flex-col gap-1.5">
                {pendingChildrenInfo.map((child) => (
                  <div key={child.id} className={LOT_CHIP_CLASS}>
                    {lotLabel(child)}
                  </div>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-[oklch(54%_0.01_150)]">
                Rattaché(s) automatiquement à l'approbation de ce lot.
              </p>
            </div>
          )}

          {/* Justificatifs (documents personnels du résident) réservés
              superAdmin : la vue agence/agent ne les lit même pas. */}
          {showDocuments && (
            <div>
              <div className={LOT_SUBTITLE_CLASS}>Justificatif</div>
              <div className="flex flex-col gap-3">
                {/* Colocation refusée par le locataire en place (lot sans
                    propriétaire) : la décision revient à Konodal. */}
                {!lot.isApprovedLot && lot.peerRefusal && (
                  <div className="flex items-start gap-2 rounded-[12px] bg-amber-50 p-[10px_12px] text-sm text-amber-900">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                    <span>
                      <span className="font-semibold">Colocation refusée par le locataire en place</span>
                      {lot.peerRefusal.reason ? ` (motif : ${lot.peerRefusal.reason})` : ""}
                      {" "}- demande transmise à Konodal : approuver ou révoquer ce lot.
                    </span>
                  </div>
                )}
                {/* Parcours sans justificatif (invitation/demande acceptée
                    par un propriétaire en place, cf. UserLot.approvedByOwner) :
                    l'absence de document est normale. */}
                {lot.approvedByOwner && (
                  <div className="flex items-start gap-2 rounded-[12px] bg-emerald-50 p-[10px_12px] text-sm text-emerald-800">
                    <BadgeCheck className="mt-0.5 size-4 shrink-0" />
                    <span>
                      <span className="font-semibold">Validé par le propriétaire</span>
                      {ownerLabel ? ` (${ownerLabel})` : ""}
                    </span>
                  </div>
                )}
                {documents.length === 0
                  ? !lot.approvedByOwner && (
                      <p className="text-sm text-[oklch(52%_0.01_150)]">Aucun document déposé pour ce lot.</p>
                    )
                  : documents.map((document) => (
                      <div key={document.id} className="flex flex-col gap-1.5">
                        <span className="text-[13px] font-semibold text-[oklch(30%_0.01_150)]">
                          {document.type || document.name || "Document"}
                        </span>
                        <div className="flex flex-wrap items-start gap-3">
                          <DocumentThumbnail
                            path={document.documentPathRecto}
                            label={document.documentPathVerso ? "Recto" : "Aperçu"}
                          />
                          {document.documentPathVerso && (
                            <DocumentThumbnail path={document.documentPathVerso} label="Verso" />
                          )}
                        </div>
                      </div>
                    ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const LOT_SUBTITLE_CLASS = "mb-2 text-xs font-bold text-[oklch(50%_0.01_150)]"
const LOT_CHIP_CLASS =
  "rounded-[12px] bg-[oklch(97%_0.006_100)] px-3 py-[9px] text-[13px] font-semibold text-[oklch(30%_0.01_150)]"

// Accès suspendu par un superAdmin (demande de retrait du CS acceptée, cf.
// RemovalRequestsPage) : rien n'a été supprimé, lever le blocage rend
// l'accès à l'identique (le rôle CS retiré n'est pas rendu).
function BlockedResidencesCard({ uid, residenceIds }: { uid: string; residenceIds: string[] }) {
  const [names, setNames] = useState<Record<string, string>>({})
  const [unblocking, setUnblocking] = useState<string | null>(null)

  useEffect(() => {
    Promise.all(residenceIds.map(async (id) => [id, await residenceNameOf(id)] as const)).then((entries) =>
      setNames(Object.fromEntries(entries))
    )
  }, [residenceIds])

  async function handleUnblock(residenceId: string) {
    if (!confirm("Lever le blocage et rendre l'accès à cette résidence ?")) return
    setUnblocking(residenceId)
    try {
      await unblockResident(residenceId, uid)
      toast.success("Accès rétabli")
    } catch (err) {
      toast.error("Échec : " + (err as Error).message)
    } finally {
      setUnblocking(null)
    }
  }

  return (
    <Card className="border-rose-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-rose-700">
          <Ban className="size-4" />
          Accès bloqué
        </CardTitle>
        <CardDescription>
          Ses lots, publications et messages sont conservés ; il voit une page « Accès suspendu » dans l'app.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {residenceIds.map((residenceId) => (
          <div key={residenceId} className="flex items-center justify-between gap-3">
            <Link className="font-medium underline" to={`/residences/${residenceId}`}>
              {names[residenceId] ?? residenceId}
            </Link>
            <Button
              variant="outline"
              size="sm"
              disabled={unblocking !== null}
              onClick={() => handleUnblock(residenceId)}
            >
              Lever le blocage
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
