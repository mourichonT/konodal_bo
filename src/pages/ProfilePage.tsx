import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Briefcase, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/lib/auth-context"
import { useAccountRole } from "@/hooks/useAccountRole"
import { subscribeToUser, updateOwnProfile } from "@/lib/users"
import { subscribeToGerance } from "@/lib/gerances"
import { serviceTypeLabels, type Gerance, type ServiceType } from "@/types/gerance"
import type { KonodalUser } from "@/types/user"

const serviceTypes: ServiceType[] = ["serviceSyndic", "geranceLocative"]

// Profil du compte BO connecté (tous rôles - superAdmin/agence/agent) :
// nom/prénom/téléphone, auto-édité par l'intéressé (accessible depuis le
// CTA compte en bas de la sidebar) - distinct de la fiche résident
// (ResidentDetailPage), qui est gérée PAR un admin sur le compte de
// quelqu'un d'autre. Pour un compte agence/agent, une seconde carte
// rappelle l'agence de rattachement (déjà consultable en détail sur sa
// propre page, cf. AgencesPage/OwnAgencyPage - juste un rappel ici).
export default function ProfilePage() {
  const { user: authUser } = useAuth()
  const { isAgence, isAgent, geranceId } = useAccountRole()
  const [profile, setProfile] = useState<KonodalUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [gerance, setGerance] = useState<Gerance | null>(null)

  useEffect(() => {
    if (!authUser) return
    setLoading(true)
    return subscribeToUser(
      authUser.uid,
      (data) => {
        setProfile(data)
        setLoading(false)
      },
      (error) => {
        toast.error("Impossible de charger le profil : " + error.message)
        setLoading(false)
      }
    )
  }, [authUser])

  useEffect(() => {
    if (!(isAgence || isAgent) || !geranceId) {
      setGerance(null)
      return
    }
    return subscribeToGerance(geranceId, setGerance, (error) =>
      toast.error("Impossible de charger l'agence : " + error.message)
    )
  }, [isAgence, isAgent, geranceId])

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Mon profil</h1>

      {loading ? (
        <p className="text-muted-foreground">Chargement…</p>
      ) : (
        profile && <ProfileForm profile={profile} />
      )}

      {(isAgence || isAgent) && (
        <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
          <CardHeader>
            <CardTitle className="text-base">Agence rattachée</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Briefcase className="size-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-medium">{gerance?.name ?? "…"}</span>
                {gerance && (
                  <span className="text-sm text-muted-foreground">
                    {[gerance.address.street, [gerance.address.zipCode, gerance.address.city].join(" ")]
                      .filter(Boolean)
                      .join(" — ") || "—"}
                  </span>
                )}
              </div>
            </div>

            {gerance && (
              <div className="flex flex-wrap gap-1 border-t pt-4">
                {serviceTypes
                  .filter((type) => gerance.services[type])
                  .map((type) => (
                    <Badge key={type} variant="secondary">
                      {serviceTypeLabels[type]}
                    </Badge>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ProfileForm({ profile }: { profile: KonodalUser }) {
  const [name, setName] = useState(profile.name)
  const [surname, setSurname] = useState(profile.surname)
  const [phone, setPhone] = useState(profile.phone)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(profile.name)
    setSurname(profile.surname)
    setPhone(profile.phone)
  }, [profile.uid])

  async function handleSave() {
    setSaving(true)
    try {
      await updateOwnProfile(profile.uid, { name, surname, phone })
      toast.success("Profil mis à jour")
    } catch (err) {
      toast.error("Échec de l'enregistrement : " + (err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
      <CardHeader>
        <CardTitle className="text-base">Informations</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="profile-email">Email</Label>
            <Input id="profile-email" value={profile.email} disabled />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="profile-phone">Téléphone</Label>
            <Input id="profile-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="profile-name">Prénom</Label>
            <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="profile-surname">Nom</Label>
            <Input id="profile-surname" value={surname} onChange={(e) => setSurname(e.target.value)} />
          </div>
        </div>

        <Button className="w-fit" onClick={handleSave} disabled={saving}>
          <Save />
          Enregistrer
        </Button>
      </CardContent>
    </Card>
  )
}
