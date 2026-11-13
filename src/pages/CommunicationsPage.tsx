import { useEffect, useState } from "react"
import { Link, Navigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { ChevronDown, ChevronRight, Eye, MessageCircle, Plus, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CommunicationFormDialog } from "@/components/CommunicationFormDialog"
import { CommunicationTabs } from "@/components/CommunicationTabs"
import { PageHeader } from "@/components/PageHeader"
import { SearchableSelect } from "@/components/SearchableSelect"
import { DateInput } from "@/components/DateInput"
import { ClearFiltersButton } from "@/components/ClearFiltersButton"
import { inDateRange } from "@/lib/filters"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAllCommunications, type CommunicationWithResidence } from "@/hooks/useAllCommunications"
import { useCommentStats } from "@/hooks/useCommentCount"
import { useTableSort } from "@/hooks/useTableSort"
import { SortableTableHead } from "@/components/SortableTableHead"
import { useUniqueViewCount } from "@/hooks/useUniqueViewCount"
import { useAuth } from "@/lib/auth-context"
import { createCommunication, scheduleCommunication } from "@/lib/communications"
import {
  useScheduledCommunications,
  type ScheduledCommunicationWithResidence,
} from "@/hooks/useScheduledCommunications"
import { ScheduledCommunicationsCard } from "@/components/ScheduledCommunicationsCard"
import { KonodalNewsView } from "@/components/KonodalNewsView"
import { KonodalNewsFormDialog } from "@/components/KonodalNewsFormDialog"
import { subscribeToKonodalNews, type KonodalNews } from "@/lib/konodalNews"
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin"
import { cn, PRIMARY_CTA_CLASS } from "@/lib/utils"
import type { CommunicationAudience } from "@/types/communication"

type CommunicationGroup = {
  groupId: string
  title: string
  audience: CommunicationAudience
  creationDate: Date | null
  items: CommunicationWithResidence[]
}

// Regroupe les copies d'une même publication multi-résidences (cf.
// Communication.groupId) - une copie isolée (groupId == son propre id) forme
// un groupe à elle seule, affichée comme une ligne normale (cf. rendu plus
// bas : seuls les groupes à plusieurs résidences sont dépliables).
function groupCommunications(list: CommunicationWithResidence[]): CommunicationGroup[] {
  const byGroup = new Map<string, CommunicationWithResidence[]>()
  for (const c of list) {
    const items = byGroup.get(c.groupId) ?? []
    items.push(c)
    byGroup.set(c.groupId, items)
  }
  return [...byGroup.values()]
    .map((items) => {
      const sorted = [...items].sort(
        (a, b) => (b.creationDate?.getTime() ?? 0) - (a.creationDate?.getTime() ?? 0)
      )
      const first = sorted[0]
      return {
        groupId: first.groupId,
        title: first.title,
        audience: first.audience,
        creationDate: first.creationDate,
        items: sorted,
      }
    })
    .sort((a, b) => (b.creationDate?.getTime() ?? 0) - (a.creationDate?.getTime() ?? 0))
}

type CommunicationView = "fil" | "chat"

