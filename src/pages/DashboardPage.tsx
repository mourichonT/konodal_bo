import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Building2, Users, TriangleAlert, ArrowRight } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { subscribeToResidences } from "@/lib/residences"

type Stat = {
  label: string
  to: string
  icon: typeof Building2
  value: number | null
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [residencesCount, setResidencesCount] = useState<number | null>(null)

  useEffect(() => {
    return subscribeToResidences(
      (data) => setResidencesCount(data.length),
      () => setResidencesCount(null)
    )
  }, [])

  const stats: Stat[] = [
    { label: "Résidences", to: "/residences", icon: Building2, value: residencesCount },
    { label: "Utilisateurs", to: "/residents", icon: Users, value: null },
    { label: "Sinistres", to: "/sinistres", icon: TriangleAlert, value: null },
  ]

  const displayName = user?.displayName?.split(" ")[0] || user?.email?.split("@")[0]

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Bonjour{displayName ? `, ${displayName}` : ""}</h1>
        <p className="text-muted-foreground">Voici un aperçu de votre backoffice.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map(({ label, to, icon: Icon, value }) => (
          <Link key={to} to={to} className="group">
            <Card className="transition-shadow group-hover:shadow-md">
              <CardContent className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  {value !== null ? (
                    <span className="text-3xl font-semibold tabular-nums">{value}</span>
                  ) : (
                    <Badge variant="secondary">Bientôt disponible</Badge>
                  )}
                </div>
                <div className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Icon className="size-5" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <h3 className="text-sm font-medium">Accès rapide</h3>
          <div className="flex flex-col divide-y divide-border">
            {navQuickLinks.map(({ to, label, description }) => (
              <Link
                key={to}
                to={to}
                className="group flex items-center justify-between py-3 first:pt-0 last:pb-0"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{label}</span>
                  <span className="text-sm text-muted-foreground">{description}</span>
                </div>
                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

const navQuickLinks = [
  { to: "/residences", label: "Résidences", description: "Gérer les résidences et leurs lots" },
  { to: "/residents", label: "Utilisateurs", description: "Gérer les comptes résidents et bailleurs" },
  { to: "/sinistres", label: "Sinistres", description: "Suivre les déclarations de sinistres" },
]
