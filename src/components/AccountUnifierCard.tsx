import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { collection, onSnapshot, query, where, type Timestamp } from "firebase/firestore"
import { GitMerge, TriangleAlert } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { db } from "@/firebase"

// Fiche utilisateur (superAdmin) : doublon possible à voir dans l'unificateur
// (accountDuplicates, statut A_VALIDER) et comptes déjà absorbés par une
// fusion (users/{uid}/user_merged, cf. account_unifier.py).

type OpenPair = { otherName: string; level: string; score: number }
type MergedAccount = { uid: string; name: string; email: string; at: Date | null; report: Record<string, number> }

export function AccountUnifierCard({ uid }: { uid: string }) {
  const [openPair, setOpenPair] = useState<OpenPair | null>(null)
  const [merged, setMerged] = useState<MergedAccount[]>([])

  useEffect(
    () =>
      onSnapshot(
        query(collection(db, "accountDuplicates"), where("uids", "array-contains", uid)),
        (snap) => {
          const pair = snap.docs.map((d) => d.data()).find((p) => p.status === "A_VALIDER")
          if (!pair) return setOpenPair(null)
          const other = (pair.uids as string[]).find((u) => u !== uid) ?? ""
          setOpenPair({
            otherName: (pair.accounts?.[other]?.displayName as string) ?? other,
            level: pair.level === "certain" ? "certain" : "probable",
            score: (pair.score as number) ?? 0,
          })
        },
        () => setOpenPair(null)
      ),
    [uid]
  )

  useEffect(
    () =>
      onSnapshot(
        collection(db, "users", uid, "user_merged"),
        (snap) =>
          setMerged(
            snap.docs.map((d) => {
              const data = d.data()
              const account = (data.account as Record<string, unknown>) ?? {}
              const names = (account.user as Record<string, string>) ?? {}
              return {
                uid: d.id,
                name: `${names.name ?? ""} ${names.surname ?? ""}`.trim() || d.id,
                email: (account.email as string) ?? "",
                at: (data.mergedAt as Timestamp | undefined)?.toDate?.() ?? null,
                report: (data.report as Record<string, number>) ?? {},
              }
            })
          ),
        () => setMerged([])
      ),
    [uid]
  )

  if (!openPair && merged.length === 0) return null

  return (
    <>
      {openPair && (
        <div className="flex flex-wrap items-center gap-2 rounded-[14px] bg-amber-50 p-[12px_16px] text-sm text-amber-900">
          <TriangleAlert className="size-4 shrink-0" />
          <span>
            Ce compte est peut-être en doublon avec <span className="font-semibold">{openPair.otherName}</span> (
            {openPair.level}, {openPair.score} points).
          </span>
          <Link to="/residents/unificateur" className="font-semibold underline">
            Voir dans l'unificateur
          </Link>
        </div>
      )}
      {merged.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-2 text-sm">
            <span className="flex items-center gap-2 font-bold">
              <GitMerge className="size-4 text-primary" />
              Comptes fusionnés dans celui-ci
            </span>
            {merged.map((m) => (
              <div key={m.uid} className="flex flex-col gap-0.5 rounded-[12px] border border-[oklch(93%_0.005_100)] p-[10px_12px]">
                <span className="font-semibold">
                  {m.name} · {m.email || "sans email"}
                </span>
                <span className="text-xs text-muted-foreground">
                  Fusionné le {m.at ? m.at.toLocaleDateString("fr-FR") : "—"}
                  {Object.keys(m.report).length
                    ? ` : ${Object.entries(m.report)
                        .map(([label, n]) => `${label} ${n}`)
                        .join(", ")}`
                    : ""}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  )
}
