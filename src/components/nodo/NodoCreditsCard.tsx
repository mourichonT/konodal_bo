import { useCallback, useEffect, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  fetchLotNodoCredits,
  fetchUserNodoCredits,
  type NodoLotCredits,
  type NodoUserCredits,
} from "@/lib/nodo"
import { cn } from "@/lib/utils"

// Crédits Nodo du mois (1 crédit = une question moyenne) : fiche du lot et
// fiche utilisateur, superAdmin seulement (lecture par la callable
// nodo_credits_usage, les compteurs n'ont pas de règle de lecture).

const numberFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 })

function capitalize(text: string): string {
  return text ? text[0].toUpperCase() + text.slice(1) : text
}

// « nominal » : seuil non bloquant (questions du jour), en orange au-delà ;
// sinon limite bloquante, en rouge à partir de 90 %.
function CreditsBar({
  used,
  limit,
  size = "md",
  nominal = false,
}: {
  used: number
  limit: number
  size?: "md" | "sm"
  nominal?: boolean
}) {
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100
  const tone = nominal
    ? used > limit
      ? "bg-amber-500"
      : "bg-[oklch(45%_0.1_155)]"
    : percent >= 90
      ? "bg-red-500"
      : "bg-[oklch(45%_0.1_155)]"
  return (
    <div className={cn("overflow-hidden rounded-full bg-[oklch(93%_0.006_150)]", size === "md" ? "h-1.5" : "h-1")}>
      <div className={cn("h-full", tone)} style={{ width: `${percent}%` }} />
    </div>
  )
}

// Jour en cours à Paris (AAAA-MM-JJ), comme les compteurs du serveur : il
// change à 0 h, ce qui recharge les cartes restées ouvertes (vérifié chaque
// minute).
const parisDayFormatter = new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" })

function useParisDay(): string {
  const [day, setDay] = useState(() => parisDayFormatter.format(new Date()))
  useEffect(() => {
    const timer = window.setInterval(() => setDay(parisDayFormatter.format(new Date())), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  return day
}

function useCredits<T>(load: () => Promise<T>) {
  const day = useParisDay()
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const refresh = useCallback(() => {
    setLoading(true)
    load().then(
      (value) => {
        setData(value)
        setError(null)
        setLoading(false)
      },
      (err: unknown) => {
        setError(err instanceof Error ? err.message : String(err))
        setLoading(false)
      }
    )
  }, [load])
  useEffect(refresh, [refresh, day])
  return { data, error, loading, refresh }
}

function CreditsCardFrame({
  description,
  loading,
  error,
  onRefresh,
  children,
}: {
  description: ReactNode
  loading: boolean
  error: string | null
  onRefresh: () => void
  children: ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Crédits Nodo</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          <Button variant="ghost" size="icon-sm" aria-label="Actualiser" disabled={loading} onClick={onRefresh}>
            <RefreshCw className={cn(loading && "animate-spin")} />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        {error ? <p className="text-destructive">Lecture impossible : {error}</p> : children}
      </CardContent>
    </Card>
  )
}

function UsageLine({
  label,
  used,
  limit,
  unit = "crédits",
  nominal = false,
}: {
  label?: string
  used: number
  limit: number
  unit?: string
  nominal?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span>
          {label && <span className="text-muted-foreground">{label} · </span>}
          <strong className="text-[13px] tabular-nums">
            {numberFormatter.format(used)} / {limit} {unit}
          </strong>
        </span>
        <span className="text-muted-foreground tabular-nums">
          {limit > 0 ? Math.round((used / limit) * 100) : 0} %
        </span>
      </div>
      <CreditsBar used={used} limit={limit} nominal={nominal} />
    </div>
  )
}

export function NodoLotCreditsCard({ residenceId, lotId }: { residenceId: string; lotId: string }) {
  const load = useCallback(() => fetchLotNodoCredits(residenceId, lotId), [residenceId, lotId])
  const { data, error, loading, refresh } = useCredits<NodoLotCredits>(load)
  return (
    <CreditsCardFrame
      description={
        data
          ? `${capitalize(data.month)} · pot commun aux occupants du lot, ${data.limit} crédits par mois`
          : "Mois en cours"
      }
      loading={loading}
      error={error}
      onRefresh={refresh}
    >
      {!data ? (
        <p className="text-muted-foreground">Chargement…</p>
      ) : (
        <>
          {data.potLabel && (
            <p className="text-muted-foreground">
              Lot rattaché : il utilise le pot de son logement, {data.potLabel}.
            </p>
          )}
          <UsageLine used={data.used} limit={data.limit} />
          {data.occupants.length === 0 ? (
            <p className="text-muted-foreground">Aucun occupant déclaré.</p>
          ) : (
            <div className="flex flex-col gap-2.5 border-t pt-3">
              <span className="text-xs text-muted-foreground">
                Par occupant, toutes résidences confondues ({data.occupants[0].limit} crédits par mois chacun)
              </span>
              {data.occupants.map((occupant) => (
                <div key={occupant.uid} className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span>
                      <Link to={`/residents/${occupant.uid}`} className="font-medium hover:underline">
                        {occupant.name}
                      </Link>
                      <span className="text-muted-foreground"> · {occupant.role}</span>
                    </span>
                    <span className="tabular-nums">
                      {numberFormatter.format(occupant.used)} / {occupant.limit}
                    </span>
                  </div>
                  <CreditsBar used={occupant.used} limit={occupant.limit} size="sm" />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </CreditsCardFrame>
  )
}

export function NodoUserCreditsCard({ uid }: { uid: string }) {
  const load = useCallback(() => fetchUserNodoCredits(uid), [uid])
  const { data, error, loading, refresh } = useCredits<NodoUserCredits>(load)
  return (
    <CreditsCardFrame
      description={
        data
          ? `${capitalize(data.month)} · limite personnelle de ${data.limit} crédits par mois, toutes résidences confondues`
          : "Mois en cours"
      }
      loading={loading}
      error={error}
      onRefresh={refresh}
    >
      {!data ? (
        <p className="text-muted-foreground">Chargement…</p>
      ) : (
        <>
          <UsageLine label="Ce mois-ci" used={data.used} limit={data.limit} />
          <div className="flex flex-col gap-1.5 border-t pt-3">
            <UsageLine
              label="Aujourd'hui"
              used={data.todayQuestions}
              limit={data.nominalDaily}
              unit="questions"
              nominal
            />
            <p className="text-xs text-muted-foreground">
              Quota journalier non bloquant, compté en questions quel que soit leur coût : au-delà, Nodo affiche un
              avertissement une fois dans la journée. Remise à zéro chaque jour à 00h00 (heure de Paris).
            </p>
          </div>
        </>
      )}
    </CreditsCardFrame>
  )
}
