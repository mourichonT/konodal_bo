import { Navigate, useLocation } from "react-router-dom"
import { PageHeader } from "@/components/PageHeader"
import { KeepAliveViews } from "@/components/KeepAliveViews"
import { ContentsSectionToggle } from "@/components/ContentsSectionToggle"
import ContentPostsPage from "@/pages/ContentPostsPage"
import ModerationPage from "@/pages/ModerationPage"

type ContentsView = "posts" | "moderation"

// Contenus (superAdmin, route protégée dans App.tsx) : Posts et Modération.
// En-tête commun qui reste en place à la bascule, et vues gardées montées
// (KeepAliveViews) : rien n'est reconstruit.
export default function ContentsLayout() {
  const { pathname } = useLocation()
  const view: ContentsView | null = pathname.startsWith("/contenus/posts")
    ? "posts"
    : pathname.startsWith("/contenus/moderation")
      ? "moderation"
      : null

  if (!view) return <Navigate to="/contenus/posts" replace />

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Contenus" toggle={<ContentsSectionToggle current={view} />} />
      <KeepAliveViews active={view} views={{ posts: <ContentPostsPage />, moderation: <ModerationPage /> }} />
    </div>
  )
}
