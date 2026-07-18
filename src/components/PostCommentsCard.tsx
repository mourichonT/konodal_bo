import { useEffect, useState } from "react"
import { doc, getDoc } from "firebase/firestore"
import { toast } from "sonner"
import { Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { db } from "@/firebase"
import { useAuth } from "@/lib/auth-context"
import {
  addPostComment,
  addPostCommentReply,
  deletePostComment,
  subscribeToPostComments,
  type PostComment,
} from "@/lib/comments"

function CommentRow({
  comment,
  authorLabel,
  onReply,
  onDelete,
}: {
  comment: PostComment
  authorLabel: string
  onReply?: () => void
  onDelete?: () => void
}) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <div className="flex items-center gap-2">
        <span className="font-medium">{authorLabel}</span>
        <span className="text-xs text-muted-foreground">
          {comment.timestamp ? comment.timestamp.toLocaleString("fr-FR") : ""}
        </span>
      </div>
      <p>{comment.comment}</p>
      <div className="flex items-center gap-3">
        {onReply && (
          <button
            type="button"
            className="w-fit text-xs text-muted-foreground underline hover:text-foreground"
            onClick={onReply}
          >
            Répondre
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            className="w-fit text-xs text-destructive underline hover:text-destructive/80"
            onClick={onDelete}
          >
            Supprimer
          </button>
        )}
      </div>
    </div>
  )
}

export function PostCommentsCard({ residenceId, postId }: { residenceId: string; postId: string }) {
  const { user } = useAuth()
  const [comments, setComments] = useState<PostComment[]>([])
  const [authorNames, setAuthorNames] = useState<Record<string, string>>({})
  const [commentText, setCommentText] = useState("")
  const [replyingTo, setReplyingTo] = useState<{ docId: string; fieldId: string; label: string } | null>(
    null
  )
  const [submittingComment, setSubmittingComment] = useState(false)

  useEffect(() => {
    return subscribeToPostComments(
      residenceId,
      postId,
      setComments,
      (error) => toast.error("Impossible de charger les commentaires : " + error.message)
    )
  }, [residenceId, postId])

  useEffect(() => {
    const uids = new Set<string>()
    for (const c of comments) {
      uids.add(c.user)
      for (const r of c.replies) uids.add(r.user)
    }
    const missing = [...uids].filter((uid) => uid !== user?.uid && !(uid in authorNames))
    if (missing.length === 0) return
    missing.forEach((uid) => {
      getDoc(doc(db, "users", uid)).then((snap) => {
        if (!snap.exists()) return
        const data = snap.data()
        const userGroup = (data.user as Record<string, unknown>) ?? {}
        const name = [userGroup.surname, userGroup.name].filter(Boolean).join(" ")
        setAuthorNames((prev) => ({ ...prev, [uid]: name || uid }))
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comments, user?.uid])

  function authorLabel(uid: string) {
    if (uid === user?.uid) return "Vous"
    return authorNames[uid] ?? uid
  }

  async function handleSubmitComment() {
    if (!user || !commentText.trim()) return
    setSubmittingComment(true)
    try {
      if (replyingTo) {
        await addPostCommentReply(residenceId, postId, replyingTo, user.uid, commentText.trim())
      } else {
        await addPostComment(residenceId, postId, user.uid, commentText.trim())
      }
      setCommentText("")
      setReplyingTo(null)
    } catch (err) {
      toast.error("Échec de l'envoi du commentaire : " + (err as Error).message)
    } finally {
      setSubmittingComment(false)
    }
  }

  async function handleDeleteComment(segments: string[]) {
    try {
      await deletePostComment(residenceId, postId, segments)
    } catch (err) {
      toast.error("Échec de la suppression du commentaire : " + (err as Error).message)
    }
  }

  return (
    <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
      <CardHeader>
        <CardTitle className="text-base">Commentaires</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-[40px]">
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun commentaire.</p>
        ) : (
          <div className="flex flex-col gap-[20px]">
            {comments.map((c) => (
              <div key={c.docId} className="flex flex-col gap-2">
                <CommentRow
                  comment={c}
                  authorLabel={authorLabel(c.user)}
                  onReply={() =>
                    setReplyingTo({ docId: c.docId, fieldId: c.fieldId, label: authorLabel(c.user) })
                  }
                  onDelete={
                    c.user === user?.uid ? () => handleDeleteComment(["comments", c.docId]) : undefined
                  }
                />
                {c.replies.length > 0 && (
                  <div className="flex flex-col gap-2 border-l pl-4">
                    {c.replies.map((r) => (
                      <CommentRow
                        key={r.docId}
                        comment={r}
                        authorLabel={authorLabel(r.user)}
                        onDelete={
                          r.user === user?.uid
                            ? () => handleDeleteComment(["comments", c.docId, "replies", r.docId])
                            : undefined
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2">
          {replyingTo && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Réponse à {replyingTo.label}</span>
              <button
                type="button"
                className="underline hover:text-foreground"
                onClick={() => setReplyingTo(null)}
              >
                Annuler
              </button>
            </div>
          )}
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Ajouter un commentaire..."
            rows={2}
            className="w-full min-w-0 resize-none rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <div className="flex justify-end">
            <Button size="sm" disabled={!commentText.trim() || submittingComment} onClick={handleSubmitComment}>
              <Send />
              Envoyer
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
