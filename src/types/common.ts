export type Role = "student" | "teacher" | "admin"

export type SlotName = string

export type RuntimeUser = {
  id: string
  role: Role
  name?: string
}
