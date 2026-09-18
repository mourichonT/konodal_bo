import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { toast } from "sonner"
import { ArrowLeft, Eye, PlusCircle, Unlink } from "lucide-react"
import { doc, getDoc } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { db } from "@/firebase"
import { useAccountRole } from "@/hooks/useAccountRole"
import { subscribeToResidence } from "@/lib/residences"
import { subscribeToLot, grantLotRole, revokeLotRole, type LotRole } from "@/lib/lots"
import { createLotDocument } from "@/lib/lotDocuments"
import { getUserLotAttribution, resolveUsersByUids, subscribeToUsers } from "@/lib/users"
import type { Residence } from "@/types/residence"
import type { Lot } from "@/types/lot"
import type { KonodalUser } from "@/types/user"
import { cn, PRIMARY_CTA_CLASS } from "@/lib/utils"

type RoleUser = {
  uid: string
  name: string
  surname: string
  email: string
  phone: string
  // "Destination du bien" côté propriétaire, "Type de bail" côté locataire -
  // même champ Firestore (intendedFor), cf. getUserLotAttribution.
  intendedFor: string
}

async function loadRoleUsers(uids: string[], lotId: string): Promise<RoleUser[]> {
  const [identities, attributions] = await Promise.all([
    resolveUsersByUids(uids),
    Promise.all(uids.map((uid) => getUserLotAttribution(uid, lotId))),
  ])
  const identityByUid = new Map(identities.map((u) => [u.uid, u]))
  return uids.map((uid, index) => {
    const identity = identityByUid.get(uid)
    const attribution = attributions[index]
    return {
      uid,
      name: identity?.name ?? "",
      surname: identity?.surname ?? "",
      email: identity?.email ?? "",
      phone: identity?.phone ?? "",
      intendedFor: attribution?.intendedFor ?? "",
    }
  })
}

