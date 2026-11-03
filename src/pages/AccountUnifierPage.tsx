import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { BadgeCheck, CheckCircle2, Eye, GitMerge, RefreshCw, UserX, Users } from "lucide-react"
import { FilterKpiCard } from "@/components/FilterKpiCard"
import { UsersSectionToggle } from "@/components/UsersSectionToggle"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  COMMON_LABELS,
  dismissAccountPair,
  mergeAccounts,
  runAccountUnifier,
  subscribeToAccountPairs,
  type AccountPair,
  type MergeResult,
  type PairStatus,
} from "@/lib/accountUnifier"
import { resolveUsersByUids } from "@/lib/users"
import { cn, PRIMARY_CTA_CLASS } from "@/lib/utils"
import type { KonodalUser } from "@/types/user"

// Unificateur de comptes (Utilisateurs > Unificateur, superAdmin) : paires de
// comptes en doublon détectées par konodal_app/functions_python/
// account_unifier.py (SFD du 02/11/2026). Toute fusion est validée ici,
// jamais automatique : choix du compte gardé, des valeurs d'identité en
// conflit, récapitulatif (dry-run serveur), puis confirmation.

const STATUS_LABEL: Record<PairStatus, string> = {
  A_VALIDER: "À valider",
  ECARTE: "Écartées",
  FUSIONNE: "Fusionnées",
}

// Champs d'identité que le superAdmin peut choisir (RG-UC-09). La date de
// naissance n'y est pas : le serveur garde la vraie date si un seul des deux
// comptes en a une (les autres ont la date d'inscription).
const IDENTITY_FIELDS: { key: keyof KonodalUser & string; label: string }[] = [
  { key: "name", label: "Nom" },
  { key: "surname", label: "Prénom" },
  { key: "nationality", label: "Nationalité" },
  { key: "sex", label: "Sexe" },
  { key: "placeOfborn", label: "Lieu de naissance" },
]

function formatDate(date: Date | null): string {
  return date ? date.toLocaleDateString("fr-FR") : "—"
}

function providerLabel(providers: string[]): string {
  const labels = providers.map((p) => (p === "google.com" ? "Google" : p === "password" ? "Email" : p === "phone" ? "Téléphone" : p))
  return labels.join(", ") || "—"
}

