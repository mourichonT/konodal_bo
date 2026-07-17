// Reflète Post (type "events") côté app mobile - seul le sous-type
// "prestation" est géré par le backoffice (cf. mémoire scope-vision), les
// events "interne" (participatifs, gérés par les membres du Conseil
// Syndical) ne sont ni affichés ni modifiables ici.
export const EVENT_TYPE_PRESTATION = "prestation"

export type ResidenceEvent = {
  id: string
  residenceId: string
  title: string
  description: string
  eventDate: Date | null
  prestaName: string
  creationDate: Date | null
  user: string
}
