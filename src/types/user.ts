export type KonodalUser = {
  uid: string
  email: string
  name: string
  surname: string
  phone: string
  isApproved: boolean
  accountType: string
  createdDate: Date | null
  // Regroupées sous 'user' côté Firestore : identité issue de la pièce
  // d'identité à l'inscription (cf. User.dart côté app mobile).
  birthday: Date | null
  sex: string
  nationality: string
  placeOfborn: string
  isInfoCorrect: boolean
  // Renseigné uniquement après un refus explicite (backoffice) - absent tant
  // que le compte est simplement pas encore examiné. Affiché à l'utilisateur
  // dans l'app mobile (NoApprovalPage) et jamais réécrit par elle.
  rejectionReason: string | null
}
