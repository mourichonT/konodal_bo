import { useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { Eye, MessageCircle, Plus, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { CommunicationFormDialog } from "@/components/CommunicationFormDialog"
import { SearchableSelect } from "@/components/SearchableSelect"
import { SinistreThumbnail } from "@/components/SinistreThumbnail"
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

      <div className="overflow-hidden rounded-xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)] ring-1 ring-foreground/10">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead>Photo</TableHead>
              <TableHead>Titre</TableHead>
              <TableHead>Résidence</TableHead>
              <TableHead>Publiée le</TableHead>
              <TableHead>Commentaires</TableHead>
              <TableHead>Vues uniques</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="bg-white">
            {filteredCommunications.map((communication) => (
              <CommunicationRow
                key={`${communication.residenceId}-${communication.id}`}
                communication={communication}
              />
            ))}
            {!loading && filteredCommunications.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
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

function CommunicationRow({ communication }: { communication: CommunicationWithResidence }) {
  const commentStats = useCommentStats(communication.residenceId, communication.id)
  const uniqueViewCount = useUniqueViewCount(communication.residenceId, communication.id)

  return (
    <TableRow>
      <TableCell>
        <SinistreThumbnail pathImage={communication.pathImage} className="size-10 rounded-md" />
      </TableCell>
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
