export type KonodalUser = {
  uid: string
  email: string
  name: string
  surname: string
  phone: string
  // Même champ que le modèle Dart partagé (User.profilPic, sous 'profil') -
  // affiché partout où l'app montre l'auteur d'un post/commentaire
  // (ProfilTile), donc une photo posée ici depuis le BO apparaît aussi
  // côté résident si ce compte interagit avec l'app.
  profilePic?: string
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
  // Résidences pour lesquelles ce compte a au moins un lot en attente de
  // validation (isApprovedLot: false côté users/{uid}/lots) - dénormalisé
  // côté serveur par sync_pending_lot_residences (functions_python/main.py,
  // repo konodal_app), qui n'a pas de collectionGroup disponible sur "lots"
  // pour le calculer à la volée. Depuis que isApproved (identité) n'est plus
  // le prérequis d'accès à l'app (compte créé approuvé par défaut, la
  // validation d'identité devient une certification optionnelle), c'est ce
  // champ qui pilote la pastille "Utilisateurs" (cf. usePendingUsersCount),
  // pas isApproved.
  pendingLotResidenceIds: string[]
  // Statut distinct de isApproved (qui n'est plus qu'un prérequis
  // automatique, cf. plus haut) : "Certifié" est une vérification manuelle
  // à part entière, accordée par un superAdmin une fois la pièce
  // d'identité vérifiée ET les données confirmées exactes - jamais posé
  // automatiquement, jamais retiré par une resoumission côté app
  // (contrairement à isApproved/rejectionReason, remis à zéro par
  // submit_user.dart).
  isCertified: boolean
  // Demande de certification envoyée depuis l'app (certificationRequests/
  // {uid}, cf. lib/certification.ts) : "pending" tant qu'un superAdmin n'a
  // pas tranché, "rejected" après refus - null sinon (jamais demandée, ou
  // certifiée). Posé par submit_certification_request côté serveur,
  // effacé/mis à jour par la décision BO.
  certificationStatus: "pending" | "rejected" | null
  // Résidences dont l'accès est suspendu (decide_resident_removal) - écrit
  // par le serveur, levé par unblock_resident.
  blockedResidencesIds: string[]
}
