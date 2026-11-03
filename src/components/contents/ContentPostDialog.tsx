import { useEffect, useState } from "react"
import { doc, onSnapshot } from "firebase/firestore"
import { EyeOff, Heart, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DeleteContentDialog } from "@/components/contents/DeleteContentDialog"
import { db } from "@/firebase"
import { subscribeToPostComments, type PostComment } from "@/lib/comments"
import { POST_TYPE_LABELS, type ContentPost } from "@/lib/contentPosts"
import type { ModerationTargetRef } from "@/lib/moderation"
import { resolveUserLabels } from "@/lib/users"
import { cn } from "@/lib/utils"

// Publication avec ses commentaires et réponses (pages Contenus,
// superAdmin), chaque élément supprimable par la modération. highlight :
// commentaire ou réponse signalé, mis en évidence.

export type ContentPostRef = { residenceId: string; postId: string; residenceName: string; highlight?: string }

function formatDate(date: Date | null): string {
  return date ? date.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—"
}

function HiddenBadge() {
  return (
    <Badge className="border-transparent bg-amber-100 text-amber-800">
      <EyeOff />
      Masqué
    </Badge>
  )
}

export function ContentPostDialog({ target, onClose }: { target: ContentPostRef | null; onClose: () => void }) {
  const [post, setPost] = useState<(ContentPost & { missing?: boolean }) | null>(null)
  const [comments, setComments] = useState<PostComment[]>([])
  const [authors, setAuthors] = useState<Map<string, string>>(new Map())
  const [deleting, setDeleting] = useState<{ ref: ModerationTargetRef; label: string } | null>(null)

  useEffect(() => {
    setPost(null)
    setComments([])
    if (!target) return
    const unsubPost = onSnapshot(doc(db, "residences", target.residenceId, "posts", target.postId), (snap) => {
      const data = snap.data()
      if (!data) return setPost({ missing: true } as ContentPost & { missing: boolean })
      const dates = (data.dates as Record<string, { toDate?: () => Date }>) ?? {}
      const created = dates.creationDate ?? dates.timeStamp ?? (data.timeStamp as { toDate?: () => Date })
      setPost({
        id: snap.id,
        residenceId: target.residenceId,
        type: (data.type as string) ?? "",
        title: (data.title as string) ?? "",
        description: (data.description as string) ?? "",
        pathImage: (data.pathImage as string) ?? "",
        isVideo: data.isVideo === true,
        user: (data.user as string) ?? "",
        likes: Array.isArray(data.like) ? data.like.length : 0,
        creationDate: created?.toDate?.() ?? null,
        hidden: (data.moderation as { status?: string } | undefined)?.status === "hidden",
      })
    })
    const unsubComments = subscribeToPostComments(target.residenceId, target.postId, setComments, () => setComments([]))
    return () => {
      unsubPost()
      unsubComments()
    }
  }, [target])

  useEffect(() => {
    const uids = [post?.user, ...comments.flatMap((c) => [c.user, ...c.replies.map((r) => r.user)])].filter(
      (u): u is string => !!u
    )
    if (uids.length) resolveUserLabels(uids).then(setAuthors)
  }, [post?.user, comments])

  if (!target) return null
  const base = { residenceId: target.residenceId, postId: target.postId }

  function commentBlock(c: PostComment, parent?: PostComment) {
    const ref: ModerationTargetRef = parent ? { ...base, commentId: parent.docId, replyId: c.docId } : { ...base, commentId: c.docId }
    const label = parent ? "Réponse" : "Commentaire"
    return (
      <div
        key={c.docId}
        className={cn(
          "flex flex-col gap-1 rounded-[12px] border p-[10px_12px] text-sm",
          parent && "ml-6",
          target?.highlight === c.docId ? "border-amber-300 bg-amber-50/60" : "border-[oklch(93%_0.005_100)]"
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-semibold">{authors.get(c.user) ?? c.user}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{formatDate(c.timestamp)}</span>
            {c.hidden && <HiddenBadge />}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 text-destructive hover:text-destructive"
            onClick={() => setDeleting({ ref, label })}
          >
            <Trash2 />
            Supprimer
          </Button>
        </div>
        <p className="break-words whitespace-pre-wrap">{c.comment}</p>
      </div>
    )
  }

  return (
    <>
      <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-2xl">
          <div className="flex max-h-[calc(100vh-3rem)] min-w-0 flex-col gap-4">
            <DialogHeader className="border-b border-[oklch(95%_0.003_100)] pb-4">
              <span className="text-[11.5px] font-bold tracking-wide text-primary uppercase">
                {target.residenceName}
                {post && !post.missing ? ` · ${POST_TYPE_LABELS[post.type] ?? "Publication"}` : ""}
              </span>
              <DialogTitle>{post?.missing ? "Publication supprimée" : post?.title || "(sans titre)"}</DialogTitle>
              {post && !post.missing && (
                <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {authors.get(post.user) ?? post.user} · {formatDate(post.creationDate)}
                  <span className="flex items-center gap-1">
                    <Heart className="size-3" /> {post.likes}
                  </span>
                  {post.hidden && <HiddenBadge />}
                </p>
              )}
            </DialogHeader>
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden pr-4 pl-[5px]">
              {post?.missing ? (
                <p className="text-sm text-muted-foreground">Cette publication n'existe plus.</p>
              ) : post ? (
                <>
                  {post.description && <p className="text-sm break-words whitespace-pre-wrap">{post.description}</p>}
                  {post.pathImage &&
                    (post.isVideo ? (
                      <video src={post.pathImage} controls className="max-h-[50vh] w-full rounded-lg bg-black" />
                    ) : (
                      <img src={post.pathImage} alt="" className="max-h-[50vh] w-full rounded-lg object-contain" />
                    ))}
                  <Button
                    variant="outline"
                    className="w-fit text-destructive hover:text-destructive"
                    onClick={() => setDeleting({ ref: base, label: "Publication" })}
                  >
                    <Trash2 />
                    Supprimer la publication
                  </Button>
                  <div className="flex flex-col gap-2 border-t border-[oklch(95%_0.003_100)] pt-4">
                    <span className="text-sm font-bold">Commentaires ({comments.length})</span>
                    {comments.length === 0 && <p className="text-sm text-muted-foreground">Aucun commentaire.</p>}
                    {comments.map((c) => (
                      <div key={c.docId} className="flex flex-col gap-2">
                        {commentBlock(c)}
                        {c.replies.map((r) => commentBlock(r, c))}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Chargement…</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <DeleteContentDialog
        target={deleting?.ref ?? null}
        targetLabel={deleting?.label ?? ""}
        onOpenChange={(open) => !open && setDeleting(null)}
        onDeleted={() => {
          if (deleting && !("commentId" in deleting.ref && deleting.ref.commentId)) onClose()
        }}
      />
    </>
  )
}
