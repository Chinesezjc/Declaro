import type { Request, Response } from "express"

// ===== In-memory data stores =====
interface StudentRow {
  id: string
  name: string
  skills: string
  groupName: string
  status: string
}

interface ApplicationRow {
  id: string
  studentName: string
  groupName: string
  reason: string
}

const students: StudentRow[] = [
  { id: "stu-1", name: "李明", skills: "React, UI 设计", groupName: "Group A", status: "已组队" },
  { id: "stu-2", name: "王雨", skills: "Node.js, 后端", groupName: "Group B", status: "已组队" },
  { id: "stu-3", name: "陈晨", skills: "算法, 可视化", groupName: "待分配", status: "组队中" },
]

const applications: ApplicationRow[] = [
  { id: "app-1", studentName: "赵青", groupName: "Group A", reason: "对前端开发感兴趣" },
  { id: "app-2", studentName: "周岚", groupName: "Group B", reason: "有后端经验" },
]

// ===== Data API handlers =====
export function handleGetStudents(_req: Request, res: Response): void {
  res.json(students)
}

export function handleGetApplications(_req: Request, res: Response): void {
  res.json(applications)
}

export function handleApproveApplication(req: Request, res: Response): void {
  const { applicationId } = req.body as Record<string, unknown>
  const app = applications.find((a) => a.id === applicationId)
  if (app) {
    if (!students.some((s) => s.id === `stu-${app.id}`)) {
      students.push({
        id: `stu-${app.id}`,
        name: app.studentName,
        skills: "待填写",
        groupName: app.groupName,
        status: "已组队",
      })
    }
    const idx = applications.findIndex((a) => a.id === applicationId)
    if (idx >= 0) applications.splice(idx, 1)
  }
  res.json({ ok: true })
}

export function handleRejectApplication(req: Request, res: Response): void {
  const { applicationId } = req.body as Record<string, unknown>
  const idx = applications.findIndex((a) => a.id === applicationId)
  if (idx >= 0) applications.splice(idx, 1)
  res.json({ ok: true })
}

export function handleSubmitApplication(req: Request, res: Response): void {
  const body = req.body as Record<string, unknown>
  const newApp: ApplicationRow = {
    id: `app-${Date.now()}`,
    studentName: String(body.name ?? "未命名"),
    groupName: "待分配",
    reason: String(body.reason ?? ""),
  }
  applications.push(newApp)
  res.json({ ok: true, message: "申请已提交" })
}

export function handleExportGroups(_req: Request, res: Response): void {
  res.json({ ok: true, message: "导出成功" })
}

// Generic form handler
export function handleFormSubmit(req: Request, res: Response): void {
  const formId = req.params.formId
  const values = req.body as Record<string, unknown>
  console.log(`Form submitted: ${formId}`, values)
  res.json({ ok: true, message: "已提交" })
}