export default function LotDetailPage() {
  const { id: residenceId, lotId } = useParams<{ id: string; lotId: string }>()
  const { isSuperAdmin } = useAccountRole()
  const [residence, setResidence] = useState<Residence | null>(null)
  const [lot, setLot] = useState<Lot | null>(null)
  const [loading, setLoading] = useState(true)
  const [parentLotLabel, setParentLotLabel] = useState<string | null>(null)
  const [owners, setOwners] = useState<RoleUser[]>([])
  const [tenants, setTenants] = useState<RoleUser[]>([])

  useEffect(() => {
    if (!residenceId) return
    return subscribeToResidence(residenceId, setResidence, () => {})
  }, [residenceId])

  useEffect(() => {
    if (!residenceId || !lotId) return
    setLoading(true)
    return subscribeToLot(
      residenceId,
      lotId,
      (data) => {
        setLot(data)
        setLoading(false)
      },
      (error) => {
        toast.error("Impossible de charger le lot : " + error.message)
        setLoading(false)
      }
    )
  }, [residenceId, lotId])

  // Un lot rattaché (isLinkable) référence son parent par id : nom/numéro
  // affichés ici viennent d'une lecture ponctuelle, pas d'un abonnement
  // (mêmes infos que le lot lui-même, pas besoin d'un flux temps réel
  // séparé) - même pattern que ResidentDetailPage/SinistreDetailPage.
  useEffect(() => {
    if (!residenceId || !lot?.parentLotId) {
      setParentLotLabel(null)
      return
    }
    let cancelled = false
    getDoc(doc(db, "residences", residenceId, "lots", lot.parentLotId)).then((snap) => {
      if (cancelled || !snap.exists()) return
      const data = snap.data()
      const batiment = (data.batiment as string) ?? ""
      const numero = (data.lot as string) ?? ""
      const label = [batiment, numero ? `Lot ${numero}` : ""].filter(Boolean).join(" — ")
      setParentLotLabel(label || null)
    })
    return () => {
      cancelled = true
    }
  }, [residenceId, lot?.parentLotId])

  const ownerUids = useMemo(() => lot?.idProprietaire ?? [], [lot])
  const tenantUids = useMemo(() => lot?.idLocataire ?? [], [lot])

  useEffect(() => {
    if (!lotId || ownerUids.length === 0) {
      setOwners([])
      return
    }
    let cancelled = false
    loadRoleUsers(ownerUids, lotId).then((data) => {
      if (!cancelled) setOwners(data)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerUids.join(","), lotId])

  useEffect(() => {
    if (!lotId || tenantUids.length === 0) {
      setTenants([])
      return
    }
    let cancelled = false
    loadRoleUsers(tenantUids, lotId).then((data) => {
      if (!cancelled) setTenants(data)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantUids.join(","), lotId])

  if (!residenceId || !lotId) return null

  return (
    <div className="-mt-[20px] flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Link
          to={`/residences/${residenceId}`}
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {residence?.name || "Résidence"}
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight text-[oklch(22%_0.01_150)]">
          {lot
            ? [lot.batiment, lot.lot ? `Lot ${lot.lot}` : ""].filter(Boolean).join(" — ") || "Lot"
            : loading
              ? "…"
              : "Lot introuvable"}
        </h1>
      </div>

      {!loading && !lot && (
        <p className="text-muted-foreground">Ce lot n'existe pas ou a été supprimé.</p>
      )}

      {lot && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Informations du lot</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <span className="text-muted-foreground">Bâtiment : </span>
                {lot.batiment || "—"}
              </div>
              <div>
                <span className="text-muted-foreground">N° de lot : </span>
                {lot.lot || "—"}
              </div>
              <div>
                <span className="text-muted-foreground">Référence : </span>
                {lot.refLot || "—"}
              </div>
              <div>
                <span className="text-muted-foreground">Type : </span>
                {lot.typeLot || "—"}
              </div>
              <div>
                <span className="text-muted-foreground">Rattachable : </span>
                {lot.isLinkable ? "Oui" : "Non"}
              </div>
              {lot.isLinkable && (
                <div>
                  <span className="text-muted-foreground">Rattaché à : </span>
                  {parentLotLabel ?? "—"}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-5">
            <RoleCard
              title="Propriétaire"
              role="Propriétaire"
              residenceId={residenceId}
              lotId={lotId}
              canManage={isSuperAdmin}
              emptyLabel="Aucun propriétaire déclaré sur ce lot."
              destinationLabel="Destination du bien"
              users={owners}
            />
            <RoleCard
              title="Locataire"
              role="Locataire"
              residenceId={residenceId}
              lotId={lotId}
              canManage={isSuperAdmin}
              emptyLabel="Aucun locataire déclaré sur ce lot."
              destinationLabel="Type de bail"
              users={tenants}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function RoleCard({
  title,
  role,
  residenceId,
  lotId,
  canManage,
  users,
  emptyLabel,
  destinationLabel,
}: {
  title: string
  role: LotRole
  residenceId: string
  lotId: string
  // Ajout/révocation écrivent idProprietaire/idLocataire (cf. lib/lots.ts,
  // grantLotRole/revokeLotRole) - réservé isSuperAdmin côté firestore.rules,
  // jamais ouvert à Agence/Agent sur ce champ précis.
  canManage: boolean
  users: RoleUser[]
  emptyLabel: string
  destinationLabel: string
}) {
  const [adding, setAdding] = useState(false)
  const [allUsers, setAllUsers] = useState<KonodalUser[]>([])
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<KonodalUser | null>(null)
  const [docName, setDocName] = useState("Justificatif de domicile")
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [revokingUid, setRevokingUid] = useState<string | null>(null)

  // Chargé seulement pendant que le dialogue est ouvert - pas de fan-out
  // permanent sur toute la collection users pour une page lot qui n'en a
  // pas besoin par défaut.
  useEffect(() => {
    if (!adding) return
    return subscribeToUsers(setAllUsers, () => {})
  }, [adding])

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return allUsers
      .filter((u) => (u.accountType || "utilisateur") === "utilisateur")
      .filter((u) => [u.name, u.surname, u.email].join(" ").toLowerCase().includes(q))
      .slice(0, 6)
  }, [allUsers, search])

  function resetAddState() {
    setAdding(false)
    setSearch("")
    setSelected(null)
    setDocName("Justificatif de domicile")
    setFile(null)
  }

  async function handleAdd() {
    if (!selected) return
    setSaving(true)
    try {
      await grantLotRole(residenceId, lotId, selected.uid, role)
      // Justificatif optionnel (ex: justificatif de domicile) - même circuit
      // que "Ajouter un document" côté résidence (lib/lotDocuments.ts,
      // users/{uid}/lots/{lotId}/documents), avec ce seul uid comme
      // destinataire puisque l'attribution vient d'être créée à l'instant.
      if (file) {
        await createLotDocument(residenceId, lotId, {
          name: docName.trim() || "Justificatif de domicile",
          category: "Justificatif",
          file,
          recipientUids: [selected.uid],
        })
      }
      toast.success(`${title} ajouté`)
      resetAddState()
    } catch (err) {
      toast.error("Échec de l'ajout : " + (err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleRevoke(uid: string) {
    setRevokingUid(uid)
    try {
      await revokeLotRole(residenceId, lotId, uid, role)
      toast.success(`${title} révoqué`)
    } catch (err) {
      toast.error("Échec de la révocation : " + (err as Error).message)
    } finally {
      setRevokingUid(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {canManage && (
          <CardAction>
            <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
              <PlusCircle />
              Ajouter
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {users.length === 0 && <p className="text-sm text-muted-foreground">{emptyLabel}</p>}
        {users.map((user, index) => (
          <div
            key={user.uid}
            className={cn("grid gap-3 text-sm sm:grid-cols-2", index > 0 && "border-t pt-4")}
          >
            <div>
              <span className="text-muted-foreground">Nom : </span>
              {user.surname || "—"}
            </div>
            <div>
              <span className="text-muted-foreground">Prénom : </span>
              {user.name || "—"}
            </div>
            <div>
              <span className="text-muted-foreground">Email : </span>
              {user.email || "—"}
            </div>
            <div>
              <span className="text-muted-foreground">Téléphone : </span>
              {user.phone || "—"}
            </div>
            <div className="sm:col-span-2">
              <span className="text-muted-foreground">{destinationLabel} : </span>
              {user.intendedFor || "—"}
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Button variant="outline" size="sm" className="w-fit" render={<Link to={`/residents/${user.uid}`} />}>
                <Eye />
                Voir la fiche
              </Button>
              {canManage && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={revokingUid === user.uid}
                  onClick={() => handleRevoke(user.uid)}
                  className="border-red-200 text-red-700 hover:bg-red-50"
                >
                  <Unlink />
                  Révoquer
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={adding} onOpenChange={(open) => (open ? setAdding(true) : resetAddState())}>
        <DialogContent className="sm:max-w-md">
          <div className="flex max-h-[calc(100vh-3rem)] min-w-0 flex-col gap-4">
            <DialogHeader className="border-b border-[oklch(95%_0.003_100)] pb-4">
              <DialogTitle>Ajouter un {title.toLowerCase()}</DialogTitle>
            </DialogHeader>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden pr-4 pl-[5px]">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`add-${role}-search`}>Résident</Label>
                {selected ? (
                  <div className="flex items-center justify-between rounded-lg border border-input px-3 py-2 text-sm">
                    <span>
                      {`${selected.name} ${selected.surname}`.trim() || selected.email}
                      <span className="text-muted-foreground"> — {selected.email}</span>
                    </span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(null)}>
                      Changer
                    </Button>
                  </div>
                ) : (
                  <>
                    <Input
                      id={`add-${role}-search`}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Rechercher par nom ou email…"
                    />
                    {matches.length > 0 && (
                      <div className="flex flex-col overflow-hidden rounded-lg border border-input">
                        {matches.map((u) => (
                          <button
                            key={u.uid}
                            type="button"
                            onClick={() => {
                              setSelected(u)
                              setSearch("")
                            }}
                            className="flex flex-col px-3 py-2 text-left text-sm hover:bg-muted"
                          >
                            <span className="font-medium">{`${u.name} ${u.surname}`.trim() || u.email}</span>
                            <span className="text-xs text-muted-foreground">{u.email}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {search.trim() && matches.length === 0 && (
                      <p className="text-xs text-muted-foreground">Aucun compte trouvé.</p>
                    )}
                  </>
                )}
              </div>

              {/* Justificatif optionnel (ex: justificatif de domicile) -
                  déposé sur users/{uid}/lots/{lotId}/documents dès que le
                  résident est sélectionné, en même temps que le
                  rattachement. */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`add-${role}-docname`}>Justificatif (optionnel)</Label>
                <Input
                  id={`add-${role}-docname`}
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  placeholder="Nom du document"
                />
                <input
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="text-sm"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetAddState}>
                Annuler
              </Button>
              <Button disabled={saving || !selected} onClick={handleAdd} className={PRIMARY_CTA_CLASS}>
                <PlusCircle />
                Ajouter
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
