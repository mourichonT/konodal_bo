import { useEffect, useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { Plus, ShieldCheck, Trash2, TriangleAlert } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  addResidenceAdmin,
  removeResidenceAdmin,
  subscribeToResidenceAdmins,
} from "@/lib/residenceAdmins"
import { findUserByEmail, resolveUsersByUids } from "@/lib/users"
import { PRIMARY_CTA_CLASS } from "@/lib/utils"
import type { KonodalUser } from "@/types/user"

export default function AccesPage() {
  const [uids, setUids] = useState<string[]>([])
  const [users, setUsers] = useState<Map<string, KonodalUser>>(new Map())
  const [loading, setLoading] = useState(true)
  const [newUid, setNewUid] = useState("")
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)

  useEffect(() => {
    return subscribeToResidenceAdmins(
      (data) => {
        setUids(data)
        setLoading(false)
      },
      (error) => {
        toast.error("Impossible de charger les accès : " + error.message)
        setLoading(false)
      }
    )
  }, [])

  useEffect(() => {
    let cancelled = false
    resolveUsersByUids(uids)
      .then((list) => {
        if (!cancelled) setUsers(new Map(list.map((u) => [u.uid, u])))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [uids])

  async function handleAdd(event: FormEvent) {
    event.preventDefault()
    const query = newUid.trim()
    if (!query) return
    setAdding(true)
    try {
      // UID ou email (contient "@") - un compte inconnu ou non superAdmin ne
      // donnerait aucun accès réel (règles Firestore) : refusé ici plutôt
      // que listé pour rien.
      const isEmail = query.includes("@")
      const user = isEmail ? await findUserByEmail(query) : (await resolveUsersByUids([query]))[0]
      if (!user) {
        toast.error(isEmail ? "Aucun compte trouvé pour cet email" : "Aucun compte trouvé pour cet UID")
        return
      }
      const uid = user.uid
      if (uids.includes(uid)) {
        toast.error("Ce compte a déjà l'accès")
        return
      }
      if (user.accountType !== "superAdmin") {
        toast.error("Ce compte n'est pas superAdmin : l'accès aux résidences lui serait refusé")
        return
      }
      await addResidenceAdmin(uid)
      setNewUid("")
      toast.success("Accès ajouté")
    } catch (err) {
      toast.error("Échec de l'ajout : " + (err as Error).message)
    } finally {
      setAdding(false)
    }
  }

  async function handleRemove() {
    if (!removing) return
    try {
      await removeResidenceAdmin(removing)
      toast.success("Accès retiré")
      setRemoving(null)
    } catch (err) {
      toast.error("Échec du retrait : " + (err as Error).message)
    }
  }

  function userLabel(user: KonodalUser) {
    return [user.name, user.surname].filter(Boolean).join(" ").trim() || user.email || user.uid
  }

  const removingUser = removing ? users.get(removing) : undefined

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[26px] font-extrabold tracking-tight text-[oklch(22%_0.01_150)]">Accès</h1>

      <div className="overflow-hidden rounded-[24px] border border-[oklch(93%_0.005_100)] bg-white shadow-[0_1px_2px_oklch(20%_0_0/0.03),0_14px_34px_-22px_oklch(20%_0_0/0.12)]">
        <div className="flex flex-wrap items-end justify-between gap-4 px-7 pt-[26px] pb-5">
          <div>
            <h2 className="mb-1 text-[17px] font-bold text-[oklch(22%_0.01_150)]">Accès à toutes les résidences</h2>
            <p className="max-w-[520px] text-[13.5px] text-muted-foreground">
              Comptes superAdmin pouvant ouvrir n'importe quelle résidence dans l'app, sans lot rattaché. Pris en
              compte à la prochaine connexion du compte dans l'app.
            </p>
          </div>
          <form onSubmit={handleAdd} className="flex w-full gap-2.5 sm:w-auto">
            <Input
              value={newUid}
              onChange={(e) => setNewUid(e.target.value)}
              placeholder="UID ou email du compte"
              className="h-9 sm:w-[300px]"
            />
            <Button type="submit" disabled={adding || !newUid.trim()} className={PRIMARY_CTA_CLASS}>
              <Plus />
              Ajouter
            </Button>
          </form>
        </div>

        {!loading && uids.length === 0 ? (
          <div className="flex flex-col items-center gap-4 border-t border-[oklch(95%_0.003_100)] px-10 py-16">
            <div className="flex size-16 items-center justify-center rounded-[18px] bg-[oklch(93%_0.05_150)]">
              <ShieldCheck className="size-7 text-[oklch(38%_0.09_155)]" />
            </div>
            <div className="text-center text-[13.5px] text-muted-foreground">Aucun compte n'a cet accès.</div>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Compte</TableHead>
                <TableHead>UID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="bg-white">
              {uids.map((uid) => {
                const user = users.get(uid)
                return (
                  <TableRow key={uid}>
                    <TableCell>
                      {user ? (
                        <Link to={`/residents/${uid}`} className="flex flex-col hover:underline">
                          <span className="font-semibold">{userLabel(user)}</span>
                          {user.email && <span className="text-xs text-muted-foreground">{user.email}</span>}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">Compte introuvable</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{uid}</TableCell>
                    <TableCell>
                      {user?.accountType === "superAdmin" ? (
                        <Badge variant="secondary">superAdmin</Badge>
                      ) : user ? (
                        <Badge variant="destructive" title="Sans accountType superAdmin, l'accès aux résidences est refusé">
                          <TriangleAlert />
                          {user.accountType}
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" aria-label="Retirer l'accès" onClick={() => setRemoving(uid)}>
                        <Trash2 />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={!!removing} onOpenChange={(open) => !open && setRemoving(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="pb-4">
            <DialogTitle>Retirer cet accès ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {removingUser ? userLabel(removingUser) : removing} ne pourra plus ouvrir toutes les résidences dans
            l'app à sa prochaine connexion.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoving(null)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleRemove}>
              Retirer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
