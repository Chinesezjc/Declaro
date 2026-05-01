# HCI UI DSL

一个基于 TypeScript 的嵌入式 UI DSL。项目成员可以用函数调用和对象定义页面结构、布局区域、组件属性、事件行为和数据源，不需要直接写 React 组件。

当前版本已经带有一个最小 React renderer，可以在浏览器中渲染示例页面，并支持按钮事件、表格数据请求、表单值、行操作、动态列表、Slider、通知、权限、折叠、滚动和中间表示 IR。

## 快速开始

安装依赖：

```bash
npm install
```

启动 Vite 开发服务：

```bash
npm run dev
```

默认访问：

```txt
http://localhost:5173/teacher/dashboard
http://localhost:5173/student/apply
http://localhost:5173/chat/alignment
```

类型检查和生产构建：

```bash
npm run typecheck
npm run build
```

## 目录结构

```txt
src/
  app/                demo shell、Vite 路由注册、mock runtime 数据
  dsl/                  DSL 类型、构造函数、校验和 IR 工具
    components/         Button、Text、Form、Table、Box 等组件定义
  dslPages/             正式 DSL 页面入口
  renderer/react/       React 渲染器
  examples/             示例/教学页面
  types/                通用类型
  App.tsx               Vite SPA 路由入口
```

常用入口：

- `src/dsl/index.ts`：写页面时主要从这里导入 DSL API。
- `src/dslPages/`：**正式生产环境的 DSL 页面入口**，所有业务页面应放这里。
  - 这些页面与 `src/examples/` 完全独立，确保生产环境不受演示更新影响。
  - 生产页面从 `src/dslPages/index.ts` 导出。
- `src/examples/`：**只放示例、教学和能力演示页面**，不应被生产环境导入。
  - 演示页面仅用于教学和展示能力。
  - 修改示例不会影响生产环境。
- `src/app/routes.ts`：注册 URL、导航名称、DSL 页面和演示用户。
  - 生产应用应导入 `src/dslPages/` 中的页面。
- `src/app/DslDemoShell.tsx`：当前 demo 的页面壳、mock API、通知和 IR 展示。
- `src/App.tsx`：Vite 轻量路由入口，使用 History API 渲染不同 DSL 页面。

当前载体是 Vite，但 DSL、IR、renderer、runtime 是相对独立的；后续可以把载体换成 Next.js、其他 React 应用壳，或服务端 HTML 输出。

## 基本写法

页面通过 `Page` 定义，布局环境通过 `Env` 定义，组件通过 `Text`、`Button`、`Form`、`Table`、`Card`、`Box` 等函数创建。

```ts
import { Button, Column, Env, Page, Table, Text } from "../dsl"
import { exportGroups } from "../dsl/actions"

export const TeacherDashboardPage = Page({
  title: "教师管理后台",
  role: "teacher",
  env: Env({
    id: "teacher-dashboard-env",
    layout: "dashboard",
    slots: ["header", "sidebar", "toolbar", "main", "footer", "modal"],
  }),
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

    Table({
      title: "学生列表",
      slot: "main",
      dataSource: "/api/students",
      columns: [
        Column("name", "姓名", { sortable: true }),
        Column("skills", "技能"),
        Column("groupName", "当前小组", { sortable: true }),
      ],
    }),
  ],
})
```

## 新增页面流程

1. 在 `src/dslPages/` 下新建页面文件，例如 `myPage.ts`。
2. 从 `../dsl` 导入需要的构造函数。
3. 导出一个 `Page(...)` 结果。
4. 在 `src/dslPages/index.ts` 中导出新页面。
5. 在 `src/app/routes.ts` 注册 `path`、`label`、`page` 和演示用户。
6. Vite 会自动根据 `src/app/routes.ts` 里的 `path` 渲染对应页面。

最小模板：

```ts
import { Env, Page, Text } from "../dsl"

export const MyPage = Page({
  title: "我的页面",
  env: Env({
    id: "my-page-env",
    layout: "default",
    slots: ["header", "main", "footer", "modal"],
  }),
  children: [
    Text({
      text: "Hello DSL",
      variant: "title",
      slot: "header",
    }),
  ],
})
```

## Page 和 Env

`Env` 描述页面布局和可用 slot：

```ts
Env({
  id: "student-page-env",
  layout: "default",
  slots: ["header", "main", "footer", "modal"],
})
```

支持的布局：

- `default`：按 slot 顺序线性渲染。
- `dashboard`：适合后台页面，内置 header/sidebar/toolbar/main/footer/modal 结构。
- `form`：适合表单页。
- `split`：主区域和侧边区域。
- `custom`：当前会按默认线性布局渲染，后续可以扩展。

`Page` 会做这些事：

- 校验组件声明的 `slot` 必须存在于 `env.slots`。
- 递归校验 `Box`、`Card`、`Form`、`Modal` 内部组件的 slot。
- 按 `order` 排序。
- 没写 `id` 时根据 `title` 自动生成页面 id。
- `role` 可以控制页面访问权限。

