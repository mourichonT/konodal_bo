import { useEffect, useState } from "react"
import { doc, getDoc } from "firebase/firestore"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { db } from "@/firebase"
import { createProMission } from "@/lib/proAccounts"
import { resolveUsersByUids } from "@/lib/users"
import { PRIMARY_CTA_CLASS } from "@/lib/utils"
import { ProComplianceBadge } from "@/components/pro/ProComplianceBadge"
import type { Contact, ContactPro } from "@/types/contact"
import type { KonodalUser } from "@/types/user"

type ProContact = Pick<Contact, "id" | "name" | "service"> & { pro: ContactPro }

// « Mandater » depuis un sinistre : mission confiée à un prestataire
// Konodal Pro de la résidence (contacts.pro), qui l'accepte, planifie et
// dépose son compte-rendu dans sa webapp. Seule une entreprise conforme
// (pièces à jour) peut être mandatée (pro_create_mission). Un prestataire
// sans compte reste sur « Programmer une intervention » (mail avec lien).
export function MandateDialog({
  open,
  onOpenChange,
  residenceId,
  sinistreId,
  contactRefs,
  csmembers,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  residenceId: string
  sinistreId: string
  contactRefs?: Record<string, boolean>
  csmembers?: string[]
}) {
  const [contacts, setContacts] = useState<ProContact[] | null>(null)
  const [csUsers, setCsUsers] = useState<KonodalUser[]>([])
  const [contactId, setContactId] = useState<string | null>(null)
  const [message, setMessage] = useState("")
  const [urgence, setUrgence] = useState(false)
  const [csIds, setCsIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setContactId(null)
    setMessage("")
    setUrgence(false)
    setCsIds([])
    const ids = Object.keys(contactRefs ?? {}).filter((id) => contactRefs?.[id])
    Promise.all(ids.map((id) => getDoc(doc(db, "contacts", id))))
      .then((snaps) =>
        setContacts(
          snaps
            .filter((s) => s.exists() && (s.data()?.pro as ContactPro | undefined)?.entrepriseId)
            .map((s) => ({
              id: s.id,
              name: (s.data()?.name as string) ?? "",
              service: (s.data()?.service as string) ?? "",
              pro: s.data()?.pro as ContactPro,
            }))
        )
      )
      .catch((err) => {
        toast.error("Impossible de charger les prestataires : " + (err as Error).message)
        setContacts([])
      })
    resolveUsersByUids(csmembers ?? [])
      .then(setCsUsers)
      .catch(() => setCsUsers([]))
  }, [open, contactRefs, csmembers])

  async function handleSubmit() {
    if (!contactId) return
    setSaving(true)
    try {
      await createProMission({ residenceId, sinistreId, contactId, message, urgence, contactCsMemberIds: csIds })
      toast.success("Mission envoyée au prestataire")
      onOpenChange(false)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="pb-2">
          <DialogTitle>Mandater un prestataire Konodal Pro</DialogTitle>
        </DialogHeader>
        {contacts === null && <p className="text-sm text-muted-foreground">Chargement…</p>}
        {contacts?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Aucun prestataire de cette résidence n'a de compte Konodal Pro. Ajoutez-en un depuis Contacts (« Ajouter un
            prestataire Konodal Pro ») ou invitez un de vos prestataires, ou programmez une intervention par mail.
          </p>
        )}
        {!!contacts?.length && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Prestataire</Label>
              {contacts.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm has-[:disabled]:opacity-60"
                >
                  <input
                    type="radio"
                    name="mandate-contact"
                    disabled={c.pro.conformite !== "conforme"}
                    checked={contactId === c.id}
                    onChange={() => setContactId(c.id)}
                  />
                  <span className="flex-1">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-muted-foreground"> · {c.service}</span>
                  </span>
                  <ProComplianceBadge pro={c.pro} />
                </label>
              ))}
              <p className="text-xs text-muted-foreground">
                Seules les entreprises aux pièces de conformité à jour peuvent être mandatées.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mandate-message">Message au prestataire (optionnel)</Label>
              <textarea
                id="mandate-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                className="rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={urgence} onChange={(e) => setUrgence(e.target.checked)} />
              Urgent
            </label>
            {csUsers.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <Label>Membres du conseil syndical joignables le jour de l'intervention</Label>
                {csUsers.map((u) => (
                  <label key={u.uid} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={csIds.includes(u.uid)}
                      onChange={(e) =>
                        setCsIds((ids) => (e.target.checked ? [...ids, u.uid] : ids.filter((id) => id !== u.uid)))
                      }
                    />
                    {[u.name, u.surname].filter(Boolean).join(" ") || u.email || "Membre du CS"}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button className={PRIMARY_CTA_CLASS} disabled={!contactId || saving} onClick={handleSubmit}>
            Envoyer la mission
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
