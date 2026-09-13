// Clé de répartition des charges d'une résidence (loi de 1965) - miroir
// exact de ClefCharge côté app mobile (connectkasa,
// lib/models/pages_models/clef_charge.dart). Stockée en sous-collection
// residences/{id}/clesCharge/{clefId} - jamais renommer ces champs, lus tels
// quels par functions_python/main.py côté serveur (calcul de majorité
// pondérée des votes).
export type ClefCharge = {
  id: string
  residenceId: string
  nom: string
  // Tantième de CHAQUE lot pour CETTE clé, par id de lot
  // (residences/{id}/lots/{lotId}) - un lot absent de cette map vaut 0 pour
  // cette clé. Distinct du tantième général Lot.tantiemes (types/lot.ts),
  // utilisé seulement quand aucune clé dédiée ne s'applique (cf.
  // GENERAL_CLEF_CHARGE_ID).
  tantiemesParLot: Record<string, number>
}

// Sentinelle utilisée par VoteQuestion.cleChargeId côté app mobile pour dire
// "pas de clé dédiée" : les tantièmes utilisés sont alors Lot.tantiemes de
// chaque lot, pas une ClefCharge - jamais un vrai document de la
// sous-collection clesCharge.
export const GENERAL_CLEF_CHARGE_ID = "GENERAL"

export function totalTantiemes(clef: Pick<ClefCharge, "tantiemesParLot">): number {
  return Object.values(clef.tantiemesParLot).reduce((sum, v) => sum + v, 0)
}
