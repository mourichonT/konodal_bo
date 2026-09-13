import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore"
import { httpsCallable } from "firebase/functions"
import { db, functions } from "@/firebase"
import { GENERAL_CLEF_CHARGE_ID } from "@/types/clefCharge"
import type { Ballot, Presence, Vote, VoteOption, VoteQuestion } from "@/types/vote"
import { VoteType } from "@/types/vote"

// Miroir de FirestoreVoteRepository côté app mobile (connectkasa,
// lib/core/repositories/firestore_vote_repository.dart) - mêmes chemins,
// mêmes noms de champs (lus par functions_python/main.py et par l'app
// mobile elle-même, jamais à renommer indépendamment).

function votesCollection(residenceId: string) {
  return collection(db, "residences", residenceId, "votes")
}
function voteDoc(residenceId: string, voteId: string) {
  return doc(db, "residences", residenceId, "votes", voteId)
}
function ballotsCollection(residenceId: string, voteId: string) {
  return collection(db, "residences", residenceId, "votes", voteId, "ballots")
}
function presencesCollection(residenceId: string, voteId: string) {
  return collection(db, "residences", residenceId, "votes", voteId, "presences")
}

function optionFromMap(m: Record<string, unknown>): VoteOption {
  return { id: (m.id as string) ?? "", label: (m.label as string) ?? "" }
}

function questionFromMap(m: Record<string, unknown>): VoteQuestion {
  return {
    id: (m.id as string) ?? "",
    text: (m.text as string) ?? "",
    options: Array.isArray(m.options)
      ? (m.options as Record<string, unknown>[]).map(optionFromMap)
      : [],
    durationSeconds: typeof m.durationSeconds === "number" ? m.durationSeconds : 60,
    majoriteRequise: (m.majoriteRequise as VoteQuestion["majoriteRequise"]) ?? null,
    cleChargeId: (m.cleChargeId as string) ?? GENERAL_CLEF_CHARGE_ID,
    sourceQuestionId: (m.sourceQuestionId as string) ?? null,
    passerelleActivee: m.passerelleActivee !== false,
    startedAt: (m.startedAt as Timestamp) ?? null,
  }
}

function questionToMap(q: VoteQuestion): Record<string, unknown> {
  return {
    id: q.id,
    text: q.text,
    options: q.options.map((o) => ({ id: o.id, label: o.label })),
    durationSeconds: q.durationSeconds,
    ...(q.majoriteRequise != null ? { majoriteRequise: q.majoriteRequise } : {}),
    cleChargeId: q.cleChargeId,
    ...(q.sourceQuestionId != null ? { sourceQuestionId: q.sourceQuestionId } : {}),
    passerelleActivee: q.passerelleActivee,
    ...(q.startedAt != null ? { startedAt: q.startedAt } : {}),
  }
}

function voteFromDoc(id: string, data: Record<string, unknown>): Vote {
  return {
    id,
    residenceId: (data.residenceId as string) ?? "",
    type: (data.type as Vote["type"]) ?? VoteType.sondage,
    title: (data.title as string) ?? "",
    description: (data.description as string) ?? "",
    questions: Array.isArray(data.questions)
      ? (data.questions as Record<string, unknown>[]).map(questionFromMap)
      : [],
    createdBy: (data.createdBy as string) ?? "",
    createdAt: (data.createdAt as Timestamp) ?? Timestamp.now(),
    closingAt: (data.closingAt as Timestamp) ?? Timestamp.now(),
    startedAt: (data.startedAt as Timestamp) ?? null,
    pausedAt: (data.pausedAt as Timestamp) ?? null,
    nonResponseLots: (data.nonResponseLots as Record<string, string[]>) ?? {},
  }
}

