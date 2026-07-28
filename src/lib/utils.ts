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
