import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { doc, getDoc } from "firebase/firestore"
import { toast } from "sonner"
import { ArrowLeft, Eye, MessageCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PostCommentsCard } from "@/components/PostCommentsCard"
import { SinistreMediaViewer } from "@/components/SinistreMediaViewer"
import { db } from "@/firebase"
import { subscribeToCommunication } from "@/lib/communications"
import { subscribeToUser } from "@/lib/users"
import { useCommentStats } from "@/hooks/useCommentCount"
import { useUniqueViewCount } from "@/hooks/useUniqueViewCount"
import type { Communication } from "@/types/communication"
import type { KonodalUser } from "@/types/user"

export default function CommunicationDetailPage() {
  const { residenceId, postId } = useParams<{ residenceId: string; postId: string }>()
  const [communication, setCommunication] = useState<Communication | null>(null)
  const [loading, setLoading] = useState(true)
  const [residenceName, setResidenceName] = useState<string | null>(null)
  const [author, setAuthor] = useState<KonodalUser | null>(null)

  const commentStats = useCommentStats(residenceId ?? "", postId ?? "")
  const uniqueViewCount = useUniqueViewCount(residenceId ?? "", postId ?? "")

  useEffect(() => {
    if (!residenceId || !postId) return
    setLoading(true)
    return subscribeToCommunication(
      residenceId,
      postId,
      (data) => {
        setCommunication(data)
        setLoading(false)
      },
      (error) => {
        toast.error("Impossible de charger la communication : " + error.message)
        setLoading(false)
      }
    )
  }, [residenceId, postId])

  useEffect(() => {
    if (!residenceId) return
    getDoc(doc(db, "residences", residenceId)).then((snap) => {
      setResidenceName(snap.exists() ? ((snap.data().name as string) ?? null) : null)
    })
  }, [residenceId])

  useEffect(() => {
    if (!communication?.user) return
    return subscribeToUser(communication.user, setAuthor, () => setAuthor(null))
  }, [communication?.user])

  if (!residenceId || !postId) return null

  return (
    <div className="-mt-[20px] flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Link
          to="/communications"
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Communication
        </Link>
        <h1 className="text-2xl font-semibold">
          {communication ? communication.title || "Sans titre" : loading ? "…" : "Communication introuvable"}
        </h1>
      </div>

      {!loading && !communication && (
        <p className="text-muted-foreground">Cette communication n'existe pas ou a été supprimée.</p>
      )}

      {communication && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
              <CardHeader>
                <CardTitle className="text-base">Communication</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Résidence : </span>
                  {residenceName ?? "—"}
                </div>
                <div>
                  <span className="text-muted-foreground">Publiée par : </span>
                  {author ? [author.surname, author.name].filter(Boolean).join(" ") || "—" : "—"}
                </div>
                <div>
                  <span className="text-muted-foreground">Publiée le : </span>
                  {communication.creationDate ? communication.creationDate.toLocaleDateString("fr-FR") : "—"}
                </div>
                <div className="flex items-center gap-4 border-t pt-3">
                  <div className="flex items-center gap-1.5">
                    <MessageCircle className="size-3.5 text-muted-foreground" />
                    {commentStats.count} commentaire{commentStats.count > 1 ? "s" : ""}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Eye className="size-3.5 text-muted-foreground" />
                    {uniqueViewCount} vue{uniqueViewCount > 1 ? "s" : ""} unique{uniqueViewCount > 1 ? "s" : ""}
                  </div>
                </div>
                <div className="flex flex-col gap-1 border-t pt-3">
                  <span className="text-muted-foreground">Description :</span>
                  <span>{communication.description || "Aucune description."}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-6">
            <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
              <CardHeader>
                <CardTitle className="text-base">Photo / vidéo</CardTitle>
              </CardHeader>
              <CardContent>
                <SinistreMediaViewer pathImage={communication.pathImage} className="aspect-video w-full rounded-lg" />
              </CardContent>
            </Card>

            <PostCommentsCard residenceId={residenceId} postId={postId} />
          </div>
        </div>
      )}
    </div>
  )
}