// Communication : fil d'actualité (posts, agences et agents dans leurs
// résidences) et Chat Konodal (konodalNews, superAdmin seul). Une seule page
// pour les deux vues (/communications/:vue), comme la Base de connaissances
// Nodo : l'en-tête reste en place à la bascule, et les deux vues restent
// montées avec leurs données (rien n'est rechargé ni reconstruit).
export default function CommunicationsPage() {
  const { vue } = useParams()
  const { user } = useAuth()
  const { isSuperAdmin, loading: roleLoading } = useIsSuperAdmin()
  const view: CommunicationView = vue === "chat" ? "chat" : "fil"
  const { communications, residences, loading } = useAllCommunications((message) => toast.error(message))
  const scheduledCommunications = useScheduledCommunications()
  const [communicating, setCommunicating] = useState(false)

  // Chat Konodal : superAdmin seulement (règle Firestore : liste complète,
  // brouillons compris, réservée au superAdmin).
  const [news, setNews] = useState<KonodalNews[]>([])
  const [newsLoading, setNewsLoading] = useState(true)
  const [newsError, setNewsError] = useState<string | null>(null)
  const [newsForm, setNewsForm] = useState<{ open: boolean; news: KonodalNews | null }>({ open: false, news: null })
  useEffect(() => {
    if (!isSuperAdmin) return
    return subscribeToKonodalNews(
      (list) => {
        setNews(list)
        setNewsError(null)
        setNewsLoading(false)
      },
      (err) => {
        setNewsError(err.message)
        setNewsLoading(false)
      }
    )
  }, [isSuperAdmin])

  if (vue !== "fil" && vue !== "chat") return <Navigate to="/communications/fil" replace />
  if (view === "chat" && !roleLoading && !isSuperAdmin) return <Navigate to="/communications/fil" replace />

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Communication"
        toggle={<CommunicationTabs />}
        actions={
          view === "chat" ? (
            isSuperAdmin && (
              <Button onClick={() => setNewsForm({ open: true, news: null })} className={PRIMARY_CTA_CLASS}>
                <Plus />
                Nouveau message
              </Button>
            )
          ) : (
            <Button onClick={() => setCommunicating(true)} className={PRIMARY_CTA_CLASS}>
              <Plus />
              Communiquer
            </Button>
          )
        }
      />

      <div className={cn(view !== "fil" && "hidden")}>
        <FeedView communications={communications} loading={loading} scheduledCommunications={scheduledCommunications} />
      </div>
      {isSuperAdmin && (
        <div className={cn(view !== "chat" && "hidden")}>
          <KonodalNewsView
            news={news}
            loading={newsLoading}
            error={newsError}
            onEdit={(item) => setNewsForm({ open: true, news: item })}
          />
        </div>
      )}

      <CommunicationFormDialog
        open={communicating}
        onOpenChange={setCommunicating}
        residences={residences}
        onSubmit={async (residenceId, input, publishAt) => {
          if (!user) return
          if (publishAt) {
            await scheduleCommunication(residenceId, user.uid, input, publishAt)
          } else {
            await createCommunication(residenceId, user.uid, input)
          }
        }}
      />
      {isSuperAdmin && (
        <KonodalNewsFormDialog
          open={newsForm.open}
          news={newsForm.news}
          onOpenChange={(open) => setNewsForm((prev) => ({ ...prev, open }))}
        />
      )}
    </div>
  )
}

