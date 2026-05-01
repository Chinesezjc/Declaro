import { approveApplication, Box, Button, Column, Env, exportGroups, Page, Table, Text } from "../dsl"

export const DashboardEnv = Env({
  id: "teacher-dashboard-env",
  layout: "dashboard",
  slots: ["header", "sidebar", "toolbar", "main", "footer", "modal"],
})

export const TeacherDashboardPage = Page({
  title: "教师管理后台",
  role: "teacher",
  env: DashboardEnv,
  children: [
    Text({
      text: "组队管理",
      variant: "title",
      slot: "header",
      titleActions: [
        Button({
          text: "导出分组结果",
          variant: "primary",
          onClick: exportGroups,
        }),
      ],
    }),

    Box({
      title: "组队数据",
      slot: "main",
      collapsible: true,
      childrenAlignX: "stretch",
      childrenAlignY: "top",
      childrenSizeX: "fill",
      children: [
        Table({
          title: "学生列表",
          dataSource: "/api/students",
          defaultSort: { key: "name" },
          columns: [
            Column("name", "姓名", { sortable: true }),
            Column("skills", "技能", { sortable: true }),
            Column("groupName", "当前小组", { sortable: true }),
            Column("status", "状态", { sortable: true }),
          ],
        }),

        Table({
          title: "入组申请",
          order: 2,
          dataSource: "/api/applications",
          columns: [
            Column("studentName", "学生姓名", { sortable: true }),
            Column("groupName", "申请小组", { sortable: true }),
            Column("reason", "申请理由"),
          ],
          rowActions: [
            Button({
              text: "同意",
              variant: "primary",
              onClick: approveApplication,
            }),
            Button({
              text: "拒绝",
              variant: "danger",
              onClick: async (ctx) => {
                const applicationId = ctx.row?.id

                if (!applicationId) {
                  ctx.toast("缺少申请 ID")
                  return
                }

                await ctx.request.post("/api/applications/reject", {
                  applicationId,
                })

                ctx.toast("已拒绝申请")
                ctx.refresh()
              },
            }),
          ],
        }),
      ],
    }),
  ],
})
