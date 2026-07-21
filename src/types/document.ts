// Catégories de documents de résidence (documents_copro) - reprises
// verbatim de TypeList.categoryDocs() côté app mobile
// (connectkasa/lib/models/enum/type_list.dart), pour que les documents
// créés depuis le BO restent cohérents avec ce que les résidents voient
// déjà dans l'app.
export const RESIDENCE_DOCUMENT_CATEGORIES = [
  "Gestion du syndic",
  "Assemblées générales",
  "Contrats et marchés",
  "Assurances",
  "Carnet d'entretien et gestion technique",
  "Synthèse et fiches officielles",
  "Documents juridiques de la copropriété",
] as const

export type ResidenceDocument = {
  id: string
  residenceId: string
  name: string
  // Mappé sur le champ Firestore `type` (DocumentModel côté app mobile) -
  // string libre, pas un enum validé par les règles.
  category: string
  documentPathRecto: string
  extension: string
  timeStamp: Date | null
}

export type ResidenceDocumentInput = {
  name: string
  category: string
  file: File
}

// Catégories de documents de lot - propres au BO. L'app mobile utilise
// aujourd'hui la même liste categoryDocs() que ci-dessus pour son propre
// formulaire "document individuel" (add_docs_form.dart), ce qui ne couvre
// pas "appel de fonds"/"quittance" - `type` n'étant pas un enum validé par
// les règles Firestore, rien n'empêche le BO d'utiliser ses propres
// libellés, lus tels quels par l'app.
export const LOT_DOCUMENT_CATEGORIES = ["Appel de fonds", "Quittance de loyer", "Bail", "Justificatif", "Autre"] as const

export type LotDocumentRole = "proprietaire" | "locataire"

// Pré-coche les destinataires les plus probables selon la catégorie
// choisie (modifiable ensuite dans le dialog) - Justificatif/Autre n'ont
// pas de destinataire évident, laissés à choisir manuellement.
export function defaultRecipientRolesForCategory(category: string): LotDocumentRole[] {
  switch (category) {
    case "Appel de fonds":
      return ["proprietaire"]
    case "Quittance de loyer":
      return ["locataire"]
    case "Bail":
      return ["proprietaire", "locataire"]
    default:
      return []
  }
}

export type LotDocument = {
  id: string
  lotId: string
  residenceId: string
  name: string
  category: string
  documentPathRecto: string
  extension: string
  timeStamp: Date | null
  // uids ayant chacun leur propre copie Firestore de ce document (même
  // docId réutilisé sur chaque copie) - cf. lib/lotDocuments.ts.
  recipientUids: string[]
}

export type LotDocumentInput = {
  name: string
  category: string
  file: File
  recipientUids: string[]
}
