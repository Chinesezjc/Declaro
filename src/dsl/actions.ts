import type { Action } from "./core"

export const exportGroups: Action = async (ctx) => {
  await ctx.request.get("/api/groups/export")
  ctx.toast("已开始导出分组结果")
}

export const approveApplication: Action = async (ctx) => {
  const applicationId = ctx.row?.id

  if (!applicationId) {
    ctx.toast("缺少申请 ID")
    return
  }

  await ctx.request.post("/api/applications/approve", {
    applicationId,
  })

  ctx.toast("已同意申请")
  ctx.refresh()
}
