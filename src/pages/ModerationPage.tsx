import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { CheckCircle2, Eye, EyeOff, ShieldAlert, Trash2, Undo2 } from "lucide-react"
import { ContentsSectionToggle } from "@/components/ContentsSectionToggle"
import { ContentPostDialog, type ContentPostRef } from "@/components/contents/ContentPostDialog"
import { DeleteContentDialog } from "@/components/contents/DeleteContentDialog"
import { FilterKpiCard } from "@/components/FilterKpiCard"
import { ConfirmActionDialog } from "@/components/residence-billing/ConfirmActionDialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { POST_TYPE_LABELS } from "@/lib/contentPosts"
import {
  moderateContent,
  REASON_LABELS,
  subscribeToModerationReports,
  TARGET_LABELS,
  type ModerationReport,
  type ModerationStatus,
} from "@/lib/moderation"
import { resolveUserLabels } from "@/lib/users"
import { cn } from "@/lib/utils"

// Contenus > Modération (superAdmin) : contenus signalés depuis l'app
// (« Signaler », report_content), un par ligne avec tous ses signalements.
// « Supprimer » archive et retire le contenu, l'auteur est prévenu avec le
// motif ; « Ignorer » le classe et, s'il était masqué après 3 signalements,
// le rétablit (moderate_content, konodal_app/functions_python/moderation.py).

const STATUS_LABEL: Record<ModerationStatus, string> = {
  A_TRAITER: "À traiter",
  IGNORE: "Ignorés",
  SUPPRIME: "Supprimés",
}

function formatDate(date: Date | null): string {
  return date ? date.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—"
}

