import { collection, onSnapshot, type Timestamp, type Unsubscribe } from "firebase/firestore"
import { httpsCallable } from "firebase/functions"
import { db, functions } from "@/firebase"
import type { MailDraft } from "@/lib/users"

// Unificateur de comptes (konodal_app/functions_python/account_unifier.py) :
// paires de comptes en doublon accountDuplicates/{uidA_uidB}, détectées
// chaque nuit et à la fin d'une inscription, fusionnées après validation
// d'un superAdmin (jamais automatiquement).

export type PairStatus = "A_VALIDER" | "ECARTE" | "FUSIONNE"
export type PairLevel = "certain" | "probable"
export type PairCommon = "email" | "phone" | "lot" | "birthday" | "surname" | "name" | "residence"

export const COMMON_LABELS: Record<PairCommon, string> = {
  email: "Email",
  phone: "Téléphone",
  lot: "Même lot",
  birthday: "Date de naissance",
  // Dans l'app, user.name est le nom et user.surname le prénom.
  surname: "Prénom",
  name: "Nom",
  residence: "Même résidence",
}

export type PairAccount = {
  displayName: string
  email: string
  phone: string
  phoneVerified: boolean
  isCertified: boolean
  lots: number
  // AAAA-MM-JJ quand c'est une vraie date (pas la date d'inscription), sinon "".
  birthday: string
  providers: string[]
  lastSignIn: Date | null
  createdAt: Date | null
}

export type AccountPair = {
  id: string
  uids: [string, string]
  status: PairStatus
  score: number
  level: PairLevel
  common: PairCommon[]
  accounts: Record<string, PairAccount>
  suggestedMaster: string
  detectedAt: Date | null
  decidedAt: Date | null
  mergedInto: string | null
  merging: boolean
}

const toDate = (value: unknown): Date | null =>
  value && typeof (value as Timestamp).toDate === "function" ? (value as Timestamp).toDate() : null
const fromSeconds = (value: unknown): Date | null => (typeof value === "number" ? new Date(value * 1000) : null)

export function subscribeToAccountPairs(
  onData: (pairs: AccountPair[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, "accountDuplicates"),
    (snap) =>
      onData(
        snap.docs.map((d) => {
          const data = d.data()
          const accounts: Record<string, PairAccount> = {}
          for (const [uid, a] of Object.entries((data.accounts as Record<string, Record<string, unknown>>) ?? {})) {
            accounts[uid] = {
              displayName: (a.displayName as string) ?? uid,
              email: (a.email as string) ?? "",
              phone: (a.phone as string) ?? "",
              phoneVerified: a.phoneVerified === true,
              isCertified: a.isCertified === true,
              lots: (a.lots as number) ?? 0,
              birthday: (a.birthday as string) ?? "",
              providers: (a.providers as string[]) ?? [],
              lastSignIn: fromSeconds(a.lastSignIn),
              createdAt: fromSeconds(a.createdAt),
            }
          }
          return {
            id: d.id,
            uids: (data.uids as [string, string]) ?? ["", ""],
            status: (data.status as PairStatus) ?? "A_VALIDER",
            score: (data.score as number) ?? 0,
            level: (data.level as PairLevel) ?? "probable",
            common: (data.common as PairCommon[]) ?? [],
            accounts,
            suggestedMaster: (data.suggestedMaster as string) ?? "",
            detectedAt: toDate(data.detectedAt),
            decidedAt: toDate(data.decidedAt),
            mergedInto: (data.mergedInto as string) ?? null,
            merging: !!data.mergeLock,
          }
        })
      ),
    onError
  )
}

/** « Relancer la détection » : passage complet, comme celui de la nuit. */
export async function runAccountUnifier(): Promise<{ accounts: number; pairs: number; removed: number }> {
  return (await httpsCallable<void, { accounts: number; pairs: number; removed: number }>(functions, "run_account_unifier")())
    .data
}

/** « Ce ne sont pas les mêmes personnes ». */
export async function dismissAccountPair(pairId: string): Promise<void> {
  await httpsCallable<{ pairId: string }, unknown>(functions, "dismiss_account_duplicate")({ pairId })
}

export type MergeReport = Record<string, number>
export type MergeResult = { report: MergeReport; blockers?: string[]; mail?: MailDraft; masterUid?: string }

/** Fusion (dryRun : récapitulatif sans rien écrire). choices : champ d'identité -> uid dont garder la valeur. */
export async function mergeAccounts(params: {
  pairId: string
  masterUid: string
  choices?: Record<string, string>
  dryRun?: boolean
}): Promise<MergeResult> {
  return (await httpsCallable<typeof params, MergeResult>(functions, "merge_accounts")(params)).data
}