function FeedView({
  communications,
  loading,
  scheduledCommunications,
}: {
  communications: CommunicationWithResidence[]
  loading: boolean
  scheduledCommunications: ScheduledCommunicationWithResidence[]
}) {
  const [search, setSearch] = useState("")
  const [residenceFilter, setResidenceFilter] = useState("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set())

  const normalizedSearch = search.trim().toLowerCase()
  const residenceOptions = [...new Map(communications.map((c) => [c.residenceId, c.residenceName])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1]))

  const filteredCommunications = communications.filter((c) => {
    if (residenceFilter !== "all" && c.residenceId !== residenceFilter) return false
    if (!inDateRange(c.creationDate, dateFrom, dateTo)) return false
    if (!normalizedSearch) return true
    return (
      c.title.toLowerCase().includes(normalizedSearch) || c.description.toLowerCase().includes(normalizedSearch)
    )
  })

  // Tri des groupes (lignes parentes) ; les résidences d'un groupe restent
  // de la plus récente à la plus ancienne.
  const { sortedRows: groups, headProps } = useTableSort(groupCommunications(filteredCommunications), {
    title: (g) => g.title,
    residence: (g) =>
      g.items
        .map((c) => c.residenceName)
        .sort((a, b) => a.localeCompare(b, "fr"))
        .join(", "),
    date: (g) => g.creationDate,
  })

  function toggleGroup(groupId: string) {
    setExpandedGroupIds((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une communication..."
              className="pl-8"
            />
          </div>
          <SearchableSelect
            value={residenceFilter}
            onChange={setResidenceFilter}
            className="w-56"
            emptyLabel="Toutes les résidences"
            groups={[
              {
                options: [
                  { value: "all", label: "Toutes les résidences" },
                  ...residenceOptions.map(([id, name]) => ({ value: id, label: name })),
                ],
              },
            ]}
          />
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span>Publiée du</span>
            <DateInput value={dateFrom} onChange={setDateFrom} />
            <span>au</span>
            <DateInput value={dateTo} onChange={setDateTo} />
          </div>
          <ClearFiltersButton
            active={!!search || residenceFilter !== "all" || !!dateFrom || !!dateTo}
            onClick={() => {
              setSearch("")
              setResidenceFilter("all")
              setDateFrom("")
              setDateTo("")
            }}
          />
        </CardContent>
      </Card>

      <ScheduledCommunicationsCard items={scheduledCommunications} />

      <div className="overflow-hidden rounded-[24px] border border-[oklch(93%_0.005_100)] bg-white shadow-[0_1px_2px_oklch(20%_0_0/0.03),0_14px_34px_-22px_oklch(20%_0_0/0.12)]">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <SortableTableHead {...headProps("title")}>Titre</SortableTableHead>
              <SortableTableHead {...headProps("residence")}>Résidence</SortableTableHead>
              <SortableTableHead {...headProps("date")}>Publiée le</SortableTableHead>
              <TableHead>Commentaires</TableHead>
              <TableHead>Vues uniques</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="bg-white">
            {groups.map((group) =>
              group.items.length > 1 ? (
                <CommunicationGroupRows
                  key={group.groupId}
                  group={group}
                  expanded={expandedGroupIds.has(group.groupId)}
                  onToggle={() => toggleGroup(group.groupId)}
                />
              ) : (
                <CommunicationRow
                  key={`${group.items[0].residenceId}-${group.items[0].id}`}
                  communication={group.items[0]}
                  showTitle
                />
              )
            )}
            {!loading && groups.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  {communications.length === 0 ? "Aucune communication pour l'instant." : "Aucun résultat pour ces filtres."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// Ligne parente (repliable) + ses lignes enfants (une par résidence) quand
// dépliée - un fragment de <TableRow> est valide directement dans un
// <TableBody>, pas besoin d'une card ni d'un tableau imbriqué séparé.
function CommunicationGroupRows({
  group,
  expanded,
  onToggle,
}: {
  group: CommunicationGroup
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <>
      <TableRow className="cursor-pointer bg-muted/30 hover:bg-muted/40" onClick={onToggle}>
        <TableCell className="font-medium">
          <div className="flex items-center gap-1.5">
            {expanded ? (
              <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            )}
            {group.title || "Sans titre"}
            {group.audience === "proprietaires" && (
              <Badge variant="outline" className="border-transparent bg-muted text-muted-foreground">
                Propriétaires
              </Badge>
            )}
          </div>
        </TableCell>
        <TableCell className="text-muted-foreground">
          {group.items.length} résidences
        </TableCell>
        <TableCell className="text-muted-foreground">
          {group.creationDate ? group.creationDate.toLocaleDateString("fr-FR") : "—"}
        </TableCell>
        <TableCell />
        <TableCell />
        <TableCell />
      </TableRow>
      {expanded &&
        group.items.map((communication) => (
          <CommunicationRow
            key={`${communication.residenceId}-${communication.id}`}
            communication={communication}
            nested
          />
        ))}
    </>
  )
}

function CommunicationRow({
  communication,
  showTitle,
  nested,
}: {
  communication: CommunicationWithResidence
  showTitle?: boolean
  nested?: boolean
}) {
  const commentStats = useCommentStats(communication.residenceId, communication.id)
  const uniqueViewCount = useUniqueViewCount(communication.residenceId, communication.id)

  return (
    <TableRow className={cn(nested && "bg-muted/10")}>
      {showTitle && (
        <TableCell className="font-medium">
          <div className="flex items-center gap-1.5">
            {communication.title || "Sans titre"}
            {communication.audience === "proprietaires" && (
              <Badge variant="outline" className="border-transparent bg-muted text-muted-foreground">
                Propriétaires
              </Badge>
            )}
          </div>
        </TableCell>
      )}
      {nested && <TableCell />}
      <TableCell className={cn(nested && "pl-8")}>{communication.residenceName}</TableCell>
      <TableCell className="text-muted-foreground">
        {communication.creationDate ? communication.creationDate.toLocaleDateString("fr-FR") : "—"}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <MessageCircle className="size-3.5" />
          {commentStats.count}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Eye className="size-3.5" />
          {uniqueViewCount}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link to={`/communications/${communication.residenceId}/${communication.id}`} />}
        >
          Gérer
        </Button>
      </TableCell>
    </TableRow>
  )
}
