import { useEffect, useState } from "react"
import { collection, onSnapshot } from "firebase/firestore"
import { db } from "@/firebase"

export type CommentStats = {
  count: number
  uniqueUserCount: number
}

// Nombre de commentaires de premier niveau d'un post et de déclarants uniques
// (ne compte pas les réponses imbriquées - juste un indicateur rapide pour
// les vues liste/kanban, le détail complet avec réponses reste sur la fiche
// sinistre).
export function useCommentStats(residenceId: string, postId: string): CommentStats {
  const [stats, setStats] = useState<CommentStats>({ count: 0, uniqueUserCount: 0 })

  useEffect(() => {
    return onSnapshot(
      collection(db, "residences", residenceId, "posts", postId, "comments"),
      (snapshot) => {
        const users = new Set<string>()
        snapshot.docs.forEach((d) => {
          const user = d.data().user as string | undefined
          if (user) users.add(user)
        })
        setStats({ count: snapshot.size, uniqueUserCount: users.size })
      }
    )
  }, [residenceId, postId])

  return stats
}
