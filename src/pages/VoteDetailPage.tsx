import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { ArrowLeft, CheckCircle2, Pause, Play, SkipForward, Timer, Trash2, Users, XCircle } from "lucide-react"
import { Timestamp } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { subscribeToLots } from "@/lib/lots"
import {
  deleteVote,
  finalizeAgQuestionNonResponses,
  saveVote,
  setVotePausedAt,
  startVoteSession,
  subscribeToBallots,
  subscribeToPresences,
  subscribeToVote,
} from "@/lib/votes"
import {
  evaluateMajority,
  tallyForQuestion,
  totalTantiemesResidence,
  weightedTallyForQuestion,
  type MajorityOutcome,
  type WeightedTally,
} from "@/lib/voteResults"
import {
  CLOSING_AT_BUFFER_SECONDS,
  VoteType,
  activeQuestionEndsAt,
  activeQuestionIndex,
  isSessionFinished,
  isVoteClosed,
  isVotePaused,
  isVoteStarted,
  nonResponseCountForQuestion,
  type Ballot,
  type Presence,
  type Vote,
  type VoteQuestion,
} from "@/types/vote"
import type { Lot } from "@/types/lot"
import { cn, PRIMARY_CTA_CLASS } from "@/lib/utils"

function formatCountdown(endsAt: Date, now: Date): string {
  const remainingMs = endsAt.getTime() - now.getTime()
  if (remainingMs <= 0) return "0:00"
  const totalSeconds = Math.floor(remainingMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

export default function VoteDetailPage() {
  const { id: residenceId, voteId } = useParams<{ id: string; voteId: string }>()
  const navigate = useNavigate()
  const [vote, setVote] = useState<Vote | null>(null)
  const [ballots, setBallots] = useState<Ballot[]>([])
  const [presences, setPresences] = useState<Presence[]>([])
  const [lots, setLots] = useState<Lot[]>([])
  const [loading, setLoading] = useState(true)
  // Force un rebuild chaque seconde pour le chronomètre / le recalcul de
  // isSessionFinished - vote.isSessionFinished/activeQuestionIndex sont des
  // calculs purs (jamais stockés côté Firestore), rien ne les rafraîchit
  // sinon en dehors d'une nouvelle écriture Firestore. Miroir de
  // Timer.periodic côté app mobile (vote_detail_page.dart).
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!residenceId || !voteId) return
    setLoading(true)
    return subscribeToVote(
      residenceId,
      voteId,
      (data) => {
        setVote(data)
        setLoading(false)
      },
      (error) => {
        toast.error("Impossible de charger le vote : " + error.message)
        setLoading(false)
      }
    )
  }, [residenceId, voteId])

  useEffect(() => {
    if (!residenceId || !voteId) return
    return subscribeToBallots(residenceId, voteId, setBallots, (error) =>
      toast.error("Impossible de charger les bulletins : " + error.message)
    )
  }, [residenceId, voteId])

  useEffect(() => {
    if (!residenceId || !voteId) return
    return subscribeToPresences(residenceId, voteId, setPresences, (error) =>
      toast.error("Impossible de charger les présences : " + error.message)
    )
  }, [residenceId, voteId])

  useEffect(() => {
    if (!residenceId) return
    return subscribeToLots(residenceId, setLots, (error) =>
      toast.error("Impossible de charger les lots : " + error.message)
    )
  }, [residenceId])

  const isAG = vote?.type === VoteType.assembleeGenerale
  const sessionLive = !!vote && isAG && isVoteStarted(vote) && !isSessionFinished(vote)

  useEffect(() => {
    if (!sessionLive) return
    const interval = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(interval)
  }, [sessionLive])

  async function handleDelete() {
    if (!residenceId || !voteId) return
    if (!confirm("Supprimer définitivement ce vote ?")) return
    try {
      await deleteVote(residenceId, voteId)
      toast.success("Vote supprimé")
      navigate(`/residences/${residenceId}`)
    } catch (err) {
      toast.error("Échec de la suppression : " + (err as Error).message)
    }
  }

  if (!residenceId || !voteId) return null

  const deletable = vote ? (isAG ? !isSessionFinished(vote) : !isVoteClosed(vote)) : false

  return (
    <div className="-mt-[20px] flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          to={`/residences/${residenceId}`}
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Résidence
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold tracking-tight text-[oklch(22%_0.01_150)]">
              {vote?.title || (loading ? "…" : "Vote introuvable")}
            </h1>
            {vote && <Badge variant="secondary">{isAG ? "Assemblée générale" : "Sondage"}</Badge>}
            {vote && <StatusBadge vote={vote} />}
          </div>
          {vote && deletable && (
            <Button type="button" variant="outline" onClick={handleDelete}>
              <Trash2 />
              Supprimer
            </Button>
          )}
        </div>
      </div>

      {!loading && !vote && <p className="text-muted-foreground">Ce vote n'existe pas ou a été supprimé.</p>}

      {vote && (
        <VoteBody
          residenceId={residenceId}
          vote={vote}
          ballots={ballots}
          presences={presences}
          lots={lots}
        />
      )}
    </div>
  )
}