## 组件通用属性

所有组件都支持这些基础字段：

```ts
{
  id?: string
  slot?: string
  order?: number
  visible?: boolean
  roles?: Array<"student" | "teacher" | "admin">
  meta?: Record<string, unknown>
  alignX?: "left" | "center" | "right" | "stretch"
  alignY?: "top" | "center" | "bottom" | "stretch"
  sizeX?: "hug" | "fill"
  sizeY?: "hug" | "fill"
}
```

说明：

- `slot` 决定组件挂载到页面哪个区域。
- `order` 决定同一 slot 内排序，默认是 `0`。
- `roles` 控制组件对哪些角色可见。
- `visible: false` 可以隐藏组件。
- `meta` 是自定义属性，不直接显示在页面中，适合存阈值、toast key、业务标记等状态配置。
- `alignX/alignY` 控制组件自身在父容器内的对齐。
- `sizeX/sizeY` 控制组件是包住内容还是填满父容器。

## 常用组件

### Text

显示文本，支持标题右侧操作。

```ts
Text({
  text: "组队管理",
  variant: "title",
  slot: "header",
  titleActions: [
    Button({ text: "导出", onClick: exportGroups }),
  ],
})
```

可选属性：

- `variant`: `title | subtitle | body | caption`
- `lineHeight`
- `paragraphSpacing`
- `titleActions`

### Button

按钮事件必须通过 `ActionContext` 执行，不要直接依赖全局变量。

```ts
Button({
  text: "同意",
  variant: "primary",
  onClick: async (ctx) => {
    await ctx.request.post("/api/applications/approve", {
      applicationId: ctx.row?.id,
    })
    ctx.toast("已同意申请")
    ctx.refresh()
  },
})
```

### Form

表单字段主要放 `Input`、`Select`、`TextArea`、`Slider`。

```ts
Form({
  id: "apply-form",
  fields: [
    Input({ name: "name", label: "姓名", required: true }),
    Select({
      name: "role",
      label: "希望承担的角色",
      options: [
        { label: "前端", value: "frontend" },
        { label: "后端", value: "backend" },
      ],
    }),
    TextArea({ name: "reason", label: "申请理由", rows: 4 }),
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
})
```

表单内 action 可以通过 `ctx.form?.values` 获取当前值。

### Table

表格通过 `dataSource` 请求数据，列通过 `Column` 定义。

```ts
Table({
  title: "入组申请",
  dataSource: "/api/applications",
  columns: [
    Column("studentName", "学生姓名", { sortable: true }),
    Column("groupName", "申请小组", { sortable: true }),
    Column("reason", "申请理由"),
  ],
  defaultSort: [{ key: "groupName", direction: "asc" }],
  rowActions: [
    Button({
      text: "同意",
      variant: "primary",
      onClick: approveApplication,
    }),
  ],
})
```

能力：

- `sortable: true` 开启列排序。
- 多次点击不同列会形成多关键字排序。
- `rowActions` 中的 action 可以通过 `ctx.row` 拿到当前行。
- `titleActions` 可以把按钮放在表格标题右侧。

### Card 和 Box

`Card` 适合有标题、header/body/footer 的内容块。`Box` 更像通用布局容器，可以像 Page 一样放任意组件。

```ts
Box({
  title: "组队数据",
  layout: "vertical",
  gap: 12,
  padding: 16,
  collapsible: true,
  scroll: "y",
  maxHeight: 420,
  childrenAlignX: "stretch",
  childrenSizeX: "fill",
  children: [
    Table({ title: "学生列表", dataSource: "/api/students", columns: [] }),
  ],
})
```

常用属性：

- `layout`: `vertical | horizontal | grid | inline`
- `gap`、`padding`、`radius`、`borderWidth`
- `tone`: `default | muted | accent | success | warning | danger`
- `shadow`: `none | subtle | raised`
- `scroll`: `none | x | y | both | auto`
- `maxHeight`、`maxWidth`
- `collapsible`、`defaultCollapsed`
- `titleActions`
- `childrenAlignX/childrenAlignY`
- `childrenSizeX/childrenSizeY`
- `onSignal`

### List

`List` 用于运行时动态生成组件，适合聊天消息、动态卡片列表等。

```ts
List({
  dataSource: "/api/chat/messages",
  itemKey: "id",
  childrenSizeX: "fill",
  renderItem: (message) =>
    Box({
      alignX: message.sender === "self" ? "right" : "left",
      sizeX: "hug",
      padding: "8px 12px",
      children: [
        Text({ text: String(message.text), variant: "body" }),
      ],
    }),
})
```

### Slider

`Slider` 支持数值、float、enum，支持手动输入或下拉选择。

```ts
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
  onChange: (ctx) => {
    return ctx.emitSignal({
      type: "slider-change",
      value: ctx.value,
      payload: ctx.componentMeta,
    })
  },
})
```