export default function AccountUnifierPage() {
  const navigate = useNavigate()
  const [pairs, setPairs] = useState<AccountPair[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<PairStatus>("A_VALIDER")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [users, setUsers] = useState<Map<string, KonodalUser>>(new Map())
  const [master, setMaster] = useState("")
  const [choices, setChoices] = useState<Record<string, string>>({})
  const [running, setRunning] = useState(false)
  const [preview, setPreview] = useState<MergeResult | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(
    () =>
      subscribeToAccountPairs(
        (data) => {
          setPairs(data)
          setLoading(false)
        },
        (err) => {
          toast.error("Paires illisibles : " + err.message)
          setLoading(false)
        }
      ),
    []
  )

  const counts = useMemo(() => {
    const out: Record<PairStatus, number> = { A_VALIDER: 0, ECARTE: 0, FUSIONNE: 0 }
    for (const p of pairs) out[p.status] += 1
    return out
  }, [pairs])

  const listed = useMemo(
    () =>
      pairs
        .filter((p) => p.status === status)
        .sort((a, b) => (a.level === b.level ? b.score - a.score : a.level === "certain" ? -1 : 1)),
    [pairs, status]
  )
  const selected = listed.find((p) => p.id === selectedId) ?? listed[0] ?? null

  // Comptes de la paire choisie : identité complète pour les conflits.
  const selectedKey = selected ? selected.uids.join(",") : ""
  useEffect(() => {
    if (!selected) return
    setMaster(selected.suggestedMaster || selected.uids[0])
    setChoices({})
    resolveUsersByUids(selected.uids)
      .then((list) => setUsers(new Map(list.map((u) => [u.uid, u]))))
      .catch(() => setUsers(new Map()))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey])

  const absorbed = selected ? selected.uids.find((u) => u !== master) ?? "" : ""
  const conflicts = selected
    ? IDENTITY_FIELDS.filter((f) => {
        const a = String(users.get(master)?.[f.key] ?? "").trim()
        const b = String(users.get(absorbed)?.[f.key] ?? "").trim()
        return a && b && a.toLowerCase() !== b.toLowerCase()
      })
    : []

  async function handleRun() {
    setRunning(true)
    try {
      const result = await runAccountUnifier()
      toast.success(`Détection terminée : ${result.pairs} paire(s) à valider sur ${result.accounts} comptes`)
    } catch (err) {
      toast.error("Détection impossible : " + (err as Error).message)
    } finally {
      setRunning(false)
    }
  }

  async function handleDismiss() {
    if (!selected) return
    setBusy(true)
    try {
      await dismissAccountPair(selected.id)
      toast.success("Paire écartée")
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function handlePreview() {
    if (!selected) return
    setBusy(true)
    try {
      setPreview(await mergeAccounts({ pairId: selected.id, masterUid: master, choices, dryRun: true }))
    } catch (err) {
      toast.error("Fusion impossible : " + (err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function handleMerge() {
    if (!selected) return
    setBusy(true)
    try {
      const result = await mergeAccounts({ pairId: selected.id, masterUid: master, choices })
      toast.success("Comptes fusionnés")
      setPreview(null)
      navigate(`/residents/${result.masterUid ?? master}?onglet=mails`, { state: { mailDraft: result.mail } })
    } catch (err) {
      toast.error("Fusion impossible : " + (err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[30px] font-extrabold tracking-tight text-[oklch(20%_0.02_150)]">Utilisateurs</h1>
        <UsersSectionToggle current="unificateur" />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg">Unificateur de comptes</h2>
          <p className="max-w-[720px] text-sm text-muted-foreground">
            Comptes qui semblent appartenir à une même personne (email, téléphone, nom et prénom, lot en commun),
            détectés chaque nuit et à chaque inscription. Une fusion n'a lieu qu'après votre validation.
          </p>
        </div>
        <Button variant="outline" disabled={running} onClick={handleRun}>
          <RefreshCw className={cn(running && "animate-spin")} />
          Relancer la détection
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {(["A_VALIDER", "ECARTE", "FUSIONNE"] as PairStatus[]).map((s) => (
          <FilterKpiCard
            key={s}
            label={STATUS_LABEL[s]}
            value={counts[s]}
            icon={s === "A_VALIDER" ? Users : s === "ECARTE" ? UserX : CheckCircle2}
            colorClass={
              s === "A_VALIDER" ? "bg-amber-100 text-amber-600" : s === "ECARTE" ? "bg-slate-100 text-slate-600" : "bg-emerald-100 text-emerald-600"
            }
            active={status === s}
            onClick={() => {
              setStatus(s)
              setSelectedId(null)
            }}
          />
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : listed.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {status === "A_VALIDER" ? "Aucun doublon à valider." : "Aucune paire."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          <div className="flex flex-col gap-2">
            {listed.map((pair) => (
              <button
                key={pair.id}
                type="button"
                onClick={() => setSelectedId(pair.id)}
                className={cn(
                  "flex flex-col gap-1.5 rounded-[14px] border bg-white p-[12px_14px] text-left text-sm",
                  selected?.id === pair.id ? "border-primary ring-2 ring-primary/20" : "border-[oklch(93%_0.005_100)] hover:bg-muted/40"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold">
                    {pair.uids.map((u) => pair.accounts[u]?.displayName ?? u).join(" · ")}
                  </span>
                  <Badge
                    className={cn(
                      "shrink-0 border-transparent",
                      pair.level === "certain" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                    )}
                  >
                    {pair.level === "certain" ? "Certain" : "Probable"} · {pair.score}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1">
                  {pair.common.map((c) => (
                    <span key={c} className="rounded-md bg-sky-50 px-1.5 py-0.5 text-xs font-medium text-sky-800">
                      {COMMON_LABELS[c]}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>

          {selected && (
            <Card>
              <CardContent className="flex flex-col gap-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {selected.uids.map((uid) => {
                    const a = selected.accounts[uid]
                    const u = users.get(uid)
                    const isMaster = uid === master
                    return (
                      <div
                        key={uid}
                        className={cn(
                          "flex flex-col gap-2 rounded-[14px] border p-[14px_16px] text-sm",
                          isMaster ? "border-emerald-300 bg-emerald-50/50" : "border-[oklch(93%_0.005_100)]"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 font-bold">
                            {a?.displayName ?? uid}
                            {a?.isCertified && <BadgeCheck className="size-4 fill-blue-500 text-white" />}
                          </span>
                          {selected.status === "A_VALIDER" && (
                            <label className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold">
                              <input type="radio" checked={isMaster} onChange={() => setMaster(uid)} />
                              Compte gardé
                            </label>
                          )}
                        </div>
                        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
                          <dt className="text-muted-foreground">Email</dt>
                          <dd className={cn("truncate", selected.common.includes("email") && "font-semibold text-sky-800")}>
                            {a?.email || "—"}
                          </dd>
                          <dt className="text-muted-foreground">Téléphone</dt>
                          <dd className={cn(selected.common.includes("phone") && "font-semibold text-sky-800")}>
                            {a?.phone || "—"} {a?.phoneVerified ? "(vérifié)" : ""}
                          </dd>
                          <dt className="text-muted-foreground">Naissance</dt>
                          <dd className={cn(selected.common.includes("birthday") && "font-semibold text-sky-800")}>
                            {a?.birthday ? new Date(`${a.birthday}T12:00:00`).toLocaleDateString("fr-FR") : "—"}
                          </dd>
                          <dt className="text-muted-foreground">Connexion</dt>
                          <dd>{providerLabel(a?.providers ?? [])}</dd>
                          <dt className="text-muted-foreground">Inscription</dt>
                          <dd>{formatDate(a?.createdAt ?? u?.createdDate ?? null)}</dd>
                          <dt className="text-muted-foreground">Dernière connexion</dt>
                          <dd>{formatDate(a?.lastSignIn ?? null)}</dd>
                          <dt className="text-muted-foreground">Lots</dt>
                          <dd className={cn(selected.common.includes("lot") && "font-semibold text-sky-800")}>
                            {a?.lots ?? 0} (validés ou demandés)
                          </dd>
                        </dl>
                        <Button variant="outline" size="sm" className="w-fit" render={<Link to={`/residents/${uid}`} />}>
                          <Eye />
                          Voir la fiche
                        </Button>
                      </div>
                    )
                  })}
                </div>

                {selected.status === "A_VALIDER" && (
                  <>
                    {selected.suggestedMaster && (
                      <p className="text-xs text-muted-foreground">
                        Compte gardé proposé : celui qui a des lots validés, sinon certifié, sinon au téléphone vérifié,
                        sinon le plus récemment connecté. La personne se connectera ensuite avec le moyen du compte gardé.
                      </p>
                    )}
                    {conflicts.length > 0 && (
                      <div className="flex flex-col gap-2 rounded-[12px] bg-amber-50 p-[12px_14px] text-sm text-amber-900">
                        <span className="font-semibold">Valeurs différentes : laquelle garder ?</span>
                        {conflicts.map((f) => (
                          <div key={f.key} className="flex flex-wrap items-center gap-3">
                            <span className="w-32 shrink-0">{f.label}</span>
                            {[master, absorbed].map((uid) => (
                              <label key={uid} className="flex cursor-pointer items-center gap-1.5">
                                <input
                                  type="radio"
                                  checked={(choices[f.key] ?? master) === uid}
                                  onChange={() => setChoices((prev) => ({ ...prev, [f.key]: uid }))}
                                />
                                {String(users.get(uid)?.[f.key] ?? "")}
                              </label>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 border-t pt-4">
                      <Button
                        className={PRIMARY_CTA_CLASS}
                        disabled={busy || selected.merging}
                        onClick={handlePreview}
                      >
                        <GitMerge />
                        Fusionner…
                      </Button>
                      <Button variant="outline" disabled={busy} onClick={handleDismiss}>
                        <UserX />
                        Ce ne sont pas les mêmes personnes
                      </Button>
                    </div>
                  </>
                )}
                {selected.status === "FUSIONNE" && selected.mergedInto && (
                  <p className="text-sm text-emerald-800">
                    Fusionné le {formatDate(selected.decidedAt)} dans le compte de{" "}
                    {selected.accounts[selected.mergedInto]?.displayName ?? selected.mergedInto}.
                  </p>
                )}
                {selected.status === "ECARTE" && (
                  <p className="text-sm text-muted-foreground">
                    Écartée le {formatDate(selected.decidedAt)} : ne revient que si l'email, le téléphone, le nom ou le
                    prénom de l'un des comptes change.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Dialog open={!!preview} onOpenChange={(open) => !busy && !open && setPreview(null)}>
        <DialogContent className="sm:max-w-lg">
          <div className="flex max-h-[calc(100vh-3rem)] min-w-0 flex-col gap-4">
            <DialogHeader className="pb-4">
              <DialogTitle>Fusionner ces comptes ?</DialogTitle>
            </DialogHeader>
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden pr-4 pl-[5px] text-sm">
              <p>
                <span className="font-semibold">{selected?.accounts[master]?.displayName}</span> ({selected?.accounts[master]?.email})
                est gardé. Le compte {selected?.accounts[absorbed]?.email} est désactivé après le transfert, et archivé
                sur le compte gardé.
              </p>
              {preview && Object.keys(preview.report).length > 0 ? (
                <ul className="list-disc pl-5">
                  {Object.entries(preview.report).map(([label, n]) => (
                    <li key={label}>
                      {label} : {n}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">Aucune donnée à transférer en dehors du compte lui-même.</p>
              )}
              <p className="text-xs text-muted-foreground">
                Un brouillon de mail à la personne s'ouvre ensuite dans « Écrire », à relire avant envoi.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" disabled={busy} onClick={() => setPreview(null)}>
                Annuler
              </Button>
              <Button className={PRIMARY_CTA_CLASS} disabled={busy} onClick={handleMerge}>
                <GitMerge />
                Fusionner
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