export default function ModerationPage() {
  const [reports, setReports] = useState<ModerationReport[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<ModerationStatus>("A_TRAITER")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [authors, setAuthors] = useState<Map<string, string>>(new Map())
  const [opened, setOpened] = useState<ContentPostRef | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [ignoring, setIgnoring] = useState(false)

  useEffect(
    () =>
      subscribeToModerationReports(
        (data) => {
          setReports(data)
          setLoading(false)
        },
        (err) => {
          toast.error("Signalements illisibles : " + err.message)
          setLoading(false)
        }
      ),
    []
  )

  const counts = useMemo(() => {
    const c: Record<ModerationStatus, number> = { A_TRAITER: 0, IGNORE: 0, SUPPRIME: 0 }
    reports.forEach((r) => (c[r.status] += 1))
    return c
  }, [reports])

  // Masqués d'abord, puis les plus signalés, puis les plus récents.
  const listed = useMemo(
    () =>
      reports
        .filter((r) => r.status === status)
        .sort((a, b) =>
          status === "A_TRAITER"
            ? Number(b.hidden) - Number(a.hidden) ||
              b.reports.length - a.reports.length ||
              (b.lastReportAt?.getTime() ?? 0) - (a.lastReportAt?.getTime() ?? 0)
            : (b.decidedAt?.getTime() ?? 0) - (a.decidedAt?.getTime() ?? 0)
        ),
    [reports, status]
  )
  const selected = listed.find((r) => r.id === selectedId) ?? listed[0] ?? null

  const authorKey = [...new Set(reports.map((r) => r.content.authorUid).filter(Boolean))].sort().join(",")
  useEffect(() => {
    if (authorKey) resolveUserLabels(authorKey.split(",")).then(setAuthors)
  }, [authorKey])

  const defaultReason = selected
    ? [...new Set(selected.reports.map((r) => r.reasonLabel || REASON_LABELS[r.reason] || r.reason))].join(", ")
    : ""

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[30px] font-extrabold tracking-tight text-[oklch(20%_0.02_150)]">Contenus</h1>
        <ContentsSectionToggle current="moderation" />
      </div>

      <div className="flex flex-col gap-1">
        <h2 className="text-lg">Modération</h2>
        <p className="max-w-[720px] text-sm text-muted-foreground">
          Publications, commentaires et réponses signalés depuis l'app. Dès 3 signalements de 3 personnes, le contenu
          est masqué pour tous en attendant votre décision.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {(["A_TRAITER", "IGNORE", "SUPPRIME"] as ModerationStatus[]).map((s) => (
          <FilterKpiCard
            key={s}
            label={STATUS_LABEL[s]}
            value={counts[s]}
            icon={s === "A_TRAITER" ? ShieldAlert : s === "IGNORE" ? CheckCircle2 : Trash2}
            colorClass={
              s === "A_TRAITER"
                ? "bg-amber-100 text-amber-600"
                : s === "IGNORE"
                  ? "bg-slate-100 text-slate-600"
                  : "bg-red-100 text-red-600"
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
            {status === "A_TRAITER" ? "Aucun contenu signalé à traiter." : "Aucun contenu."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
          <div className="flex flex-col gap-2">
            {listed.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedId(r.id)}
                className={cn(
                  "flex flex-col gap-1.5 rounded-[14px] border bg-white p-[12px_14px] text-left text-sm",
                  selected?.id === r.id ? "border-primary ring-2 ring-primary/20" : "border-[oklch(93%_0.005_100)] hover:bg-muted/40"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold">
                    {r.content.title || r.content.text || "(sans texte)"}
                  </span>
                  {r.hidden ? (
                    <Badge className="shrink-0 border-transparent bg-amber-100 text-amber-800">
                      <EyeOff />
                      Masqué
                    </Badge>
                  ) : (
                    r.reports.length > 0 && (
                      <Badge variant="secondary" className="shrink-0">
                        {r.reports.length} signalement{r.reports.length > 1 ? "s" : ""}
                      </Badge>
                    )
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {TARGET_LABELS[r.targetType]} · {r.content.residenceName} ·{" "}
                  {formatDate(status === "A_TRAITER" ? r.lastReportAt : r.decidedAt)}
                </span>
              </button>
            ))}
          </div>

          {selected && (
            <Card>
              <CardContent className="flex flex-col gap-4 text-sm">
                <div className="flex flex-col gap-1">
                  <span className="text-[11.5px] font-bold tracking-wide text-primary uppercase">
                    {TARGET_LABELS[selected.targetType]} · {selected.content.residenceName}
                    {selected.content.postType ? ` · ${POST_TYPE_LABELS[selected.content.postType] ?? "Publication"}` : ""}
                  </span>
                  {selected.targetType !== "post" && selected.content.postTitle && (
                    <span className="text-xs text-muted-foreground">Sous la publication « {selected.content.postTitle} »</span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    Par{" "}
                    {selected.content.authorUid ? (
                      <Link to={`/residents/${selected.content.authorUid}`} className="font-semibold underline">
                        {authors.get(selected.content.authorUid) ?? (selected.content.authorName || selected.content.authorUid)}
                      </Link>
                    ) : (
                      "auteur inconnu"
                    )}{" "}
                    · publié le {formatDate(selected.content.createdAt)}
                  </span>
                </div>

                <div className="flex flex-col gap-2 rounded-[14px] bg-[oklch(97.5%_0.004_100)] p-4">
                  {selected.content.title && <span className="font-bold">{selected.content.title}</span>}
                  {selected.content.text && <p className="break-words whitespace-pre-wrap">{selected.content.text}</p>}
                  {selected.content.imageUrl && !selected.content.isVideo && (
                    <img src={selected.content.imageUrl} alt="" className="max-h-[300px] w-fit rounded-lg object-contain" />
                  )}
                </div>

                {selected.reports.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="font-bold">Signalements ({selected.reports.length})</span>
                    {selected.reports.map((rep) => (
                      <div key={rep.uid} className="flex flex-col gap-0.5 rounded-[12px] border border-[oklch(93%_0.005_100)] p-[10px_12px]">
                        <span>
                          <span className="font-semibold">{rep.reasonLabel || REASON_LABELS[rep.reason] || rep.reason}</span>
                          {rep.subReasonLabel ? ` · ${rep.subReasonLabel}` : ""}
                        </span>
                        {rep.details && <p className="text-[13px] whitespace-pre-wrap">« {rep.details} »</p>}
                        <span className="text-xs text-muted-foreground">
                          <Link to={`/residents/${rep.uid}`} className="underline">
                            {rep.name || rep.uid}
                          </Link>{" "}
                          · {formatDate(rep.at)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {selected.status !== "A_TRAITER" ? (
                  <p className="rounded-[12px] bg-muted/60 p-3 text-[13px]">
                    {selected.status === "SUPPRIME" ? "Supprimé" : "Ignoré"} le {formatDate(selected.decidedAt)}
                    {selected.source === "bo" && selected.reports.length === 0 ? " depuis la page Posts" : ""}
                    {selected.decisionReason ? ` · ${selected.decisionReason}` : ""}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() =>
                        setOpened({
                          residenceId: selected.residenceId,
                          postId: selected.postId,
                          residenceName: selected.content.residenceName,
                          highlight: selected.replyId || selected.commentId || undefined,
                        })
                      }
                    >
                      <Eye />
                      Voir dans la publication
                    </Button>
                    <Button variant="outline" onClick={() => setIgnoring(true)}>
                      {selected.hidden ? <Undo2 /> : <CheckCircle2 />}
                      {selected.hidden ? "Rétablir" : "Ignorer"}
                    </Button>
                    <Button
                      variant="destructive"
                      className="bg-destructive text-white hover:bg-destructive/90"
                      onClick={() => setDeleting(true)}
                    >
                      <Trash2 />
                      Supprimer
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <ContentPostDialog target={opened} onClose={() => setOpened(null)} />
      <DeleteContentDialog
        target={deleting && selected ? { reportId: selected.id } : null}
        targetLabel={selected ? TARGET_LABELS[selected.targetType] : ""}
        defaultReason={defaultReason}
        onOpenChange={setDeleting}
      />
      <ConfirmActionDialog
        open={ignoring}
        onOpenChange={setIgnoring}
        title={selected?.hidden ? "Rétablir ce contenu ?" : "Ignorer ce signalement ?"}
        description={
          selected?.hidden
            ? "Le contenu redevient visible pour tous dans l'app et les signalements sont classés."
            : "Le contenu reste visible et les signalements sont classés. Un nouveau signalement d'une autre personne le fera revenir ici."
        }
        confirmLabel={selected?.hidden ? "Rétablir" : "Ignorer"}
        onConfirm={async () => {
          if (!selected) return
          try {
            await moderateContent({ reportId: selected.id }, "ignore", selected.hidden ? "Rétabli" : "Ignoré")
            toast.success(selected.hidden ? "Contenu rétabli" : "Signalement ignoré")
          } catch (err) {
            toast.error("Action impossible : " + (err as Error).message)
            throw err
          }
        }}
      />
    </div>
  )
}
