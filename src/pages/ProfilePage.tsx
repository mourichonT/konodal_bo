import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/lib/auth-context"
import { subscribeToUser, updateOwnProfile } from "@/lib/users"
import { emptyAddress } from "@/types/residence"
import type { KonodalUser } from "@/types/user"

// Profil du compte BO connecté (tous rôles - superAdmin/agence/agent) :
// nom/prénom/téléphone/adresse, auto-édité par l'intéressé (accessible
// depuis le CTA compte en bas de la sidebar) - distinct de la fiche
// résident (ResidentDetailPage), qui est gérée PAR un admin sur le compte
// de quelqu'un d'autre.
export default function ProfilePage() {
  const { user: authUser } = useAuth()
  const [profile, setProfile] = useState<KonodalUser | null>(null)
  const [loading, setLoading] = useState(true)

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

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Mon profil</h1>

      {loading ? (
        <p className="text-muted-foreground">Chargement…</p>
      ) : (
        profile && <ProfileForm profile={profile} />
      )}
    </div>
  )
}

function ProfileForm({ profile }: { profile: KonodalUser }) {
  const [name, setName] = useState(profile.name)
  const [surname, setSurname] = useState(profile.surname)
  const [phone, setPhone] = useState(profile.phone)
  const [street, setStreet] = useState(profile.address?.street ?? emptyAddress.street)
  const [zipCode, setZipCode] = useState(profile.address?.zipCode ?? emptyAddress.zipCode)
  const [city, setCity] = useState(profile.address?.city ?? emptyAddress.city)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(profile.name)
    setSurname(profile.surname)
    setPhone(profile.phone)
    setStreet(profile.address?.street ?? emptyAddress.street)
    setZipCode(profile.address?.zipCode ?? emptyAddress.zipCode)
    setCity(profile.address?.city ?? emptyAddress.city)
  }, [profile.uid])

  async function handleSave() {
    setSaving(true)
    try {
      await updateOwnProfile(profile.uid, {
        name,
        surname,
        phone,
        address: { ...emptyAddress, street, zipCode, city },
      })
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
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="profile-street">Adresse</Label>
            <Input id="profile-street" value={street} onChange={(e) => setStreet(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="profile-zip">Code postal</Label>
            <Input id="profile-zip" value={zipCode} onChange={(e) => setZipCode(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="profile-city">Ville</Label>
            <Input id="profile-city" value={city} onChange={(e) => setCity(e.target.value)} />
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
