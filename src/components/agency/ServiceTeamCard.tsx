import { useState } from "react"
import { toast } from "sonner"
import { Mail, Pencil, Phone, Plus, Send, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { AccountControl } from "@/components/agency/AccountControl"
import {
  Avatar,
  CAPS_LABEL_CLASS,
  formatShortDate,
  formatSince,
  IconInput,
  LINK_BUTTON_CLASS,
  OUTLINE_BUTTON_CLASS,
  Pill,
  ROW_BORDER_CLASS,
  serviceIcons,
  TINT_BG_CLASS,
  type PillTone,
} from "@/components/agency/agencyUi"
import { useAuth } from "@/lib/auth-context"
import {
  inviteAgencyAccount,
  resendAgencyInvite,
  revokeAgencyAccount,
  revokeSuccessMessage,
  REVOKE_CONFIRM_MESSAGE,
  setAgentLicence,
  setDeptAccountUid,
  updateGeranceDeptContact,
  type AgencyTeamMember,
} from "@/lib/gerances"
import {
  emailInitials,
  formatCents,
  isBillingActive,
  isLegacyBilling,
  licenceUsage,
  unlicensedAgentUids,
} from "@/lib/licences"
import {
  cn,
  ICON_TILE_CLASS,
  ICON_TILE_OFF_CLASS,
  ICON_TILE_ON_CLASS,
  PANEL_CARD_CLASS,
  PRIMARY_CTA_CLASS,
} from "@/lib/utils"
import type { GeranceBilling } from "@/types/billing"
import { AGENT_UID_FIELD, serviceTypeLabels, type Gerance, type ServiceType } from "@/types/gerance"

export type LicencePrices = { service: number; agent: number }

type Team = Record<string, AgencyTeamMember> | null

// Compte du service : celui que le serveur a enregistré (billing), sinon
// l'adresse du service liée à un compte encore présent (fiches antérieures
// aux licences).
export function serviceAccountUid(gerance: Gerance, billing: GeranceBilling, type: ServiceType) {
  const uids = gerance[AGENT_UID_FIELD[type]] ?? []
  const fromBilling = billing.serviceAccounts[type]
  if (fromBilling && uids.includes(fromBilling)) return fromBilling
  const deptUid = gerance.services[type]?.uid
  return deptUid && uids.includes(deptUid) ? deptUid : undefined
}

// Un service s'affiche en carte complète dès qu'il a une licence, un compte
// ou des agents ; sinon en carte « Non souscrit » à ajouter.
export function serviceHasTeam(gerance: Gerance, billing: GeranceBilling, type: ServiceType) {
  return (
    billing.serviceLicences.includes(type) ||
    (gerance[AGENT_UID_FIELD[type]] ?? []).length > 0 ||
    unlicensedAgentUids(billing, type).length > 0
  )
}

function prorationText(billing: GeranceBilling) {
  return billing.status === "trialing" ? ", gratuite jusqu'à la fin de l'essai." : ", au prorata dès maintenant."
}

type Row = {
  uid: string
  email: string
  kind: "agent" | "unlicensed" | "orphan"
  member?: AgencyTeamMember
}

function rowStatus(row: Row): { label: string; tone: PillTone; detail: string } {
  const member = row.member
  const pending = !!member && !member.lastSignInAt
  const lastSeen = member?.lastSignInAt ? `Dernière connexion le ${formatShortDate(member.lastSignInAt)}` : ""
  const invited = member?.createdAt ? `Invité ${formatSince(member.createdAt)}` : "Invitation envoyée"
  if (row.kind === "orphan")
    return { label: "Compte introuvable", tone: "red", detail: "Supprimez-le pour libérer sa licence" }
  if (row.kind === "unlicensed") return { label: "Sans licence", tone: "grey", detail: "Aucun accès" }
  return pending
    ? { label: "Invitation envoyée", tone: "amber", detail: invited }
    : { label: "Licence attribuée", tone: "green", detail: lastSeen || "Licence agent" }
}

// Carte d'un service (maquette « Agence Gestion Compte Konodal », onglets
// Général et Équipe) : en-tête du service (compte, téléphone, prix), puis ses
// agents avec leur licence, invitation en ligne, fiche de chaque agent
// (libérer / attribuer la licence, supprimer). Règles : licence_billing.py.
export function ServiceTeamCard({
  gerance,
  billing,
  type,
  team,
  canEdit,
  prices,
}: {
  gerance: Gerance
  billing: GeranceBilling
  type: ServiceType
  team: Team
  canEdit: boolean
  prices: LicencePrices
}) {
  const { user } = useAuth()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [serviceDialog, setServiceDialog] = useState(false)
  const [agentDialog, setAgentDialog] = useState<Row | null>(null)

  const usage = licenceUsage(gerance, billing)
  const subscribed = usage.subscribed.includes(type)
  const dept = gerance.services[type]
  const label = serviceTypeLabels[type]
  const ServiceIcon = serviceIcons[type]
  const serviceUid = serviceAccountUid(gerance, billing, type)
  const available = usage.agents.available

  // Agents seulement : le compte du service est dans l'en-tête de la carte.
  const rows: Row[] = []
  const emailOf = (uid: string) => team?.[uid]?.email ?? "…"
  for (const uid of gerance[AGENT_UID_FIELD[type]] ?? []) {
    if (uid === serviceUid) continue
    const orphan = team !== null && !team[uid]
    rows.push({
      uid,
      email: orphan ? "Compte supprimé" : emailOf(uid),
      kind: orphan ? "orphan" : "agent",
      member: team?.[uid],
    })
  }
  for (const uid of unlicensedAgentUids(billing, type)) {
    rows.push({ uid, email: emailOf(uid), kind: "unlicensed", member: team?.[uid] })
  }

  // Même règle que invite_agency_account : abonnement en cours, nouvelle
  // formule, service souscrit.
  const inviteBlocker = !isBillingActive(billing)
    ? "Pas d'abonnement en cours : souscrivez depuis l'onglet Abonnement."
    : isLegacyBilling(billing)
      ? "Abonnement de l'ancienne formule : Konodal le passe bientôt aux nouvelles licences."
      : !subscribed
        ? `Le service ${label} n'est pas souscrit.`
        : null

  const pendingService = serviceUid && team?.[serviceUid] && !team[serviceUid].lastSignInAt
  const headerPill: { label: string; tone: PillTone } = serviceUid
    ? pendingService
      ? { label: "Invitation envoyée", tone: "amber" }
      : { label: "Compte actif", tone: "green" }
    : { label: subscribed ? "Compte à inviter" : "Non souscrit", tone: "grey" }

  async function handleInvite() {
    const address = email.trim()
    if (!address) return
    setInviting(true)
    try {
      const result = await inviteAgencyAccount(gerance.id, type, address, "agent")
      toast.success(
        result.pending
          ? `Email envoyé à ${address}`
          : result.licenceAdded === "agent"
            ? `Invitation envoyée à ${address} — licence agent ajoutée`
            : `Invitation envoyée à ${address}`
      )
      setEmail("")
      setConfirmOpen(false)
      setInviteOpen(false)
    } catch (err) {
      toast.error("Échec de l'invitation : " + (err as Error).message)
    } finally {
      setInviting(false)
    }
  }

  async function handleResend(uid: string, address: string) {
    try {
      await resendAgencyInvite(gerance.id, uid)
      toast.success(`Invitation renvoyée à ${address}`)
    } catch (err) {
      toast.error("Renvoi impossible : " + (err as Error).message)
    }
  }

  async function handleDelete(row: Row) {
    const inOtherService =
      row.kind === "agent" &&
      Object.entries(AGENT_UID_FIELD).some(
        ([other, field]) => other !== type && (gerance[field] ?? []).includes(row.uid)
      )
    const message = inOtherService
      ? `Retirer ${row.email} du service ${label} ? Il reste agent de l'autre service.`
      : REVOKE_CONFIRM_MESSAGE
    if (!confirm(message)) return false
    try {
      toast.success(revokeSuccessMessage(await revokeAgencyAccount(gerance.id, type, row.uid)))
      return true
    } catch (err) {
      toast.error("Échec de la suppression : " + (err as Error).message)
      return false
    }
  }

  return (
    <section className={cn(PANEL_CARD_CLASS, "overflow-hidden p-0")}>
      <div className={cn(TINT_BG_CLASS, "flex flex-wrap items-center gap-3.5 px-[22px] py-4")}>
        <div className={cn(ICON_TILE_CLASS, "size-11", subscribed ? ICON_TILE_ON_CLASS : ICON_TILE_OFF_CLASS)}>
          <ServiceIcon />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="p-0 font-sans text-[17px] font-extrabold text-[oklch(22%_0.01_150)]">{label}</h2>
            <Pill tone={headerPill.tone}>{headerPill.label}</Pill>
            {canEdit && pendingService && serviceUid !== user?.uid && (
              <button
                type="button"
                className={LINK_BUTTON_CLASS}
                onClick={() => handleResend(serviceUid, team?.[serviceUid]?.email ?? dept?.mail ?? "")}
              >
                Renvoyer
              </button>
            )}
          </div>
          <p className="m-0 mt-0.5 text-[12.5px] break-words text-muted-foreground">
            {[dept?.mail, dept?.phone, subscribed && `${formatCents(prices.service)} HT / mois`]
              .filter(Boolean)
              .join(" · ") || "Aucune adresse de service"}
          </p>
        </div>
        {canEdit && (
          <Button
            type="button"
            variant="outline"
            className={OUTLINE_BUTTON_CLASS}
            onClick={() => setServiceDialog(true)}
          >
            {serviceUid ? <Pencil /> : <Mail />}
            {serviceUid ? "Modifier le service" : "Inviter le compte"}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 px-[22px] pt-4 pb-3">
        <span className={cn(CAPS_LABEL_CLASS, "flex-1")}>
          Agents du service {label} · {rows.length}
        </span>
        {canEdit && (
          <Button
            type="button"
            className={cn(PRIMARY_CTA_CLASS, "h-9 rounded-[11px] px-3.5 text-[13px] font-extrabold")}
            disabled={!!inviteBlocker}
            title={inviteBlocker ?? undefined}
            onClick={() => setInviteOpen((open) => !open)}
          >
            <Plus />
            Inviter un agent
          </Button>
        )}
      </div>
      {canEdit && inviteBlocker && (
        <p className="m-0 px-[22px] pb-3 text-[12.5px] text-muted-foreground">{inviteBlocker}</p>
      )}

      {rows.length === 0 ? (
        <p className={cn(ROW_BORDER_CLASS, "m-0 px-[22px] py-4 text-[13px] text-muted-foreground")}>
          Aucun agent pour ce service.
        </p>
      ) : (
        <div className={cn(ROW_BORDER_CLASS, "hidden gap-3 bg-[oklch(98%_0.004_100)] px-[22px] py-2 sm:flex")}>
          <span className={cn(CAPS_LABEL_CLASS, "flex-[1.6] pl-12")}>Agent</span>
          <span className={cn(CAPS_LABEL_CLASS, "flex-1")}>Statut</span>
          <span className="w-[150px]" />
        </div>
      )}

      {rows.map((row) => {
        const status = rowStatus(row)
        const isSelf = row.uid === user?.uid
        const pending = row.kind === "agent" && !!row.member && !row.member.lastSignInAt
        return (
          <div
            key={`${row.kind}-${row.uid}`}
            className={cn(ROW_BORDER_CLASS, "flex flex-wrap items-center gap-x-3 gap-y-2 px-[22px] py-3")}
          >
            <div className="flex min-w-0 flex-[1.6] basis-[220px] items-center gap-3">
              <Avatar initials={row.kind === "orphan" ? "?" : emailInitials(row.email)} />
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-bold text-[oklch(22%_0.01_150)]">
                  {row.email}
                  {isSelf && " (vous)"}
                </div>
                <div className="truncate text-[12px] text-muted-foreground">{status.detail}</div>
              </div>
            </div>
            <div className="flex-1 basis-[140px]">
              <Pill tone={status.tone}>{status.label}</Pill>
            </div>
            {canEdit && (
              <div className="flex w-[150px] items-center justify-end gap-3">
                {pending && !isSelf ? (
                  <button type="button" className={LINK_BUTTON_CLASS} onClick={() => handleResend(row.uid, row.email)}>
                    Renvoyer
                  </button>
                ) : (
                  row.kind !== "orphan" && (
                    <button type="button" className={LINK_BUTTON_CLASS} onClick={() => setAgentDialog(row)}>
                      Modifier
                    </button>
                  )
                )}
                {!isSelf && (
                  <button
                    type="button"
                    aria-label={`Supprimer ${row.email}`}
                    title="Supprimer l'agent"
                    className="text-[oklch(50%_0.17_27)] hover:text-[oklch(42%_0.17_27)]"
                    onClick={() => handleDelete(row)}
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}

      {canEdit && inviteOpen && !inviteBlocker && (
        <form
          className={cn(ROW_BORDER_CLASS, TINT_BG_CLASS, "flex flex-wrap items-center gap-3 px-[22px] py-3")}
          onSubmit={(e) => {
            e.preventDefault()
            if (email.trim() && !inviting) setConfirmOpen(true)
          }}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-[oklch(70%_0.04_155)] text-[oklch(40%_0.08_155)]">
            <Plus className="size-4" />
          </span>
          <IconInput
            icon={Mail}
            autoFocus
            type="email"
            required
            aria-label="Email de l'agent à inviter"
            placeholder="Email de l'agent à inviter"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-w-[200px] flex-1"
          />
          <span className="text-[12px] whitespace-nowrap text-muted-foreground">
            {available > 0
              ? `${available} licence${available > 1 ? "s" : ""} libre${available > 1 ? "s" : ""} → ${available - 1}`
              : `+ ${formatCents(prices.agent)} HT / mois`}
          </span>
          <Button
            type="submit"
            disabled={inviting || !email.trim()}
            className={cn(PRIMARY_CTA_CLASS, "h-9 rounded-[11px] px-3.5 text-[13px] font-extrabold")}
          >
            <Send />
            Inviter
          </Button>
        </form>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmer l'invitation</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            {available > 0 ? (
              <>
                <strong>{email.trim()}</strong> utilisera 1 des {available} licence{available > 1 ? "s" : ""} agent
                libre{available > 1 ? "s" : ""} : rien de plus à payer.
              </>
            ) : (
              <>
                Plus aucune licence agent libre : inviter <strong>{email.trim()}</strong> en ajoute une,{" "}
                <strong>{formatCents(prices.agent)} HT/mois</strong>
                {prorationText(billing)}
              </>
            )}
          </DialogDescription>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)} disabled={inviting}>
              Annuler
            </Button>
            <Button type="button" onClick={handleInvite} disabled={inviting} className={PRIMARY_CTA_CLASS}>
              <Send />
              Confirmer l'invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {serviceDialog && (
        <ServiceDialog
          gerance={gerance}
          type={type}
          hasAccount={!!serviceUid}
          onClose={() => setServiceDialog(false)}
        />
      )}
      {agentDialog && (
        <AgentDialog
          gerance={gerance}
          billing={billing}
          type={type}
          row={agentDialog}
          prices={prices}
          onDelete={handleDelete}
          onClose={() => setAgentDialog(null)}
        />
      )}
    </section>
  )
}

// « Modifier le service » : téléphone, adresse tant qu'aucun compte n'y est
// lié, et compte du service (invitation, qui ajoute la licence service si
// besoin ; révocation).
function ServiceDialog({
  gerance,
  type,
  hasAccount,
  onClose,
}: {
  gerance: Gerance
  type: ServiceType
  hasAccount: boolean
  onClose: () => void
}) {
  const dept = gerance.services[type]
  const [mail, setMail] = useState(dept?.mail ?? "")
  const [phone, setPhone] = useState(dept?.phone ?? "")
  const [saving, setSaving] = useState(false)
  const dirty = mail !== (dept?.mail ?? "") || phone !== (dept?.phone ?? "")

  async function handleSave() {
    setSaving(true)
    try {
      await updateGeranceDeptContact(gerance.id, type, { mail: mail.trim(), phone: phone.trim() })
      toast.success("Service mis à jour")
    } catch (err) {
      toast.error("Échec de l'enregistrement : " + (err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Service {serviceTypeLabels[type]}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${type}-dialog-mail`}>Email du service</Label>
            <IconInput
              id={`${type}-dialog-mail`}
              icon={Mail}
              type="email"
              value={mail}
              onChange={(e) => setMail(e.target.value)}
              disabled={hasAccount}
              title={hasAccount ? "Adresse du compte du service : révoquez-le pour la changer" : undefined}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${type}-dialog-phone`}>Téléphone</Label>
            <IconInput
              id={`${type}-dialog-phone`}
              icon={Phone}
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving || !dirty}
              className={cn(PRIMARY_CTA_CLASS, "h-9 rounded-[11px] font-bold")}
            >
              Enregistrer
            </Button>
          </div>
          {dept?.mail && !dirty && (
            <div className={cn(ROW_BORDER_CLASS, "flex flex-col gap-2 pt-3")}>
              <span className={CAPS_LABEL_CLASS}>Compte du service</span>
              <AccountControl
                gerance={gerance}
                serviceType={type}
                mail={dept.mail}
                role="agence"
                persistedUid={dept.uid}
                onLinkUid={(uid) => setDeptAccountUid(gerance, type, uid)}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Fiche d'un agent (maquette 11h / 11j) : libérer sa licence (il reste dans
// l'équipe, sans accès) ou lui en attribuer une, et le supprimer.
function AgentDialog({
  gerance,
  billing,
  type,
  row,
  prices,
  onDelete,
  onClose,
}: {
  gerance: Gerance
  billing: GeranceBilling
  type: ServiceType
  row: Row
  prices: LicencePrices
  onDelete: (row: Row) => Promise<boolean>
  onClose: () => void
}) {
  const [busy, setBusy] = useState(false)
  const usage = licenceUsage(gerance, billing)
  const licensed = row.kind === "agent"
  const member = row.member
  const services = licensed
    ? Object.entries(AGENT_UID_FIELD)
        .filter(([, field]) => (gerance[field] ?? []).includes(row.uid))
        .map(([service]) => serviceTypeLabels[service as ServiceType])
    : (billing.unlicensedAgents[row.uid] ?? [type]).map((service) => serviceTypeLabels[service])
  const subtitle = [
    `Service ${services.join(" et ")}`,
    member?.lastSignInAt
      ? `dernière connexion le ${formatShortDate(member.lastSignInAt)}`
      : member?.createdAt
        ? `invité ${formatSince(member.createdAt)}`
        : null,
  ]
    .filter(Boolean)
    .join(" · ")
  const assignBlocker = !isBillingActive(billing)
    ? "Pas d'abonnement en cours."
    : isLegacyBilling(billing)
      ? "Abonnement de l'ancienne formule."
      : null

  async function toggleLicence() {
    if (
      licensed &&
      !confirm(`Libérer la licence de ${row.email} ? Il garde sa place dans l'équipe mais n'a plus accès au BO.`)
    )
      return
    setBusy(true)
    try {
      const result = await setAgentLicence(gerance.id, row.uid, !licensed)
      toast.success(
        licensed
          ? "Licence libérée"
          : result.licenceAdded
            ? "Licence attribuée — licence agent ajoutée"
            : "Licence attribuée"
      )
      onClose()
    } catch (err) {
      toast.error("Modification impossible : " + (err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <DialogHeader className="flex-row items-center gap-3 p-5 pb-4">
          <Avatar initials={emailInitials(row.email)} />
          <div className="min-w-0">
            <DialogTitle className="truncate text-[15px]">{row.email}</DialogTitle>
            <p className="m-0 text-[12.5px] text-muted-foreground">{subtitle}</p>
          </div>
        </DialogHeader>
        <div className="px-5 pb-4">
          <div
            className={cn(
              TINT_BG_CLASS,
              "flex flex-wrap items-center gap-3 rounded-[14px] border border-[oklch(93%_0.03_160)] p-3.5"
            )}
          >
            <div className="min-w-0 flex-1 basis-[200px]">
              <div className="text-[13.5px] font-bold text-[oklch(22%_0.01_150)]">
                {licensed ? "Licence agent attribuée" : "Aucune licence attribuée"}
              </div>
              <p className="m-0 text-[12px] leading-snug text-muted-foreground">
                {licensed
                  ? "L'agent reste dans l'équipe, sans licence ni accès. La licence redevient libre."
                  : (assignBlocker ??
                    (usage.agents.available > 0
                      ? `${usage.agents.available} licence${usage.agents.available > 1 ? "s" : ""} libre${usage.agents.available > 1 ? "s" : ""} dans l'abonnement.`
                      : `Aucune licence libre : une licence est ajoutée, ${formatCents(prices.agent)} HT/mois${prorationText(billing)}`))}
              </p>
            </div>
            {licensed ? (
              <Button
                type="button"
                variant="outline"
                className={OUTLINE_BUTTON_CLASS}
                disabled={busy}
                onClick={toggleLicence}
              >
                Libérer la licence
              </Button>
            ) : (
              <Button
                type="button"
                className={cn(PRIMARY_CTA_CLASS, "h-9 rounded-[11px] px-3.5 text-[13px] font-extrabold")}
                disabled={busy || !!assignBlocker}
                onClick={toggleLicence}
              >
                Attribuer une licence
              </Button>
            )}
          </div>
        </div>
        <DialogFooter className="m-0 flex-row items-center justify-between rounded-b-xl border-t p-4 sm:justify-between">
          <button
            type="button"
            disabled={busy}
            className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[oklch(48%_0.17_27)] hover:underline"
            onClick={async () => {
              if (await onDelete(row)) onClose()
            }}
          >
            <Trash2 className="size-4" />
            Supprimer l'agent
          </button>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Service sans licence ni compte (maquette : carte en pointillés « Non
// souscrit ») : « Ajouter » invite le compte du service, ce qui ajoute sa
// licence à l'abonnement en cours ; sans abonnement, renvoie vers l'onglet
// Abonnement.
export function AddServiceCard({
  gerance,
  billing,
  type,
  canEdit,
  prices,
  onSubscribe,
}: {
  gerance: Gerance
  billing: GeranceBilling
  type: ServiceType
  canEdit: boolean
  prices: LicencePrices
  onSubscribe: () => void
}) {
  const [open, setOpen] = useState(false)
  const dept = gerance.services[type]
  const [mail, setMail] = useState(dept?.mail ?? "")
  const [phone, setPhone] = useState(dept?.phone ?? "")
  const [busy, setBusy] = useState(false)
  const ServiceIcon = serviceIcons[type]
  const active = isBillingActive(billing) && !isLegacyBilling(billing)

  async function handleAdd() {
    const address = mail.trim()
    if (!address) return
    setBusy(true)
    try {
      await updateGeranceDeptContact(gerance.id, type, { mail: address, phone: phone.trim() })
      const result = await inviteAgencyAccount(gerance.id, type, address, "agence")
      if (!result.pending) await setDeptAccountUid(gerance, type, result.uid)
      toast.success(`Service ${serviceTypeLabels[type]} ajouté — invitation envoyée à ${address}`)
      setOpen(false)
    } catch (err) {
      toast.error("Ajout impossible : " + (err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="flex flex-wrap items-center gap-3.5 rounded-[22px] border-[1.5px] border-dashed border-[oklch(85%_0.02_160)] bg-[oklch(98.5%_0.008_160)] px-[22px] py-4">
      <div className={cn(ICON_TILE_CLASS, "size-11", ICON_TILE_ON_CLASS)}>
        <ServiceIcon />
      </div>
      <div className="min-w-0 flex-1 basis-[240px]">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="p-0 font-sans text-[17px] font-extrabold text-[oklch(22%_0.01_150)]">
            {serviceTypeLabels[type]}
          </h2>
          <Pill tone="grey">Non souscrit</Pill>
        </div>
        <p className="m-0 mt-0.5 text-[12.5px] text-muted-foreground">
          Un compte et des agents dédiés. Vous pourrez inviter vos agents une fois le service ajouté.
        </p>
      </div>
      {canEdit && (
        <Button
          type="button"
          className={cn(PRIMARY_CTA_CLASS, "h-9 rounded-[11px] px-3.5 text-[13px] font-extrabold")}
          disabled={isLegacyBilling(billing)}
          onClick={() => (active ? setOpen(true) : onSubscribe())}
        >
          <Plus />
          {active ? `Ajouter · ${formatCents(prices.service)} HT / mois` : "Souscrire"}
        </Button>
      )}
      <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter le service {serviceTypeLabels[type]}</DialogTitle>
          </DialogHeader>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              handleAdd()
            }}
          >
            <DialogDescription>
              Le compte du service reçoit une invitation. La licence service est ajoutée à votre abonnement,{" "}
              <strong>{formatCents(prices.service)} HT/mois</strong>
              {prorationText(billing)}
            </DialogDescription>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${type}-add-mail`}>Email du service</Label>
              <IconInput
                id={`${type}-add-mail`}
                icon={Mail}
                type="email"
                required
                value={mail}
                onChange={(e) => setMail(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${type}-add-phone`}>Téléphone</Label>
              <IconInput
                id={`${type}-add-phone`}
                icon={Phone}
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
                Annuler
              </Button>
              <Button type="submit" disabled={busy || !mail.trim()} className={PRIMARY_CTA_CLASS}>
                <Send />
                Ajouter et inviter
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
