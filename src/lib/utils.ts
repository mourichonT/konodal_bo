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

// Mêmes tokens que PRIMARY_CTA_CLASS mais en valeurs brutes, pour les pages
// publiques "Refonte offres 2026" (OfferPage, SharedInterventionPage) qui
// stylent leurs éléments en inline style plutôt qu'en classes Tailwind.
export const CARD_SHADOW = "0 1px 2px oklch(20% 0 0 / 0.04), 0 12px 32px -18px oklch(20% 0 0 / 0.12)"
export const CTA_GRADIENT = "linear-gradient(135deg, oklch(45% 0.08 155), oklch(38% 0.075 158))"
export const CTA_SHADOW = "0 10px 26px -10px oklch(38% 0.08 155 / 0.55)"