function StatusBadge({ vote }: { vote: Vote }) {
  const isAG = vote.type === VoteType.assembleeGenerale
  if (isAG && !isVoteStarted(vote)) return <Badge variant="outline">En attente de lancement</Badge>
  if (isAG && isVoteStarted(vote) && !isSessionFinished(vote)) {
    return isVotePaused(vote) ? <Badge variant="outline">En pause</Badge> : <Badge>En cours</Badge>
  }
  const closed = isAG ? isSessionFinished(vote) : isVoteClosed(vote)
  return closed ? <Badge variant="secondary">Clos</Badge> : <Badge>Ouvert</Badge>
}

function VoteBody({
  residenceId,
  vote,
  ballots,
  presences,
  lots,
}: {
  residenceId: string
  vote: Vote
  ballots: Ballot[]
  presences: Presence[]
  lots: Lot[]
}) {
  const isAG = vote.type === VoteType.assembleeGenerale

  if (isAG && !isVoteStarted(vote)) {
    return <PrelaunchView residenceId={residenceId} vote={vote} lots={lots} presences={presences} />
  }

  if (isAG && isVoteStarted(vote) && !isSessionFinished(vote)) {
    const idx = activeQuestionIndex(vote)
    if (idx !== -1) {
      return (
        <ActiveQuestionView
          residenceId={residenceId}
          vote={vote}
          activeIndex={idx}
          ballots={ballots}
          lots={lots}
        />
      )
    }
    return <QuestionListView residenceId={residenceId} vote={vote} ballots={ballots} lots={lots} />
  }

  return <ResultsView vote={vote} ballots={ballots} lots={lots} />
}

