import { ImageOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSinistreMedia } from "@/hooks/useSinistreMedia"

export function SinistreMediaViewer({
  pathImage,
  className,
}: {
  pathImage: string
  className?: string
}) {
  const state = useSinistreMedia(pathImage)

  if (!pathImage || state.status === "error") {
    return (
      <div className={cn("flex items-center justify-center bg-muted text-muted-foreground", className)}>
        <ImageOff className="size-6" />
      </div>
    )
  }

  if (state.status === "loading") {
    return <div className={cn("animate-pulse bg-muted", className)} />
  }

  return state.isVideo ? (
    <video src={state.url} controls className={cn("bg-black object-contain", className)} />
  ) : (
    <img src={state.url} alt="" className={cn("object-cover", className)} />
  )
}
