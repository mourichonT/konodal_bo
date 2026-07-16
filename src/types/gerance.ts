import type { Address } from "@/types/residence"

export type Agent = {
  name_agent: string
  surname_agent: string
  mail?: string
  phone?: string
}

export type AgencyDept = {
  mail: string
  phone: string
  agents: Agent[]
}

export type ServiceType = "serviceSyndic" | "geranceLocative"

export const serviceTypeLabels: Record<ServiceType, string> = {
  serviceSyndic: "Syndic",
  geranceLocative: "Gérance locative",
}

export type Gerance = {
  id: string
  name: string
  address: Address
  services: Partial<Record<ServiceType, AgencyDept>>
}

export const emptyAgencyDept: AgencyDept = {
  mail: "",
  phone: "",
  agents: [],
}
