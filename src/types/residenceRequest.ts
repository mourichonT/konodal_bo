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
}

export type ResidenceRequest = {
  id: string
  status: ResidenceRequestStatus
  plan: "gratuit"
  source: "web"
  createdAt: Timestamp | null
  requester: {
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
  // Renseignés au traitement (BO, lib/residenceRequests.ts).
  residenceId?: string
  csMemberUid?: string | null
  rejectionReason?: string
  processedBy?: string
  processedAt?: Timestamp
}
