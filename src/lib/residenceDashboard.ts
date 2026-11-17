import { httpsCallable } from "firebase/functions"
import { functions } from "@/firebase"

// Tableau de bord d'une résidence (onglet de la fiche résidence, 16/11/2026) :
// mêmes huit indicateurs que la page « Tableau de bord » du CS dans l'app,
// calculés à la demande par la même callable cs_dashboard_stats
// (konodal_app/functions_python/cs_dashboard.py), ouverte au syndic de la
// résidence (agence et agents) en plus du CS et des superAdmin. Rien n'est
// stocké : chaque appel relit les données de la résidence sur 12 mois.

export type DashboardPendingSinistre = {
  id: string
  title: string
  statut: string // "Transmis" ou "En cours"
  high: boolean // priorité haute posée dans le BO
  days: number // jours depuis la transmission
}

export type DashboardHotspot = {
  building: string
  element: string
  declarants: number
  sinistres: number
}

export type DashboardProvider = {
  name: string
  interventions: number
  rescheduled: number
  withoutReport: number
}

export type DashboardBuildingCoverage = { name: string; lots: number; covered: number }

export type DashboardCommunication = {
  id: string
  title: string
  text: string
  date: number
  views: number
  public: number
  ratio: number | null
}

export type DashboardVote = {
  id: string
  title: string
  type: string // "sondage" ou "assemblee_generale"
  closingAt: number | null
  lotsVoted: number
  lotsTotal: number
  weighted: boolean // false : part en nombre de lots (tantièmes non saisis)
  share: number | null
  open: boolean
  createdAt: number | null
}

export type ResidenceDashboard = {
  generatedAt: number
  windowDays: number
  pending: { total: number; high: number; stale: number; oldest: DashboardPendingSinistre[] }
  resolution: { medianDays: number | null; count: number }
  hotspots: DashboardHotspot[]
  providers: { interventions: number; providers: DashboardProvider[] }
  mail: { messages: number; answered: number; medianHours: number | null; unanswered: number }
  coverage: { lots: number; covered: number; buildings: DashboardBuildingCoverage[] }
  communications: { count: number; averageRatio: number | null; latest: DashboardCommunication[] }
  votes: DashboardVote[]
}

// Une grosse résidence (plusieurs centaines de lots, des milliers de posts)
// peut dépasser les 70 s par défaut du SDK ; la fonction en a 120.
const dashboardStats = httpsCallable<{ residenceId: string }, ResidenceDashboard>(
  functions,
  "cs_dashboard_stats",
  { timeout: 120_000 }
)

export async function fetchResidenceDashboard(residenceId: string): Promise<ResidenceDashboard> {
  const { data } = await dashboardStats({ residenceId })
  return data
}
