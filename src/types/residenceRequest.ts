import type { Timestamp } from "firebase/firestore"

// Demande d'inscription de résidence envoyée depuis le formulaire public
// konodal.com (konodal_web/inscription-residence.html), écrite par
// submit_residence_request (functions_python/main.py) - offre gratuite
// uniquement : ni tantièmes, ni syndic, ni vote.
export type ResidenceRequestStatus = "pending" | "approved" | "rejected"

export type ResidenceRequestBuilding = {
  type: string
  name: string
}

export type ResidenceRequestLot = {
  batiment: string
  lot: string
  typeLot: string
  // Lot principal auquel ce lot dépendant (parking, cave...) est rattaché,
  // désigné par bâtiment + numéro (aucun id avant création) - devient
  // Lot.parentLotId à la validation.
  parent?: { batiment: string; lot: string } | null
}

// Pièce jointe de contexte (règlement, tantièmes, plan de masse...) - fichier
// Storage : residenceRequestUploads/{uid}/... (envoyé par le demandeur depuis
// le formulaire) ou residenceRequestFiles/{requestId}/... (ajouté depuis le BO).
export type ResidenceRequestAttachment = {
  path: string
  name: string
  size: number
  contentType: string
  addedBy: "requester" | "backoffice"
  addedAt?: Timestamp
}

// Email envoyé au demandeur depuis la page d'examen (send_email_callable,
// depuis support@konodal.com - les réponses arrivent dans cette boîte).
export type ResidenceRequestMessage = {
  subject: string
  body: string
  sentAt: Timestamp
  sentBy: string
  emailSent: boolean
}

export type ResidenceRequest = {
  id: string
  status: ResidenceRequestStatus
  plan: "gratuit"
  source: "web"
  createdAt: Timestamp | null
  requester: {
    // Compte Konodal connecté qui a envoyé la demande (vérifié côté serveur,
    // submit_residence_request) - absent des toutes premières demandes,
    // envoyées sans connexion.
    uid?: string
    firstName: string
    lastName: string
    email: string
    phone: string
    role: string
  }
  residence: {
    name: string
    address: {
      street: string
      complement: string
      zipCode: string
      city: string
    }
  }
  // Bâtiments déclarés, dans l'ordre de saisie - modèle StructureResidence
  // (type + nom, ex : "Bâtiment" + "A") ; Lot.batiment en reprend le libellé
  // "<type> <nom>" (structureLabel). Un bâtiment peut n'avoir aucun lot.
  // Absent des toutes premières demandes : déduit des lots.
  buildings?: ResidenceRequestBuilding[]
  lots: ResidenceRequestLot[]
  attachments?: ResidenceRequestAttachment[]
  messages?: ResidenceRequestMessage[]
  // Renseignés au traitement (BO, lib/residenceRequests.ts).
  residenceId?: string
  csMemberUid?: string | null
  rejectionReason?: string
  processedBy?: string
  processedAt?: Timestamp
}
