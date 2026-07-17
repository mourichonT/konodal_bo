import { useEffect, useState } from "react"
import { collection, onSnapshot } from "firebase/firestore"
import { db } from "@/firebase"

// Nombre de déclarations associées (doublons) à un sinistre - même
// sous-collection que la fiche détail (subscribeToSinistreSignalements),
// juste le compteur pour les vues liste/kanban.
export function useSignalementCount(residenceId: string, postId: string): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    return onSnapshot(
      collection(db, "residences", residenceId, "posts", postId, "signalements"),
      (snapshot) => setCount(snapshot.size)
    )
  }, [residenceId, postId])

  return count
}