float 分段粒度：

```ts
Slider({
  name: "matchWeight",
  label: "匹配偏好权重",
  min: 0,
  max: 1,
  valueType: "float",
  granularity: [
    { from: 0, to: 0.5, step: 0.05 },
    { from: 0.6, to: 1, step: 0.2 },
  ],
  input: { step: 0.01 },
  snapInput: false,
})
```

enum 下拉选择：

```ts
Slider({
  name: "experienceLevel",
  label: "项目经验等级",
  valueType: "enum",
  input: true,
  options: [
    { label: "新手", value: "beginner" },
    { label: "了解", value: "familiar" },
    { label: "熟练", value: "skilled" },
  ],
})
```

说明：

- `input: true` 对数值型 Slider 显示输入框。
- `input: true` 对 enum Slider 显示下拉框。
- `snapInput` 默认会吸附到 step/granularity/options。
- `snapInput: false` 允许手输更细粒度的 float。

## Action 和运行时上下文

Action 类型：

```ts
type Action = (ctx: ActionContext) => void | Promise<void>
```

常用上下文：

```ts
ctx.request.get("/api/...")
ctx.request.post("/api/...", body)
ctx.toast("操作成功", { key: "same-toast", variant: "success" })
ctx.refresh()
ctx.navigate("/path")
ctx.openModal("modal-id")
ctx.closeModal("modal-id")
ctx.row
ctx.form?.values
ctx.form?.setValue?.("fieldName", value)
ctx.value
ctx.componentMeta
ctx.emitSignal({ type: "slider-change", value })
```

通知支持续期：

```ts
ctx.toast("投入时间很充足", {
  key: "weekly-hours-enough",
  variant: "success",
  duration: 1200,
})
```

相同 `key` 的通知重复触发时不会重新播放进入动画，只会重置消失计时器。

## 父子信号

组件可以通过 `ctx.emitSignal` 向最近的父容器发送信号。父容器目前可以是 `Form`、`Card`、`Box`、`Modal` 等支持 `onSignal` 的组件。

示例：两个 Slider 保证一周总时长不超过 168 小时。

```ts
Form({
  id: "apply-form",
  onSignal: (ctx) => {
    if (ctx.signal?.type !== "slider-change") {
      return
    }

    if (ctx.signal.sourceId === "weeklyHours") {
      const weeklyHours = Number(ctx.signal.value ?? 0)
      const restHours = Number(ctx.form?.values.restHours ?? 0)

      if (weeklyHours + restHours > 168) {
        ctx.form?.setValue?.("restHours", Math.max(0, 168 - weeklyHours))
      }
    }
  },
  fields: [
    Slider({
      id: "weeklyHours",
      name: "weeklyHours",
      label: "工作时间",
      input: true,
      onChange: (ctx) =>
        ctx.emitSignal({
          type: "slider-change",
          value: ctx.value,
        }),
    }),
  ],
})
```

## 中间表示 IR

DSL 本身返回的是 TypeScript 对象树。可以通过 `toSerializableIR(page)` 得到 JSON-like IR：

```ts
import { toSerializableIR } from "../dsl"

const ir = toSerializableIR(StudentApplyPage)
```

注意：

- 函数型 action 不能真正 JSON 序列化。
- 当前 IR 工具会把函数转成 `{ $type: "function", name: "..." }` 这样的描述对象。
- 当前 demo 右侧会展示 IR，正式页面可以在 `src/App.tsx` 中隐藏这个面板。

## 当前示例

- `StudentApplyPage`：学生申请表单、Card、Form、Slider、父子信号、toast 续期。
- `TeacherDashboardPage`：后台布局、标题右侧按钮、Table、排序、rowActions、mock 数据更新。
- `ChatAlignmentPage`：Box 对齐、运行时 List、聊天气泡、滚动区域、动态追加消息。

## 使用约定

- 页面描述只写 DSL，不直接写 React 组件。
- 所有事件都写成 `Action`，通过 `ctx` 访问请求、通知、表单、行数据和导航。
- 新组件优先放进 `src/dsl/components/`，再在 React renderer 里实现对应渲染。
- 布局优先用 slot、Box、Card、order、align、size，不使用 x/y 坐标。
- 需要业务状态但不想显示在页面里时，用 `meta`。
- 表格行操作依赖 `ctx.row`。
- 表单提交依赖 `ctx.form?.values`。
- 动态列表优先用 `List`，不要在页面定义阶段硬编码运行时数据。

## 已知限制

- 当前后端请求是 `src/App.tsx` 里的 mock runtime，接真实后端时需要替换 `RuntimeContext.request`。
- Modal 目前主要生成结构和基础打开/关闭接口，复杂状态还可以继续扩展。
- JSON-like IR 可以导出，但还没有实现从 IR 反向恢复完整页面。
- 函数型 action 不能完整序列化，只能保留函数引用或函数描述。
- 主题系统还没有独立抽象，当前样式主要在 `src/styles.css`。