function PrelaunchView({
  residenceId,
  vote,
  lots,
  presences,
}: {
  residenceId: string
  vote: Vote
  lots: Lot[]
  presences: Presence[]
}) {
  const [launching, setLaunching] = useState(false)

  const eligibleLotCount = lots.filter((l) => l.idProprietaire.length > 0).length
  const presentLotCount = new Set(presences.map((p) => p.lotId)).size

  // Re-vérifié ici (en plus de VoteFormDialog à la création) : les tantièmes
  // peuvent avoir été complétés/modifiés entre-temps.
  const blockReason = useMemo(() => {
    const hasAgQuestion = vote.questions.some((q) => q.majoriteRequise != null)
    if (hasAgQuestion && totalTantiemesResidence(lots) <= 0) {
      return "Lancement bloqué : aucun tantième n'est renseigné sur les lots."
    }
    return null
  }, [vote.questions, lots])

  async function handleLaunch() {
    if (launching || blockReason) return
    setLaunching(true)
    try {
      const startedAt = Timestamp.now()
      const closingAt = Timestamp.fromMillis(startedAt.toMillis() + CLOSING_AT_BUFFER_SECONDS * 1000)
      await startVoteSession(residenceId, vote.id, startedAt, closingAt)
    } catch (err) {
      toast.error("Échec du lancement : " + (err as Error).message)
    } finally {
      setLaunching(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardContent className="flex items-center gap-3 py-4">
          <Users className="size-5 text-primary" />
          <p className="text-sm font-semibold">
            Quorum (présence émargée) : {presentLotCount} / {eligibleLotCount} lot(s)
          </p>
        </CardContent>
      </Card>

      {vote.description && <p className="text-sm whitespace-pre-wrap text-foreground">{vote.description}</p>}

      <div className="flex flex-col gap-3">
        {vote.questions.map((q, i) => (
          <Card key={q.id}>
            <CardHeader>
              <CardTitle className="text-base">
                {i + 1}. {q.text}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {q.options.map((o) => (
                <Badge key={o.id} variant="outline">
                  {o.label}
                </Badge>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {blockReason && <p className="text-sm text-destructive">{blockReason}</p>}

      <Button type="button" className={cn("w-fit", PRIMARY_CTA_CLASS)} onClick={handleLaunch} disabled={launching || !!blockReason}>
        <Play />
        Lancer la session
      </Button>
    </div>
  )
}

function QuestionListView({
  residenceId,
  vote,
  ballots,
  lots,
}: {
  residenceId: string
  vote: Vote
  ballots: Ballot[]
  lots: Lot[]
}) {
  const [launching, setLaunching] = useState(false)
  const nextIndex = vote.questions.findIndex((q) => q.startedAt == null)

  async function handleLaunchQuestion(index: number) {
    if (launching) return
    setLaunching(true)
    try {
      const now = Timestamp.now()
      const nextVote: Vote = {
        ...vote,
        questions: vote.questions.map((q, i) => (i === index ? { ...q, startedAt: now } : q)),
      }
      nextVote.closingAt = Timestamp.fromMillis(
        now.toMillis() + (nextVote.questions[index].durationSeconds + CLOSING_AT_BUFFER_SECONDS) * 1000
      )
      await saveVote(residenceId, nextVote)
    } catch (err) {
      toast.error("Échec du lancement de la question : " + (err as Error).message)
    } finally {
      setLaunching(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {vote.description && <p className="text-sm whitespace-pre-wrap text-foreground">{vote.description}</p>}
      {vote.questions.map((q, i) => {
        if (q.startedAt != null) {
          return <QuestionResultCard key={q.id} vote={vote} question={q} ballots={ballots} lots={lots} />
        }
        const isNext = i === nextIndex
        return (
          <Card key={q.id} className={cn(isNext && "ring-1 ring-primary")}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">
                  {i + 1}. {q.text}
                </CardTitle>
                {isNext ? <Badge>Prochaine question</Badge> : <Badge variant="outline">En attente</Badge>}
              </div>
            </CardHeader>
            {isNext && (
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  {q.options.map((o) => (
                    <Badge key={o.id} variant="outline">
                      {o.label}
                    </Badge>
                  ))}
                </div>
                <Button
                  type="button"
                  className={cn("w-fit", PRIMARY_CTA_CLASS)}
                  onClick={() => handleLaunchQuestion(i)}
                  disabled={launching}
                >
                  <Play />
                  Lancer cette question
                </Button>
              </CardContent>
            )}
          </Card>
        )
      })}
    </div>
  )
}

function ActiveQuestionView({
  residenceId,
  vote,
  activeIndex,
  ballots,
  lots,
}: {
  residenceId: string
  vote: Vote
  activeIndex: number
  ballots: Ballot[]
  lots: Lot[]
}) {
  const [pausing, setPausing] = useState(false)
  const [skipping, setSkipping] = useState(false)
  const finalizedRef = useRef(false)
  const question = vote.questions[activeIndex]
  const endsAt = activeQuestionEndsAt(vote)
  const paused = isVotePaused(vote)

  // Marque "non répondu" les lots sans bulletin une fois le temps écoulé, et
  // injecte le cas échéant la question passerelle - même Cloud Function que
  // l'app mobile. Ne se déclenche qu'une fois par question (finalizedRef),
  // retente au tick suivant en cas d'échec réseau.
  useEffect(() => {
    finalizedRef.current = false
  }, [question.id])

  useEffect(() => {
    if (finalizedRef.current || paused) return
    if (activeQuestionIndex(vote) !== -1) return
    finalizedRef.current = true
    finalizeAgQuestionNonResponses(residenceId, vote.id, question.id).catch(() => {
      finalizedRef.current = false
    })
  })

  async function handlePauseToggle() {
    if (pausing) return
    setPausing(true)
    try {
      if (paused) {
        const pauseDuration = Date.now() - vote.pausedAt!.toDate().getTime()
        const newStartedAt = new Date(question.startedAt!.toDate().getTime() + pauseDuration)
        const nextVote: Vote = {
          ...vote,
          pausedAt: null,
          questions: vote.questions.map((q, i) =>
            i === activeIndex ? { ...q, startedAt: Timestamp.fromDate(newStartedAt) } : q
          ),
          closingAt: Timestamp.fromMillis(
            newStartedAt.getTime() + (question.durationSeconds + CLOSING_AT_BUFFER_SECONDS) * 1000
          ),
        }
        await saveVote(residenceId, nextVote)
      } else {
        await setVotePausedAt(residenceId, vote.id, Timestamp.now())
      }
    } catch (err) {
      toast.error("Échec : " + (err as Error).message)
    } finally {
      setPausing(false)
    }
  }

  async function handleSkip() {
    if (skipping) return
    setSkipping(true)
    try {
      const newStartedAt = new Date(Date.now() - (question.durationSeconds + 1) * 1000)
      const nextVote: Vote = {
        ...vote,
        questions: vote.questions.map((q, i) =>
          i === activeIndex ? { ...q, startedAt: Timestamp.fromDate(newStartedAt) } : q
        ),
      }
      await saveVote(residenceId, nextVote)
    } catch (err) {
      toast.error("Échec : " + (err as Error).message)
    } finally {
      setSkipping(false)
    }
  }

  // AG uniquement : décompte pondéré par tantièmes, mis à jour en direct au
  // fil des bulletins reçus - plus pertinent qu'un simple compte de lots
  // pour suivre l'avancement d'une résolution pendant la session live.
  const weightedTally =
    question.majoriteRequise != null
      ? weightedTallyForQuestion({
          ballots,
          lots,
          question,
          nonResponseLotIds: vote.nonResponseLots[question.id] ?? [],
        })
      : null
  const tally = tallyForQuestion(ballots, question.id)
  const totalAnswered = Object.values(tally).reduce((a, b) => a + b, 0)

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-6 text-center">
          <p className="text-sm font-semibold text-muted-foreground">
            Question {activeIndex + 1} / {vote.questions.length}
          </p>
          <h2 className="text-xl font-bold">{question.text}</h2>
          {paused && <Badge variant="outline">En pause</Badge>}
          {endsAt && (
            <div className="flex items-center gap-2 rounded-full bg-primary/10 px-5 py-2 text-primary">
              <Timer className="size-5" />
              <span className="text-2xl font-extrabold tabular-nums">{formatCountdown(endsAt, new Date())}</span>
            </div>
          )}
          <div className="flex w-full max-w-md flex-col gap-2">
            {weightedTally
              ? question.options.map((o) => (
                  <OptionBar
                    key={o.id}
                    label={o.label}
                    value={weightedTally.tantiemesParOption[o.id] ?? 0}
                    total={weightedTally.totalTantiemes}
                    suffix=" tantièmes"
                  />
                ))
              : question.options.map((o) => (
                  <OptionBar key={o.id} label={o.label} value={tally[o.id] ?? 0} total={totalAnswered} />
                ))}
          </div>
          <p className="text-xs text-muted-foreground">{totalAnswered} bulletin(s) reçu(s) pour l'instant</p>

          <div className="mt-2 flex gap-2">
            <Button type="button" variant="outline" onClick={handlePauseToggle} disabled={pausing}>
              {paused ? <Play /> : <Pause />}
              {paused ? "Reprendre" : "Mettre en pause"}
            </Button>
            <Button type="button" variant="outline" onClick={handleSkip} disabled={skipping}>
              <SkipForward />
              Passer
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ResultsView({
  vote,
  ballots,
  lots,
}: {
  vote: Vote
  ballots: Ballot[]
  lots: Lot[]
}) {
  return (
    <div className="flex flex-col gap-4">
      {vote.description && <p className="text-sm whitespace-pre-wrap text-foreground">{vote.description}</p>}
      {vote.questions.map((q) => (
        <QuestionResultCard key={q.id} vote={vote} question={q} ballots={ballots} lots={lots} />
      ))}
    </div>
  )
}

function QuestionResultCard({
  vote,
  question,
  ballots,
  lots,
}: {
  vote: Vote
  question: VoteQuestion
  ballots: Ballot[]
  lots: Lot[]
}) {
  let weightedTally: WeightedTally | null = null
  let majorityOutcome: MajorityOutcome | null = null
  if (question.majoriteRequise != null) {
    weightedTally = weightedTallyForQuestion({
      ballots,
      lots,
      question,
      nonResponseLotIds: vote.nonResponseLots[question.id] ?? [],
    })
    majorityOutcome = evaluateMajority(question, weightedTally)
  }

  const nonResponseCount = nonResponseCountForQuestion(vote, question.id)
  const simpleTally = tallyForQuestion(ballots, question.id)
  const totalAnswered = Object.values(simpleTally).reduce((a, b) => a + b, 0)

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{question.text}</CardTitle>
          {majorityOutcome && <MajoriteBadge outcome={majorityOutcome} />}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {weightedTally ? (
          <>
            {question.options.map((o) => (
              <OptionBar
                key={o.id}
                label={o.label}
                value={weightedTally!.tantiemesParOption[o.id] ?? 0}
                total={weightedTally!.totalTantiemes}
                suffix=" tantièmes"
              />
            ))}
            {nonResponseCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {nonResponseCount} lot(s) n'ont pas répondu ({weightedTally.tantiemesNonRepondu} tantièmes)
              </p>
            )}
          </>
        ) : (
          question.options.map((o) => <OptionBar key={o.id} label={o.label} value={simpleTally[o.id] ?? 0} total={totalAnswered} />)
        )}
      </CardContent>
    </Card>
  )
}

function OptionBar({
  label,
  value,
  total,
  suffix = "",
}: {
  label: string
  value: number
  total: number
  suffix?: string
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {value}
          {suffix} ({pct}%)
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function MajoriteBadge({ outcome }: { outcome: MajorityOutcome }) {
  if (outcome.status === "adoptee") {
    return (
      <Badge className="bg-green-600 text-white">
        <CheckCircle2 />
        Adoptée
      </Badge>
    )
  }
  if (outcome.status === "passerelle25_1" || outcome.status === "passerelle26_1") {
    return <Badge className="bg-orange-500 text-white">Passerelle {outcome.status === "passerelle25_1" ? "25-1" : "26-1"}</Badge>
  }
  return (
    <Badge variant="destructive">
      <XCircle />
      Rejetée
    </Badge>
  )
}
