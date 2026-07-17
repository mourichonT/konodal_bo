import { useEffect, useState } from "react"
import { getDownloadURL, getMetadata, ref } from "firebase/storage"
import { storage } from "@/firebase"

export type SinistreMediaState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; url: string; isVideo: boolean }

// Le champ `isVideo` côté Firestore peut être faux (bug historique de
// certains flux de mise à jour qui l'écrasent) - on se fie plutôt au
// contentType réel du fichier dans Storage, fixé une fois pour toutes à
// l'upload.
export function useSinistreMedia(pathImage: string): SinistreMediaState {
  const [state, setState] = useState<SinistreMediaState>({ status: "loading" })

  useEffect(() => {
    let cancelled = false
    if (!pathImage) return
    setState({ status: "loading" })
    const fileRef = ref(storage, pathImage)
    getMetadata(fileRef).then(
      (metadata) => {
        if (cancelled) return
        const isVideo = metadata.contentType?.startsWith("video/") ?? false
        getDownloadURL(fileRef).then(
          (url) => !cancelled && setState({ status: "ready", url, isVideo }),
          () => !cancelled && setState({ status: "error" })
        )
      },
      () => !cancelled && setState({ status: "error" })
    )
    return () => {
      cancelled = true
    }
  }, [pathImage])

  return state
}
