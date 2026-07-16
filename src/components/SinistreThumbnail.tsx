import { useEffect, useState } from "react"
import { getDownloadURL, ref } from "firebase/storage"
import { ImageOff } from "lucide-react"
import { storage } from "@/firebase"
import { cn } from "@/lib/utils"

export function SinistreThumbnail({
  pathImage,
  className,
}: {
  pathImage: string
  className?: string
}) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!pathImage) return
    getDownloadURL(ref(storage, pathImage)).then(
      (resolved) => !cancelled && setUrl(resolved),
      () => {}
    )
    return () => {
      cancelled = true
    }
  }, [pathImage])

  if (!pathImage) {
    return (
      <div className={cn("flex items-center justify-center bg-muted text-muted-foreground", className)}>
        <ImageOff className="size-4" />
      </div>
    )
  }

  return url ? (
    <img src={url} alt="" className={cn("object-cover", className)} />
  ) : (
    <div className={cn("animate-pulse bg-muted", className)} />
  )
}
