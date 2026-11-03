import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { EyeOff, Heart, ImageIcon, Search } from "lucide-react"
import { ClearFiltersButton } from "@/components/ClearFiltersButton"
import { ContentsSectionToggle } from "@/components/ContentsSectionToggle"
import { ContentPostDialog, type ContentPostRef } from "@/components/contents/ContentPostDialog"
import { MultiSelectFilter } from "@/components/MultiSelectFilter"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useScopedResidences } from "@/hooks/useScopedResidenceIds"
import { POST_TYPE_LABELS, subscribeToResidencePosts, type ContentPost } from "@/lib/contentPosts"
import { resolveUserLabels } from "@/lib/users"

// Contenus > Posts (superAdmin) : toutes les publications de toutes les
// résidences, tous types confondus, les plus récentes d'abord. Un clic
// ouvre la publication avec ses commentaires, supprimables par la
// modération (ContentPostDialog).

const PAGE_SIZE = 50

export default function ContentPostsPage() {
  const { residences, loading } = useScopedResidences()
  const [byResidence, setByResidence] = useState<Record<string, ContentPost[]>>({})
  const [authors, setAuthors] = useState<Map<string, string>>(new Map())
  const [search, setSearch] = useState("")
  const [residenceFilter, setResidenceFilter] = useState<string[]>([])
  const [typeFilter, setTypeFilter] = useState<string[]>([])
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [opened, setOpened] = useState<ContentPostRef | null>(null)

  useEffect(() => {
    const unsubscribes = residences.map((residence) =>
      subscribeToResidencePosts(
        residence.id,
        (posts) => setByResidence((prev) => ({ ...prev, [residence.id]: posts })),
        (error) => toast.error(`Publications de ${residence.name} illisibles : ${error.message}`)
      )
    )
    return () => unsubscribes.forEach((unsub) => unsub())
  }, [residences])

  const residenceName = useMemo(() => new Map(residences.map((r) => [r.id, r.name])), [residences])
  const posts = useMemo(
    () =>
      Object.values(byResidence)
        .flat()
        .sort((a, b) => (b.creationDate?.getTime() ?? 0) - (a.creationDate?.getTime() ?? 0)),
    [byResidence]
  )

  const authorKey = [...new Set(posts.map((p) => p.user).filter(Boolean))].sort().join(",")
  useEffect(() => {
    if (authorKey) resolveUserLabels(authorKey.split(",")).then(setAuthors)
  }, [authorKey])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return posts.filter((p) => {
      if (residenceFilter.length && !residenceFilter.includes(residenceName.get(p.residenceId) ?? "")) return false
      if (typeFilter.length && !typeFilter.includes(POST_TYPE_LABELS[p.type] ?? "Autre")) return false
      if (!q) return true
      return [p.title, p.description, authors.get(p.user) ?? ""].some((v) => v.toLowerCase().includes(q))
    })
  }, [posts, search, residenceFilter, typeFilter, residenceName, authors])

  useEffect(() => setLimit(PAGE_SIZE), [search, residenceFilter, typeFilter])

  const residenceOptions = useMemo(() => residences.map((r) => r.name).sort((a, b) => a.localeCompare(b)), [residences])
  const typeOptions = useMemo(
    () => [...new Set(posts.map((p) => POST_TYPE_LABELS[p.type] ?? "Autre"))].sort((a, b) => a.localeCompare(b)),
    [posts]
  )
  const hiddenCount = posts.filter((p) => p.hidden).length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[30px] font-extrabold tracking-tight text-[oklch(20%_0.02_150)]">Contenus</h1>
        <ContentsSectionToggle current="posts" />
      </div>

      <div className="overflow-hidden rounded-[24px] border border-[oklch(93%_0.005_100)] bg-white shadow-[0_1px_2px_oklch(20%_0_0/0.03),0_14px_34px_-22px_oklch(20%_0_0/0.12)]">
        <div className="px-7 pt-[26px] pb-5">
          <h2 className="mb-1 text-[17px] font-bold text-[oklch(22%_0.01_150)]">Toutes les publications</h2>
          <p className="text-[13.5px] text-muted-foreground">
            {posts.length} publications de {residences.length} résidences, tous types confondus
            {hiddenCount ? `, dont ${hiddenCount} masquées après des signalements` : ""}. Ouvrez-en une pour lire ses
            commentaires ou la supprimer.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-[oklch(95%_0.003_100)] px-7 py-4">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher un titre, un texte ou un auteur…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <MultiSelectFilter
            label="Résidence"
            options={residenceOptions}
            selected={residenceFilter}
            onChange={setResidenceFilter}
            allLabel="Toutes"
            placeholder="Rechercher une résidence…"
          />
          <MultiSelectFilter
            label="Type"
            options={typeOptions}
            selected={typeFilter}
            onChange={setTypeFilter}
            allLabel="Tous"
            placeholder="Rechercher un type…"
          />
          <ClearFiltersButton
            active={!!search || residenceFilter.length > 0 || typeFilter.length > 0}
            onClick={() => {
              setSearch("")
              setResidenceFilter([])
              setTypeFilter([])
            }}
          />
        </div>

        <div className="flex flex-col border-t border-[oklch(95%_0.003_100)]">
          {loading ? (
            <p className="px-7 py-6 text-sm text-muted-foreground">Chargement…</p>
          ) : filtered.length === 0 ? (
            <p className="px-7 py-6 text-sm text-muted-foreground">Aucune publication.</p>
          ) : (
            filtered.slice(0, limit).map((p) => (
              <button
                key={`${p.residenceId}/${p.id}`}
                type="button"
                onClick={() =>
                  setOpened({ residenceId: p.residenceId, postId: p.id, residenceName: residenceName.get(p.residenceId) ?? "" })
                }
                className="flex w-full min-w-0 items-center gap-4 border-b border-[oklch(96%_0.003_100)] px-7 py-3.5 text-left last:border-b-0 hover:bg-[oklch(98.5%_0.003_100)]"
              >
                {p.pathImage && !p.isVideo ? (
                  <img src={p.pathImage} alt="" className="size-12 shrink-0 rounded-[10px] object-cover" />
                ) : (
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-[10px] bg-[oklch(96%_0.005_100)] text-muted-foreground">
                    <ImageIcon className="size-4" />
                  </span>
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-bold text-[oklch(24%_0.01_150)]">
                      {p.title || p.description || "(sans titre)"}
                    </span>
                    {p.hidden && (
                      <Badge className="shrink-0 border-transparent bg-amber-100 text-amber-800">
                        <EyeOff />
                        Masqué
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span className="rounded-[7px] bg-[oklch(95%_0.005_100)] px-2 py-0.5 font-bold text-[oklch(35%_0.01_150)]">
                      {POST_TYPE_LABELS[p.type] ?? "Autre"}
                    </span>
                    <span>{residenceName.get(p.residenceId) ?? p.residenceId}</span>
                    <span>·</span>
                    <span>{authors.get(p.user) ?? (p.user ? "…" : "Auteur inconnu")}</span>
                    <span>·</span>
                    <span>{p.creationDate ? p.creationDate.toLocaleDateString("fr-FR") : "—"}</span>
                    <span className="flex items-center gap-1">
                      <Heart className="size-3" /> {p.likes}
                    </span>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
        {filtered.length > limit && (
          <div className="flex justify-center border-t border-[oklch(95%_0.003_100)] px-7 py-4">
            <Button variant="outline" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
              Afficher {Math.min(PAGE_SIZE, filtered.length - limit)} de plus ({filtered.length - limit} restantes)
            </Button>
          </div>
        )}
      </div>

      <ContentPostDialog target={opened} onClose={() => setOpened(null)} />
    </div>
  )
}
