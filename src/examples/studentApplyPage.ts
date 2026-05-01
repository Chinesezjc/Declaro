import { Button, Card, Env, Form, Input, Page, Select, Slider, Text, TextArea } from "../dsl"

export const StudentApplyPage = Page({
  title: "学生组队申请",
  role: "student",
  env: Env({
    id: "student-page-env",
    layout: "default",
    slots: ["header", "main", "footer", "modal"],
  }),
  children: [
    Text({
      text: "申请加入小组",
      variant: "title",
      slot: "header",
    }),

    Card({
      title: "填写申请信息",
      slot: "main",
      collapsible: true,
      body: [
        Form({
          id: "apply-form",
          onSignal: (ctx) => {
            if (ctx.signal?.type !== "slider-change") {
              return
            }

            const threshold = Number(ctx.signal.payload?.notifyThreshold ?? 30)
            const toastKey = String(ctx.signal.payload?.toastKey ?? "weekly-hours-enough")
            const sourceId = ctx.signal.sourceId
            const nextValue = typeof ctx.signal.value === "number" ? ctx.signal.value : 0

            if (sourceId === "weeklyHours" || sourceId === "restHours") {
              const otherField = sourceId === "weeklyHours" ? "restHours" : "weeklyHours"
              const otherValue = Number(ctx.form?.values[otherField] ?? 0)
              const totalHours = nextValue + otherValue

              if (totalHours > 168) {
                const nextOtherValue = Math.max(0, 168 - nextValue)
                ctx.form?.setValue?.(otherField, nextOtherValue)
                ctx.toast("已自动调整另一项，保证总时长不超过 168 小时", {
                  animation: "fade-up",
                  duration: 1400,
                  key: "weekly-total-hours-limit",
                  variant: "warning",
                })
              }
            }

            if (
              sourceId === "weeklyHours" &&
              typeof ctx.signal.value === "number" &&
              nextValue >= threshold
            ) {
              ctx.toast("投入时间很充足", {
                animation: "fade-up",
                duration: 1200,
                key: toastKey,
                variant: "success",
              })
            }
          },
          fields: [
            Input({
              name: "name",
              label: "姓名",
              required: true,
            }),

            Select({
              name: "role",
              label: "希望承担的角色",
              required: true,
              options: [
                { label: "前端", value: "frontend" },
                { label: "后端", value: "backend" },
                { label: "算法", value: "algorithm" },
                { label: "报告", value: "report" },
              ],
            }),

            Slider({
              id: "weeklyHours",
              name: "weeklyHours",
              label: "工作时间（小时/周）",
              min: 0,
              max: 168,
              step: 1,
              valueType: "int",
              defaultValue: 40,
              input: true,
              meta: {
                notifyThreshold: 30,
                toastKey: "weekly-hours-enough",
              },
              onChange: (ctx) => {
                return ctx.emitSignal({
                  type: "slider-change",
                  value: ctx.value,
                  payload: ctx.componentMeta,
                })
              },
            }),

            Slider({
              id: "restHours",
              name: "restHours",
              label: "休息时间（小时/周）",
              min: 0,
              max: 168,
              step: 1,
              valueType: "int",
              defaultValue: 80,
              input: true,
              onChange: (ctx) => {
                return ctx.emitSignal({
                  type: "slider-change",
                  value: ctx.value,
                  payload: ctx.componentMeta,
                })
              },
            }),

            TextArea({
              name: "reason",
              label: "申请理由",
              rows: 4,
            }),

            Slider({
              id: "matchWeight",
              name: "matchWeight",
              label: "匹配偏好权重",
              min: 0,
              max: 1,
              valueType: "float",
              granularity: [
                { from: 0, to: 0.5, step: 0.05 },
                { from: 0.6, to: 1, step: 0.2 },
              ],
              defaultValue: 0.6,
              input: {
                step: 0.01,
              },
              snapInput: false,
              onChange: (ctx) => {
                return ctx.emitSignal({
                  type: "slider-change",
                  value: ctx.value,
                  payload: ctx.componentMeta,
                })
              },
            }),

            Slider({
              id: "experienceLevel",
              name: "experienceLevel",
              label: "项目经验等级",
              valueType: "enum",
              defaultValue: "familiar",
              input: true,
              options: [
                { label: "新手", value: "beginner" },
                { label: "了解", value: "familiar" },
                { label: "熟练", value: "skilled" },
                { label: "专家", value: "expert" },
              ],
              onChange: (ctx) => {
                return ctx.emitSignal({
                  type: "slider-change",
                  value: ctx.value,
                  payload: ctx.componentMeta,
                })
              },
            }),
          ],
          submitButton: Button({
            text: "提交申请",
            variant: "primary",
            onClick: async (ctx) => {
              await ctx.request.post("/api/applications", ctx.form?.values)
              ctx.toast("申请已提交")
              ctx.refresh()
            },
          }),
        }),
      ],
    }),
  ],
})
