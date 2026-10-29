import type { GeranceBilling } from "@/types/billing"
import { AGENT_UID_FIELD, type Gerance, type ServiceType } from "@/types/gerance"

// Usage des licences d'une agence : miroir exact de licence_usage
// (functions_python/licence_billing.py) - le serveur reste seul juge, ceci
// sert à l'affichage et aux avertissements avant une invitation.
export const SERVICE_TYPES: ServiceType[] = ["serviceSyndic", "geranceLocative"]
export const MAX_AGENT_LICENCES = 50

export type ServiceLicenceState = "assigned" | "unassigned" | "none"

export type LicenceUsage = {
  services: Record<ServiceType, ServiceLicenceState>
  subscribed: ServiceType[]
  serviceAccounts: Partial<Record<ServiceType, string>>
  agents: { purchased: number; assigned: number; available: number }
}

// Comptes de service actifs : serviceAccounts encore présents dans le
// tableau de leur service.
export function activeServiceAccounts(gerance: Gerance, billing: GeranceBilling) {
  const accounts: Partial<Record<ServiceType, string>> = {}
  for (const type of SERVICE_TYPES) {
    const uid = billing.serviceAccounts[type]
    if (uid && (gerance[AGENT_UID_FIELD[type]] ?? []).includes(uid)) accounts[type] = uid
  }
  return accounts
}

// Agents nommés : uids distincts des deux tableaux qui ne sont aucun compte
// de service (un agent des deux services = une licence).
export function agentUids(gerance: Gerance, billing: GeranceBilling): Set<string> {
  const serviceUids = new Set(Object.values(activeServiceAccounts(gerance, billing)))
  return new Set(
    SERVICE_TYPES.flatMap((type) => gerance[AGENT_UID_FIELD[type]] ?? []).filter((uid) => !serviceUids.has(uid))
  )
}

// Agents sans licence (« Libérer la licence ») : hors des tableaux, donc sans
// accès, toujours listés dans l'équipe ; filtrés sur un service si donné.
export function unlicensedAgentUids(billing: GeranceBilling, type?: ServiceType): string[] {
  return Object.entries(billing.unlicensedAgents)
    .filter(([, services]) => !type || services.includes(type))
    .map(([uid]) => uid)
}

export function licenceUsage(gerance: Gerance, billing: GeranceBilling): LicenceUsage {
  const subscribed = SERVICE_TYPES.filter((type) => billing.serviceLicences.includes(type))
  const serviceAccounts = activeServiceAccounts(gerance, billing)
  const services = Object.fromEntries(
    SERVICE_TYPES.map((type) => [
      type,
      subscribed.includes(type) ? (serviceAccounts[type] ? "assigned" : "unassigned") : "none",
    ])
  ) as Record<ServiceType, ServiceLicenceState>
  const purchased = billing.agentSeatCount
  const assigned = agentUids(gerance, billing).size
  return {
    services,
    subscribed,
    serviceAccounts,
    agents: { purchased, assigned, available: Math.max(purchased - assigned, 0) },
  }
}

// Ancienne formule (un prix par siège) : marquée "legacy" par la
// synchronisation, ou document écrit avant les licences (aucun modèle mais
// un abonnement) - à migrer avant tout ajout de licence.
export function isLegacyBilling(billing: GeranceBilling): boolean {
  return billing.licenceModel === "legacy" || (billing.licenceModel == null && !!billing.stripeSubscriptionId)
}

export function isBillingActive(billing: GeranceBilling): boolean {
  return billing.status === "active" || billing.status === "trialing"
}

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" })

export function formatCents(cents: number | null | undefined): string {
  return cents == null ? "—" : euros.format(cents / 100)
}

// Prix affichés tant que get_billing_overview n'a pas répondu (mêmes valeurs
// que PRICES, licence_billing.py).
export const DEFAULT_SERVICE_PRICE_CENTS = 1990
export const DEFAULT_AGENT_PRICE_CENTS = 990

// Pastille d'un compte : deux lettres tirées de l'adresse (« a.leroy » -> AL,
// « syndic » -> SY).
export function emailInitials(email: string | null | undefined): string {
  const local = (email ?? "").split("@")[0]
  const parts = local.split(/[._-]+/).filter(Boolean)
  const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : local.slice(0, 2)
  return (letters || "?").toUpperCase()
}
