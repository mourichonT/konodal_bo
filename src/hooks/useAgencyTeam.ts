import { useEffect, useState } from "react"
import { getAgencyTeam, type AgencyTeamMember } from "@/lib/gerances"

// Comptes de l'équipe (adresse, dernière connexion) lus par get_agency_team,
// relus quand la composition de l'équipe change. null tant que non chargé.
export function useAgencyTeam(geranceId: string | undefined, uids: string[]) {
  const [members, setMembers] = useState<Record<string, AgencyTeamMember> | null>(null)
  const key = [...uids].sort().join(",")

  useEffect(() => {
    if (!geranceId) return
    let cancelled = false
    getAgencyTeam(geranceId)
      .then((team) => {
        if (!cancelled) setMembers(team)
      })
      .catch(() => {
        if (!cancelled) setMembers({})
      })
    return () => {
      cancelled = true
    }
  }, [geranceId, key])

  return members
}
