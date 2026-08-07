import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { toast } from "sonner"
import { ArrowLeft, Eye } from "lucide-react"
import { doc, getDoc } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { db } from "@/firebase"
import { subscribeToResidence } from "@/lib/residences"
import { subscribeToLot } from "@/lib/lots"
import { getUserLotAttribution, resolveUsersByUids } from "@/lib/users"
import type { Residence } from "@/types/residence"
import type { Lot } from "@/types/lot"
import { cn } from "@/lib/utils"

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
              emptyLabel="Aucun propriétaire déclaré sur ce lot."
              destinationLabel="Destination du bien"
              users={owners}
            />
            <RoleCard
              title="Locataire"
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
  users,
  emptyLabel,
  destinationLabel,
}: {
  title: string
  users: RoleUser[]
  emptyLabel: string
  destinationLabel: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
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
            <div className="sm:col-span-2">
              <Button variant="outline" size="sm" className="w-fit" render={<Link to={`/residents/${user.uid}`} />}>
                <Eye />
                Voir la fiche
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
