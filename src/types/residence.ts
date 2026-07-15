export type Address = {
  street: string
  complement?: string
  zipCode: string
  city: string
  codeQualite: string
}

export type GeranceRef = {
  geranceId: string
  serviceType: "serviceSyndic" | "geranceLocative"
  agentMail?: string
}

export type Residence = {
  id: string
  name: string
  address: Address
  mail_contact?: string
  csmembers?: string[]
  totalLot: number
  geranceRef?: GeranceRef
}

export const emptyAddress: Address = {
  street: "",
  complement: "",
  zipCode: "",
  city: "",
  codeQualite: "60",
}
