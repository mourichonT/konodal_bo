import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { Briefcase, Building2, Mail, Phone, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/lib/auth-context"
import { useAccountRole } from "@/hooks/useAccountRole"
import { subscribeToUser, updateOwnProfile, uploadOwnProfilePic } from "@/lib/users"
import { subscribeToGerance } from "@/lib/gerances"
import { subscribeToResidencesForGerance } from "@/lib/residences"
import { departmentCodeFromZip, departmentLabel, groupResidencesByDepartment } from "@/lib/departments"
import { serviceTypeLabels, type Gerance, type ServiceType } from "@/types/gerance"
import type { Residence } from "@/types/residence"
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
  const [managedResidences, setManagedResidences] = useState<Residence[]>([])

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

  useEffect(() => {
    if (!(isAgence || isAgent) || !geranceId) {
      setManagedResidences([])
      return
    }
    return subscribeToResidencesForGerance(geranceId, setManagedResidences, (error) =>
      toast.error("Impossible de charger les résidences : " + error.message)
    )
  }, [isAgence, isAgent, geranceId])

  // Répartition des résidences gérées par département (dérivé du code
  // postal, cf. lib/departments.ts déjà utilisé pour le ciblage des
  // campagnes pub) - une gérance opère souvent sur plusieurs départements
  // autour de son siège, plus parlant qu'un simple total.
  const residencesByDepartment = useMemo(
    () => groupResidencesByDepartment(managedResidences),
    [managedResidences]
  )

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
              <div className="flex flex-col gap-0.5">
                <span className="flex items-center gap-2 text-lg font-medium">
                  {gerance?.name ?? "…"}
                  {gerance?.address.zipCode && (
                    <Badge variant="outline">
                      {departmentLabel(departmentCodeFromZip(gerance.address.zipCode))}
                    </Badge>
                  )}
                </span>
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
              <div className="flex flex-col gap-3 border-t pt-4">
                {serviceTypes
                  .filter((type) => gerance.services[type])
                  .map((type) => {
                    const dept = gerance.services[type]
                    if (!dept) return null
                    return (
                      <div key={type} className="flex flex-col gap-1">
                        <Badge variant="secondary" className="w-fit">
                          {serviceTypeLabels[type]}
                        </Badge>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          {dept.mail && (
                            <span className="flex items-center gap-1.5">
                              <Mail className="size-3.5" />
                              {dept.mail}
                            </span>
                          )}
                          {dept.phone && (
                            <span className="flex items-center gap-1.5">
                              <Phone className="size-3.5" />
                              {dept.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}

            {/* Indicateur "intelligent" : plutôt qu'un simple total, la
                répartition par département donne une vraie idée du
                périmètre géographique réellement couvert par cette
                gérance - directement dérivé de subscribeToResidencesForGerance,
                le même mécanisme qui scope déjà tout le BO pour ce compte. */}
            <div className="flex flex-col gap-2 border-t pt-4">
              <Link
                to="/residences"
                className="flex items-center gap-2 text-sm font-medium hover:underline"
              >
                <Building2 className="size-4 text-muted-foreground" />
                {managedResidences.length} résidence{managedResidences.length > 1 ? "s" : ""} gérée
                {managedResidences.length > 1 ? "s" : ""}
              </Link>
              {residencesByDepartment.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {residencesByDepartment.map(([code, group]) => (
                    <Badge key={code} variant="outline" className="border-transparent bg-sky-100 text-sky-800">
                      {departmentLabel(code)} · {group.length}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function initials(name: string, surname: string, email: string): string {
  const fromNames = `${name[0] ?? ""}${surname[0] ?? ""}`.toUpperCase()
  return fromNames || (email[0] ?? "?").toUpperCase()
}

function ProfileForm({ profile }: { profile: KonodalUser }) {
  const [name, setName] = useState(profile.name)
  const [surname, setSurname] = useState(profile.surname)
  const [phone, setPhone] = useState(profile.phone)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(profile.name)
    setSurname(profile.surname)
    setPhone(profile.phone)
    setPhotoFile(null)
  }, [profile.uid])

  async function handleSave() {
    setSaving(true)
    try {
      if (photoFile) {
        await uploadOwnProfilePic(profile.uid, photoFile)
        setPhotoFile(null)
      }
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
        <div className="flex items-center gap-4">
          <label
            htmlFor="profile-pic"
            className="group relative flex size-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-accent text-accent-foreground"
          >
            {photoFile ? (
              <img src={URL.createObjectURL(photoFile)} alt="" className="size-full object-cover" />
            ) : profile.profilePic ? (
              <img src={profile.profilePic} alt="" className="size-full object-cover" />
            ) : (
              <span className="text-lg font-semibold">{initials(name, surname, profile.email)}</span>
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100">
              Changer
            </span>
          </label>
          <input
            id="profile-pic"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
          />
          <div className="flex flex-col">
            <span className="text-sm font-medium">Photo de profil</span>
            <span className="text-xs text-muted-foreground">Cliquez sur l'avatar pour la changer.</span>
          </div>
        </div>

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
