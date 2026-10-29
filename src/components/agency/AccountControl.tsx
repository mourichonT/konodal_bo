import { useState } from "react"
import { toast } from "sonner"
import { Ban, Check, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { REVOKE_BUTTON_CLASS } from "@/components/agency/agencyUi"
import { useAccountRole } from "@/hooks/useAccountRole"
import { useGeranceBilling } from "@/hooks/useGeranceBilling"
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin"
import { useAuth } from "@/lib/auth-context"
import {
  inviteAgencyAccount,
  revokeAgencyAccount,
  revokeSuccessMessage,
  REVOKE_CONFIRM_MESSAGE,
  type AgencyAccountRole,
} from "@/lib/gerances"
import { DEFAULT_SERVICE_PRICE_CENTS, formatCents, isBillingActive, isLegacyBilling } from "@/lib/licences"
import { PRIMARY_CTA_CLASS } from "@/lib/utils"
import { AGENT_UID_FIELD, serviceTypeLabels, type Gerance, type ServiceType } from "@/types/gerance"

// Statut/actions du compte BO lié à CETTE adresse mail (une adresse mail =
// une licence) - réutilisé pour un agent nommé (mail=agent.mail,
// persistedUid=agent.uid) ET pour l'adresse générique d'un service sans
// agent nommé (mail=dept.mail, persistedUid=dept.uid) : même mécanique,
// seule la façon de reporter l'uid une fois l'invitation acceptée diffère
// (onLinkUid). L'appelant est responsable de vérifier que `mail` est déjà
// PERSISTÉ (pas juste une saisie locale pas encore enregistrée) avant de
// monter ce composant.
export function AccountControl({
  gerance,
  serviceType,
  mail,
  role,
  persistedUid,
  onLinkUid,
}: {
  gerance: Gerance
  serviceType: ServiceType
  mail: string
  // Déterminé par l'appelant selon le contexte (adresse générique du
  // service = "agence", agent nommé listé dessous = "agent") - jamais un
  // choix libre : à cette étape précise, le rôle est déjà connu.
  role: AgencyAccountRole
  persistedUid?: string
  onLinkUid: (uid: string) => Promise<void>
}) {
  const { isSuperAdmin } = useIsSuperAdmin()
  // Une Agence gère ses propres agents (inviter/révoquer) sans passer par un
  // superAdmin - Agent reste en lecture seule sur cette action (cf. matrice
  // de droits). Portée déjà garantie côté client : `gerances` (AgencesPage)
  // ne contient QUE la gérance de l'agence connectée, donc ce composant ne
  // peut jamais monter sur la fiche d'une autre agence. Côté serveur,
  // _require_superadmin_or_own_agence revérifie la même appartenance.
  const { isAgence } = useAccountRole()
  const { user } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const billing = useGeranceBilling(gerance.id)
  const [confirmOpen, setConfirmOpen] = useState(false)

  if (!isSuperAdmin && !isAgence) return null

  const uidField = AGENT_UID_FIELD[serviceType]
  const isActive = !!persistedUid && !!gerance[uidField]?.includes(persistedUid)
  const isRevoked = !!persistedUid && !isActive
  // Une Agence gérant sa propre fiche peut tomber sur SON PROPRE compte
  // (adresse générique du service, ou elle-même listée comme agent) - se
  // révoquer soi-même couperait immédiatement l'accès en cours d'usage,
  // sans façon de se réinviter derrière (il faudrait déjà être déconnecté
  // pour redemander l'accès à un superAdmin). Bouton masqué dans ce cas
  // précis, pas juste désactivé côté serveur : un superAdmin, lui, n'est
  // jamais concerné (il ne peut pas être le compte agence/agent affiché ici).
  const isSelf = !!persistedUid && persistedUid === user?.uid
  // Abonnement en cours et service non souscrit : l'invitation du compte de
  // service ajoute sa licence (invite_agency_account) - confirmée d'abord.
  const addsServiceLicence =
    role === "agence" &&
    isBillingActive(billing) &&
    !isLegacyBilling(billing) &&
    !billing.serviceLicences.includes(serviceType)

  async function handleInvite() {
    setConfirmOpen(false)
    setSubmitting(true)
    try {
      const result = await inviteAgencyAccount(gerance.id, serviceType, mail, role)
      if (result.pending) {
        // Rien à lier : aucun compte n'a été créé (pas d'abonnement actif),
        // seul un email commercial est parti - lier un uid inexistant
        // afficherait à tort "Compte actif" avant tout paiement.
        toast.success(`Email envoyé à ${mail} — l'accès sera activé après paiement des licences`)
      } else {
        await onLinkUid(result.uid)
        toast.success(
          result.licenceAdded === "service"
            ? `Invitation envoyée à ${mail} — licence service ajoutée`
            : `Invitation envoyée à ${mail}`
        )
      }
    } catch (err) {
      toast.error("Échec de l'invitation : " + (err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRevoke() {
    if (!persistedUid) return
    if (!confirm(REVOKE_CONFIRM_MESSAGE)) return
    setSubmitting(true)
    try {
      toast.success(revokeSuccessMessage(await revokeAgencyAccount(gerance.id, serviceType, persistedUid)))
    } catch (err) {
      toast.error("Échec de la révocation : " + (err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  if (isActive) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[oklch(93%_0.05_150)] px-3 text-[12.5px] font-bold text-[oklch(32%_0.09_155)]">
          <Check className="size-3.5" />
          Compte actif
        </span>
        {isSelf ? (
          <span className="text-xs text-muted-foreground">C'est votre compte</span>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={handleRevoke}
            className={REVOKE_BUTTON_CLASS}
          >
            <Ban />
            Révoquer l'accès
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isRevoked && (
        <span className="inline-flex h-8 items-center rounded-full bg-red-100 px-3 text-[12.5px] font-bold text-red-800">
          Accès révoqué
        </span>
      )}
      <Button
        type="button"
        variant="outline"
        disabled={submitting}
        onClick={() => (addsServiceLicence ? setConfirmOpen(true) : handleInvite())}
        className="h-9 rounded-[10px] px-3.5 text-[13px] font-bold"
      >
        <Mail />
        {isRevoked ? "Réinviter" : role === "agence" ? "Inviter le service" : "Inviter"}
      </Button>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter la licence service</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            Le service {serviceTypeLabels[serviceType]} n'est pas encore souscrit : inviter <strong>{mail}</strong>{" "}
            ajoute sa licence service, <strong>{formatCents(DEFAULT_SERVICE_PRICE_CENTS)} HT/mois</strong>
            {billing.status === "trialing" ? ", gratuite jusqu'à la fin de l'essai." : ", au prorata dès maintenant."}
          </DialogDescription>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              Annuler
            </Button>
            <Button type="button" onClick={handleInvite} disabled={submitting} className={PRIMARY_CTA_CLASS}>
              <Mail />
              Confirmer l'invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
