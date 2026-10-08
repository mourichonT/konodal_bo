import type { Lot } from "@/types/lot"
import { MajoriteLegale, type Ballot, type VoteQuestion } from "@/types/vote"

// Port fidèle de VoteResultsCalculator côté app mobile (connectkasa,
// lib/controllers/features/vote_results_calculator.dart) - calcul pur, pas
// de Cloud Function (échelle copropriété, quelques dizaines de lots/bulletins
// au plus). Toute divergence avec le Dart doit être volontaire : c'est le
// même calcul qui détermine si une résolution d'AG est adoptée.

// Réponse "officielle" d'un lot à une question, calculée en agrégeant les
// bulletins de tous ses copropriétaires. optionId est undefined en cas
// d'égalité stricte entre options (wasTie, abstention automatique) ou si
// aucun copropriétaire n'a répondu.
export type LotQuestionResult = {
  lotId: string
  optionId?: string
  wasTie: boolean
}

export function resultsForQuestion(ballots: Ballot[], questionId: string): LotQuestionResult[] {
  const byLot = new Map<string, Ballot[]>()
  for (const ballot of ballots) {
    const list = byLot.get(ballot.lotId) ?? []
    list.push(ballot)
    byLot.set(ballot.lotId, list)
  }

  return [...byLot.entries()].map(([lotId, lotBallots]) => {
    const counts = new Map<string, number>()
    for (const ballot of lotBallots) {
      const optionId = ballot.answers[questionId]
      if (optionId == null) continue
      counts.set(optionId, (counts.get(optionId) ?? 0) + 1)
    }
    if (counts.size === 0) return { lotId, wasTie: false }
    const maxCount = Math.max(...counts.values())
    const winners = [...counts.entries()].filter(([, count]) => count === maxCount)
    if (winners.length > 1) return { lotId, wasTie: true }
    return { lotId, optionId: winners[0][0], wasTie: false }
  })
}

// Nombre de lots ayant officiellement répondu chaque option - exclut les
// lots en égalité (abstention automatique) et ceux sans réponse.
export function tallyForQuestion(ballots: Ballot[], questionId: string): Record<string, number> {
  const tally: Record<string, number> = {}
  for (const result of resultsForQuestion(ballots, questionId)) {
    if (result.optionId == null) continue
    tally[result.optionId] = (tally[result.optionId] ?? 0) + 1
  }
  return tally
}

// Décompte pondéré par tantièmes d'une question d'assemblée générale.
// tantiemesParOption couvre TOUTES les options ; tantiemesPour/Contre/
// Abstention/NonRepondu sont les 4 catégories utilisées par
// evaluateMajority et se somment exactement à totalTantiemes.
export type WeightedTally = {
  tantiemesParOption: Record<string, number>
  tantiemesPour: number
  tantiemesContre: number
  tantiemesAbstention: number
  tantiemesNonRepondu: number
  totalTantiemes: number
  coproprietairesDistinctsPour: number
  coproprietairesDistinctsTotal: number
}