function voteToMap(v: Vote): Record<string, unknown> {
  return {
    residenceId: v.residenceId,
    type: v.type,
    title: v.title,
    description: v.description,
    questions: v.questions.map(questionToMap),
    createdBy: v.createdBy,
    createdAt: v.createdAt,
    closingAt: v.closingAt,
    ...(v.startedAt != null ? { startedAt: v.startedAt } : {}),
    ...(v.pausedAt != null ? { pausedAt: v.pausedAt } : {}),
    ...(Object.keys(v.nonResponseLots).length > 0 ? { nonResponseLots: v.nonResponseLots } : {}),
  }
}

export function subscribeToVotes(
  residenceId: string,
  onData: (votes: Vote[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const q = query(votesCollection(residenceId), orderBy("createdAt", "desc"))
  return onSnapshot(
    q,
    (snapshot) => onData(snapshot.docs.map((d) => voteFromDoc(d.id, d.data()))),
    onError
  )
}

export function subscribeToVote(
  residenceId: string,
  voteId: string,
  onData: (vote: Vote | null) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    voteDoc(residenceId, voteId),
    (snapshot) => onData(snapshot.exists() ? voteFromDoc(snapshot.id, snapshot.data()) : null),
    onError
  )
}

// L'id est fixé côté client (crypto.randomUUID()) avant l'appel, même
// principe que Uuid().v1() côté app mobile (VoteForm) - garantit que
// vote.id (utilisé pour toute écriture ultérieure) correspond toujours au
// document réel.
export async function createVote(residenceId: string, vote: Vote): Promise<void> {
  await setDoc(voteDoc(residenceId, vote.id), voteToMap(vote))
}

// Remplacement complet du document - utilisé pour toute mutation de la
// session live (lancer une question, sauter/reprendre après pause...), même
// principe que FirestoreVoteRepository.updateVote côté app mobile.
export async function saveVote(residenceId: string, vote: Vote): Promise<void> {
  await setDoc(voteDoc(residenceId, vote.id), voteToMap(vote))
}

export async function deleteVote(residenceId: string, voteId: string): Promise<void> {
  await deleteDoc(voteDoc(residenceId, voteId))
}

// Ouvre la session (fait passer de l'aperçu à la liste des questions) - pose
// startedAt une seule fois et un closingAt initial généreux (repoussé
// ensuite à chaque lancement/reprise de question, cf. saveVote).
export async function startVoteSession(
  residenceId: string,
  voteId: string,
  startedAt: Timestamp,
  closingAt: Timestamp
): Promise<void> {
  await updateDoc(voteDoc(residenceId, voteId), { startedAt, closingAt })
}

// Fige/défige le chronomètre de la question en cours pour TOUS les
// participants - un seul champ pour toute la session (au plus une question
// en cours à la fois).
export async function setVotePausedAt(
  residenceId: string,
  voteId: string,
  pausedAt: Timestamp | null
): Promise<void> {
  await updateDoc(voteDoc(residenceId, voteId), { pausedAt })
}

export function subscribeToBallots(
  residenceId: string,
  voteId: string,
  onData: (ballots: Ballot[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    ballotsCollection(residenceId, voteId),
    (snapshot) => onData(snapshot.docs.map((d) => d.data() as Ballot)),
    onError
  )
}

export function subscribeToPresences(
  residenceId: string,
  voteId: string,
  onData: (presences: Presence[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    presencesCollection(residenceId, voteId),
    (snapshot) => onData(snapshot.docs.map((d) => d.data() as Presence)),
    onError
  )
}

// Marque "non répondu" les lots n'ayant reçu aucun bulletin pour [questionId]
// une fois son temps de réponse écoulé, et injecte le cas échéant la
// question "passerelle" (25-1/26-1) - même Cloud Function callable que l'app
// mobile (region europe-west9, cf. vote_detail_page.dart:_maybeFinalizeQuestion).
export async function finalizeAgQuestionNonResponses(
  residenceId: string,
  voteId: string,
  questionId: string
): Promise<void> {
  await httpsCallable(
    functions,
    "finalize_ag_question_non_responses"
  )({ residenceId, voteId, questionId })
}
