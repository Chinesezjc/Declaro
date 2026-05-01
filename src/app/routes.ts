import type { PageNode, RuntimeUser } from "../dsl"
import { ChatAlignmentPage, StudentApplyPage, TeacherDashboardPage } from "../dslPages"

export type PageKey = "student" | "teacher" | "chat"

export type DslRoute = {
  key: PageKey
  path: string
  label: string
  page: PageNode
  user: RuntimeUser
}

export const dslRoutes = [
  {
    key: "teacher",
    path: "/teacher/dashboard",
    label: "教师后台",
    page: TeacherDashboardPage,
    user: { id: "teacher-001", role: "teacher", name: "教师用户" },
  },
  {
    key: "student",
    path: "/student/apply",
    label: "学生申请",
    page: StudentApplyPage,
    user: { id: "student-001", role: "student", name: "学生用户" },
  },
  {
    key: "chat",
    path: "/chat/alignment",
    label: "聊天对齐",
    page: ChatAlignmentPage,
    user: { id: "demo-001", role: "admin", name: "聊天对齐演示" },
  },
] as const satisfies readonly DslRoute[]

export function getDslRoute(key: PageKey): DslRoute {
  return dslRoutes.find((route) => route.key === key) ?? dslRoutes[0]
}

export function getDslRouteByPath(path: string): DslRoute | undefined {
  const normalizedPath = normalizePath(path)
  return dslRoutes.find((route) => normalizePath(route.path) === normalizedPath)
}

function normalizePath(path: string): string {
  const pathname = path.split(/[?#]/)[0] ?? "/"
  const normalized = pathname.replace(/\/+$/, "")
  return normalized || "/"
}
