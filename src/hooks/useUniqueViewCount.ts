import { useEffect, useState } from "react"
import { collection, onSnapshot } from "firebase/firestore"
import { db } from "@/firebase"

// Vues uniques d'un post : sous-collection residences/{id}/posts/{id}/vues,
// 1 doc par uid (posé côté app à l'ouverture, cf. CommunicationDetails +
// IPostRepository.recordPostView) - le nombre de docs est donc déjà déduplié
// par utilisateur, même pattern que useSignalementCount.
export function useUniqueViewCount(residenceId: string, postId: string): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    return onSnapshot(
      collection(db, "residences", residenceId, "posts", postId, "vues"),
      (snapshot) => setCount(snapshot.size)
    )
  }, [residenceId, postId])

  return count
}
