import type { Address } from "@/types/residence"

export type KonodalUser = {
  uid: string
  email: string
  name: string
  surname: string
  phone: string
  // Champ BO uniquement (profil des comptes agence/agent/superAdmin) -
  // absent du modèle Dart côté app résident, pas de contrepartie côté
  // mobile pour ce champ précis (contrairement à name/surname/phone,
  // partagés avec le modèle résident).
  address?: Address
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
  // Comptes agence/agent uniquement (RBAC) - posé par
  // invite_agency_account (true)/revoke_agency_account (false). Absent sur
  // les comptes résident/bailleur classiques. L'appartenance aux tableaux
  // d'agents de la gérance reste la source de vérité pour les règles
  // Firestore ; ce champ n'est qu'un signal lisible directement sur la
  // fiche, pas un mécanisme d'autorisation.
  active?: boolean
}
