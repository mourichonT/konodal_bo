import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Bouton d'action principal (Enregistrer/Publier/Importer...) des modales de
// formulaire - dégradé vert repris de la page d'offre publique
// (OfferPage.tsx), généralisé à toutes les modales pour rester cohérent
// avec le reste de la refonte (cf. GeranceFormDialog, AgencesPage.tsx).
export const PRIMARY_CTA_CLASS =
  "border-0 bg-[linear-gradient(135deg,oklch(45%_0.08_155),oklch(38%_0.075_158))] shadow-[0_8px_20px_-8px_oklch(38%_0.08_155/0.55)] hover:brightness-[1.06]"

// Cartes de la fiche agence (maquette « Agence Compte BO Konodal ») : panneau
// blanc, et pastille d'icône à gauche d'un titre (verte quand actif).
export const PANEL_CARD_CLASS =
  "rounded-[22px] border border-[oklch(93%_0.005_100)] bg-white p-[20px_22px] shadow-[0_1px_2px_oklch(20%_0_0/0.03),0_12px_32px_-22px_oklch(20%_0_0/0.12)]"
export const ICON_TILE_CLASS = "flex size-10 shrink-0 items-center justify-center rounded-[12px] [&>svg]:size-[18px]"
export const ICON_TILE_ON_CLASS = "bg-[oklch(93%_0.05_150)] text-[oklch(32%_0.09_155)]"
export const ICON_TILE_OFF_CLASS = "bg-[oklch(95.5%_0.006_250)] text-[oklch(45%_0.02_250)]"

// Mêmes tokens que PRIMARY_CTA_CLASS mais en valeurs brutes, pour les pages
// publiques "Refonte offres 2026" (OfferPage, SharedInterventionPage) qui
// stylent leurs éléments en inline style plutôt qu'en classes Tailwind.
export const CARD_SHADOW = "0 1px 2px oklch(20% 0 0 / 0.04), 0 12px 32px -18px oklch(20% 0 0 / 0.12)"
export const CTA_GRADIENT = "linear-gradient(135deg, oklch(45% 0.08 155), oklch(38% 0.075 158))"
export const CTA_SHADOW = "0 10px 26px -10px oklch(38% 0.08 155 / 0.55)"

// URL racine du BO (origine + préfixe de déploiement, sans slash final) à
// transmettre aux Cloud Functions qui construisent des liens `${origin}/...`
// (invitation /offre/:token, retours Stripe /facturation...). En prod le BO
// est servi sous konodal.com/portail/ (cf. vite.config.ts) : window.location
// .origin seul produirait des liens konodal.com/offre/... inexistants.
export function appBaseUrl(): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}`.replace(/\/$/, "")
}
