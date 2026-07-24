import { useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { ChevronDown, Eye, MessageCircle, Plus, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { CommunicationFormDialog } from "@/components/CommunicationFormDialog"
import { SearchableSelect } from "@/components/SearchableSelect"
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
import { useUniqueViewCount } from "@/hooks/useUniqueViewCount"
import { useScopedResidenceIds } from "@/hooks/useScopedResidenceIds"
import { useAuth } from "@/lib/auth-context"
import { createCommunication } from "@/lib/communications"
import { cn } from "@/lib/utils"
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
// un groupe à elle seule, même rendu que les autres.
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

export default function CommunicationsPage() {
  const { user } = useAuth()
  const { scopedResidenceIds } = useScopedResidenceIds()
  const { communications, residences, loading } = useAllCommunications(
    (message) => toast.error(message),
    scopedResidenceIds
  )
  const [search, setSearch] = useState("")
  const [residenceFilter, setResidenceFilter] = useState("all")
  const [communicating, setCommunicating] = useState(false)
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set())

  const normalizedSearch = search.trim().toLowerCase()
  const residenceOptions = [...new Map(communications.map((c) => [c.residenceId, c.residenceName])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1]))

  const filteredCommunications = communications.filter((c) => {
    if (residenceFilter !== "all" && c.residenceId !== residenceFilter) return false
    if (!normalizedSearch) return true
    return (
      c.title.toLowerCase().includes(normalizedSearch) || c.description.toLowerCase().includes(normalizedSearch)
    )
  })

  const groups = groupCommunications(filteredCommunications)
  // Une publication faite sur une seule résidence n'a pas de raison d'être
  // repliée (rien à dérouler) - affichée à plat dans un tableau, comme avant
  // l'introduction du groupage. Seules les publications multi-résidences
  // gardent la card dépliable.
  const multiResidenceGroups = groups.filter((g) => g.items.length > 1)
  const singleResidenceCommunications = groups
    .filter((g) => g.items.length === 1)
    .map((g) => g.items[0])

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Communication</h1>
        <Button onClick={() => setCommunicating(true)}>
          <Plus />
          Communiquer
        </Button>
      </div>

      <div className="flex items-center gap-3">
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
      </div>

      {multiResidenceGroups.length > 0 && (
        <div className="flex flex-col gap-3">
          {multiResidenceGroups.map((group) => (
            <CommunicationGroupCard
              key={group.groupId}
              group={group}
              expanded={expandedGroupIds.has(group.groupId)}
              onToggle={() => toggleGroup(group.groupId)}
            />
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)] ring-1 ring-foreground/10">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead>Titre</TableHead>
              <TableHead>Résidence</TableHead>
              <TableHead>Publiée le</TableHead>
              <TableHead>Commentaires</TableHead>
              <TableHead>Vues uniques</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="bg-white">
            {singleResidenceCommunications.map((communication) => (
              <CommunicationRow
                key={`${communication.residenceId}-${communication.id}`}
                communication={communication}
                showTitle
              />
            ))}
            {!loading && multiResidenceGroups.length === 0 && singleResidenceCommunications.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Aucune communication pour l'instant.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <CommunicationFormDialog
        open={communicating}
        onOpenChange={setCommunicating}
        residences={residences}
        onSubmit={async (residenceId, input) => {
          if (!user) return
          await createCommunication(residenceId, user.uid, input)
        }}
      />
    </div>
  )
}

function CommunicationGroupCard({
  group,
  expanded,
  onToggle,
}: {
  group: CommunicationGroup
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <Card className="overflow-hidden rounded-xl bg-white p-0 shadow-[0_8px_30px_rgb(0,0,0,0.06)] ring-1 ring-foreground/10">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium">{group.title || "Sans titre"}</span>
          {group.audience === "proprietaires" && (
            <Badge variant="outline" className="shrink-0 border-transparent bg-muted text-muted-foreground">
              Propriétaires
            </Badge>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground">
          <span>
            {group.items.length} résidence{group.items.length > 1 ? "s" : ""}
          </span>
          <span>{group.creationDate ? group.creationDate.toLocaleDateString("fr-FR") : "—"}</span>
          <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} />
        </div>
      </button>
      {expanded && (
        <div className="border-t">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Résidence</TableHead>
                <TableHead>Publiée le</TableHead>
                <TableHead>Commentaires</TableHead>
                <TableHead>Vues uniques</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="bg-white">
              {group.items.map((communication) => (
                <CommunicationRow
                  key={`${communication.residenceId}-${communication.id}`}
                  communication={communication}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  )
}

function CommunicationRow({
  communication,
  showTitle,
}: {
  communication: CommunicationWithResidence
  showTitle?: boolean
}) {
  const commentStats = useCommentStats(communication.residenceId, communication.id)
  const uniqueViewCount = useUniqueViewCount(communication.residenceId, communication.id)

  return (
    <TableRow>
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
      <TableCell>{communication.residenceName}</TableCell>
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
          render={<Link to={`/communications/${communication.residenceId}/${communication.id}`} />}
        >
          Gérer
        </Button>
      </TableCell>
    </TableRow>
  )
}
