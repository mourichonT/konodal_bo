import type { ComponentProps, ReactNode } from "react"
import { KeyRound, Landmark, type LucideIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { ServiceType } from "@/types/gerance"

// Fiche agence (maquettes « Agence Compte BO Konodal » et « Agence Gestion
// Compte Konodal ») : champs plus hauts que l'Input par défaut, pictogramme
// de chaque service, bouton de révocation, pastilles de statut.
export const FIELD_CLASS = "h-10 rounded-[10px] bg-white"
export const REVOKE_BUTTON_CLASS =
  "h-8 rounded-full border-[oklch(85%_0.07_25)] bg-[oklch(98.5%_0.01_25)] px-3 text-[12.5px] font-bold text-[oklch(48%_0.17_27)] hover:bg-[oklch(96%_0.025_25)] hover:text-[oklch(42%_0.17_27)]"
export const serviceIcons: Record<ServiceType, LucideIcon> = {
  serviceSyndic: Landmark,
  geranceLocative: KeyRound,
}

// Nom affiché de l'agence : limite demandée explicitement, avec blocage à
// l'enregistrement (pas seulement une troncature silencieuse via maxLength,
// qui ne rattrape pas un nom déjà trop long chargé depuis Firestore avant
// l'ajout de cette limite).
export const AGENCY_NAME_MAX_LENGTH = 20

// Titres de colonnes et de sections (petites capitales de la maquette).
export const CAPS_LABEL_CLASS = "text-[11.5px] font-extrabold tracking-[0.05em] text-[oklch(50%_0.01_150)] uppercase"
export const TITLE_CLASS = "text-[15px] font-extrabold text-[oklch(22%_0.01_150)]"
export const OUTLINE_BUTTON_CLASS = "h-9 rounded-[11px] bg-white px-3 text-[13px] font-bold"
export const LINK_BUTTON_CLASS =
  "text-[13px] font-bold text-[oklch(38%_0.09_155)] hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline"
export const TINT_BG_CLASS = "bg-[oklch(97.5%_0.02_160)]"
export const ROW_BORDER_CLASS = "border-t border-[oklch(94%_0.004_100)]"

export type PillTone = "green" | "amber" | "grey" | "red"

const PILL_TONES: Record<PillTone, string> = {
  green: "bg-[oklch(93%_0.07_160)] text-[oklch(36%_0.11_160)]",
  amber: "bg-[oklch(94%_0.07_85)] text-[oklch(45%_0.11_65)]",
  grey: "bg-[oklch(94.5%_0.004_100)] text-[oklch(45%_0.01_150)]",
  red: "bg-[oklch(94%_0.04_25)] text-[oklch(45%_0.16_27)]",
}

export function Pill({ tone, children, className }: { tone: PillTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-bold whitespace-nowrap",
        PILL_TONES[tone],
        className
      )}
    >
      {children}
    </span>
  )
}

// Pastille ronde aux initiales d'un compte.
export function Avatar({ initials, className }: { initials: string; className?: string }) {
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full bg-[oklch(95%_0.006_100)] text-[11.5px] font-extrabold text-[oklch(35%_0.02_150)]",
        className
      )}
    >
      {initials}
    </span>
  )
}

// « 12 oct. »
export function formatShortDate(date: Date): string {
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
}

// « 1er novembre 2026 », « 12 novembre 2026 »
export function formatLongDate(date: Date): string {
  const day = date.getDate()
  return `${day === 1 ? "1er" : day} ${date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}`
}

// « il y a 2 min », « il y a 3 h », « le 12 oct. »
export function formatSince(date: Date, now = new Date()): string {
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000)
  if (minutes < 1) return "à l'instant"
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `il y a ${days} j`
  return `le ${formatShortDate(date)}`
}

// Input précédé d'un pictogramme (email, téléphone).
export function IconInput({ icon: Icon, className, ...props }: ComponentProps<typeof Input> & { icon: LucideIcon }) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <Icon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input {...props} className={cn(FIELD_CLASS, "pl-9")} />
    </div>
  )
}
