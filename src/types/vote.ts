import { Timestamp } from "firebase/firestore"

// Miroir de Vote/VoteQuestion/VoteOption côté app mobile (connectkasa,
// lib/models/pages_models/vote.dart) - stocké en sous-collection
// residences/{id}/votes/{voteId}. Jamais renommer ces champs, lus tels quels
// par functions_python/main.py (finalize_ag_question_non_responses) et par
// l'app mobile.

export const VoteType = {
  sondage: "sondage",
  assembleeGenerale: "assemblee_generale",
} as const
export type VoteTypeValue = (typeof VoteType)[keyof typeof VoteType]

// Majorité légale requise pour l'adoption d'une résolution d'assemblée
// générale (loi de 1965). Convention : la PREMIÈRE option d'une question est
// toujours "Pour" au sens légal, la 2ème "Contre" - à respecter dans l'ordre
// des options saisi à la création (cf. VoteFormDialog).
export const MajoriteLegale = {
  art24: "ART_24",
  art25: "ART_25",
  art26: "ART_26",
  unanimite: "UNANIMITE",
} as const
export type MajoriteLegaleValue = (typeof MajoriteLegale)[keyof typeof MajoriteLegale]

export const majoriteLegaleLabels: Record<MajoriteLegaleValue, string> = {
  [MajoriteLegale.art24]: "Art. 24 — majorité simple",
  [MajoriteLegale.art25]: "Art. 25 — majorité absolue",
  [MajoriteLegale.art26]: "Art. 26 — double majorité",
  [MajoriteLegale.unanimite]: "Unanimité",
}

export type VoteOption = {
  id: string
  label: string
}

export type VoteQuestion = {
  id: string
  text: string
  options: VoteOption[]
  durationSeconds: number
  // Assemblée générale uniquement (null pour un sondage) - une des
  // constantes MajoriteLegale.
  majoriteRequise: MajoriteLegaleValue | null
  // Sous-ensemble de lots concernés (cf. ClefCharge) - GENERAL_CLEF_CHARGE_ID
  // par défaut (tous les lots de la résidence, tantièmes généraux).
  cleChargeId: string
  // Renseigné uniquement sur une question "passerelle" injectée
  // automatiquement côté serveur (finalize_ag_question_non_responses) suite
  // à l'échec d'une question ART_25/ART_26 ayant atteint le quorum de
  // représentativité - pointe vers l'id de la question d'origine.
  sourceQuestionId: string | null
  // Pertinent uniquement pour ART_25/ART_26 - autorise ou non le
  // déclenchement automatique de la passerelle 25-1/26-1.
  passerelleActivee: boolean
  // Instant où la question a été manuellement lancée - null tant qu'elle
  // n'a pas encore été lancée.
  startedAt: Timestamp | null
}

export type Vote = {
  id: string
  residenceId: string
  type: VoteTypeValue
  title: string
  description: string
  questions: VoteQuestion[]
  createdBy: string
  createdAt: Timestamp
  closingAt: Timestamp
  // Assemblée générale : instant d'ouverture de la session (démarre
  // uniquement sur action manuelle) - null tant que la session n'a pas
  // commencé.
  startedAt: Timestamp | null
  // Mise en pause manuelle : tant qu'il est renseigné, toute progression de
  // la session (index de question active, chronomètre) reste figée.
  pausedAt: Timestamp | null
  // Assemblée générale uniquement : questionId -> lotIds n'ayant reçu aucun
  // bulletin pour cette question, calculé côté serveur
  // (finalize_ag_question_non_responses).
  nonResponseLots: Record<string, string[]>
}

export type Ballot = {
  lotId: string
  uid: string
  answers: Record<string, string>
  castAt: Timestamp
}

export type Presence = {
  lotId: string
  uid: string
  confirmedAt: Timestamp
}

// Marge entre le closingAt posé côté serveur (verrou d'écriture Firestore)
// et la fin réelle d'une question - généreuse (30 min), repoussée à chaque
// lancement/reprise de question. Miroir exact de
// vote_detail_page.dart:_closingAtBufferSeconds.
export const CLOSING_AT_BUFFER_SECONDS = 30 * 60

export function isVotePaused(vote: Vote): boolean {
  return vote.pausedAt != null
}

function effectiveNow(vote: Vote): Date {
  return isVotePaused(vote) ? vote.pausedAt!.toDate() : new Date()
}

export function isVoteClosed(vote: Vote): boolean {
  return effectiveNow(vote).getTime() > vote.closingAt.toDate().getTime()
}

export function isVoteStarted(vote: Vote): boolean {
  return vote.startedAt != null
}

// Index de la question EN COURS (chrono pas encore écoulé) - -1 si aucune
// question n'est actuellement en cours. Miroir de Vote.activeQuestionIndex.
export function activeQuestionIndex(vote: Vote): number {
  const now = effectiveNow(vote).getTime()
  for (let i = 0; i < vote.questions.length; i++) {
    const startedAt = vote.questions[i].startedAt
    if (startedAt == null) continue
    const elapsedSeconds = (now - startedAt.toDate().getTime()) / 1000
    if (elapsedSeconds < vote.questions[i].durationSeconds) return i
  }
  return -1
}

// true une fois TOUTES les questions lancées ET leur chrono écoulé. Miroir
// de Vote.isSessionFinished.
export function isSessionFinished(vote: Vote): boolean {
  if (!isVoteStarted(vote) || vote.questions.length === 0) return false
  const now = effectiveNow(vote).getTime()
  return vote.questions.every((q) => {
    if (q.startedAt == null) return false
    return now >= q.startedAt.toDate().getTime() + q.durationSeconds * 1000
  })
}

export function nonResponseCountForQuestion(vote: Vote, questionId: string): number {
  return vote.nonResponseLots[questionId]?.length ?? 0
}

export function passerelleQuestionFor(vote: Vote, questionId: string): VoteQuestion | null {
  return vote.questions.find((q) => q.sourceQuestionId === questionId) ?? null
}

// Instant de fin du temps de réponse de la question active - null si aucune
// question n'est en cours.
export function activeQuestionEndsAt(vote: Vote): Date | null {
  const idx = activeQuestionIndex(vote)
  if (idx < 0) return null
  const q = vote.questions[idx]
  return new Date(q.startedAt!.toDate().getTime() + q.durationSeconds * 1000)
}