export function weightedTallyForQuestion({
  ballots,
  lots,
  question,
  nonResponseLotIds,
}: {
  ballots: Ballot[]
  lots: Lot[]
  question: VoteQuestion
  nonResponseLotIds: string[]
}): WeightedTally {
  const questionId = question.id
  const pourOptionId = question.options.length > 0 ? question.options[0].id : undefined
  const contreOptionId = question.options.length > 1 ? question.options[1].id : undefined

  // Tous les lots, pondérés par leurs tantièmes globaux (Lot.tantiemes) -
  // plus de clés de charge dédiées.
  const scopedLots = new Map<string, number>() // lotId -> tantièmes
  const coproprietairesTotal = new Set<string>()
  for (const lot of lots) {
    scopedLots.set(lot.id, lot.tantiemes)
    for (const uid of lot.idProprietaire) coproprietairesTotal.add(uid)
  }

  const resultByLot = new Map(resultsForQuestion(ballots, questionId).map((r) => [r.lotId, r]))
  const ballotsByLot = new Map<string, Ballot[]>()
  for (const ballot of ballots) {
    const list = ballotsByLot.get(ballot.lotId) ?? []
    list.push(ballot)
    ballotsByLot.set(ballot.lotId, list)
  }

  const tantiemesParOption: Record<string, number> = {}
  let tantiemesAbstention = 0
  let tantiemesNonRepondu = 0
  const coproprietairesPour = new Set<string>()

  for (const [lotId, tantiemes] of scopedLots) {
    if (nonResponseLotIds.includes(lotId)) {
      tantiemesNonRepondu += tantiemes
      continue
    }
    const optionId = resultByLot.get(lotId)?.optionId
    if (optionId == null) {
      tantiemesAbstention += tantiemes
      continue
    }
    tantiemesParOption[optionId] = (tantiemesParOption[optionId] ?? 0) + tantiemes
    if (optionId !== pourOptionId && optionId !== contreOptionId) {
      tantiemesAbstention += tantiemes
    }
    if (optionId === pourOptionId) {
      for (const ballot of ballotsByLot.get(lotId) ?? []) {
        if (ballot.answers[questionId] === pourOptionId) coproprietairesPour.add(ballot.uid)
      }
    }
  }

  const totalTantiemes = [...scopedLots.values()].reduce((a, b) => a + b, 0)

  return {
    tantiemesParOption,
    tantiemesPour: pourOptionId != null ? (tantiemesParOption[pourOptionId] ?? 0) : 0,
    tantiemesContre: contreOptionId != null ? (tantiemesParOption[contreOptionId] ?? 0) : 0,
    tantiemesAbstention,
    tantiemesNonRepondu,
    totalTantiemes,
    coproprietairesDistinctsPour: coproprietairesPour.size,
    coproprietairesDistinctsTotal: coproprietairesTotal.size,
  }
}

export type MajoriteStatus = "adoptee" | "rejetee" | "passerelle25_1" | "passerelle26_1"

export type MajorityOutcome = {
  status: MajoriteStatus
}

// Statut légal d'une question d'assemblée générale selon sa majorité requise
// et son décompte pondéré - arithmétique entière exclusivement (produits
// croisés plutôt que divisions) pour éviter tout écart d'arrondi sur un
// seuil légal.
export function evaluateMajority(question: VoteQuestion, tally: WeightedTally): MajorityOutcome {
  switch (question.majoriteRequise) {
    case MajoriteLegale.art25: {
      // Adoptée : Pour > 50% du total. Sinon, passerelle 25-1 si autorisée
      // et Pour atteint au moins 33,33% (quorum de représentativité).
      if (tally.tantiemesPour * 2 > tally.totalTantiemes) return { status: "adoptee" }
      if (question.passerelleActivee && tally.tantiemesPour * 3 >= tally.totalTantiemes) {
        return { status: "passerelle25_1" }
      }
      return { status: "rejetee" }
    }

    case MajoriteLegale.art26: {
      // Adoptée : majorité EN NOMBRE de copropriétaires ET ces
      // copropriétaires représentent au moins 66,67% des tantièmes. Sinon,
      // passerelle 26-1 si les tantièmes représentés atteignent au moins
      // 50% du total.
      const majoriteEnNombre =
        tally.coproprietairesDistinctsPour * 2 > tally.coproprietairesDistinctsTotal
      const majoriteEnTantiemes = tally.tantiemesPour * 3 >= tally.totalTantiemes * 2
      if (majoriteEnNombre && majoriteEnTantiemes) return { status: "adoptee" }
      const tantiemesRepresentes =
        tally.tantiemesPour + tally.tantiemesContre + tally.tantiemesAbstention
      if (question.passerelleActivee && tantiemesRepresentes * 2 >= tally.totalTantiemes) {
        return { status: "passerelle26_1" }
      }
      return { status: "rejetee" }
    }

    case MajoriteLegale.unanimite: {
      // Adoptée uniquement si 100% des tantièmes de la clé ont voté Pour.
      if (tally.totalTantiemes > 0 && tally.tantiemesPour === tally.totalTantiemes) {
        return { status: "adoptee" }
      }
      return { status: "rejetee" }
    }

    case MajoriteLegale.art24:
    default:
      // Majorité simple des tantièmes exprimés (abstentions et non-réponses
      // exclues du dénominateur).
      return tally.tantiemesPour > tally.tantiemesContre ? { status: "adoptee" } : { status: "rejetee" }
  }
}

// Somme des tantièmes globaux de tous les lots de la résidence.
export function totalTantiemesResidence(lots: Lot[]): number {
  return lots.reduce((total, lot) => total + lot.tantiemes, 0)
}
