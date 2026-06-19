# Declaro

**TypeScript 嵌入式 UI DSL + 静态 HTML 编译器 + 全栈框架**

用 TypeScript 函数调用定义页面，通过中间表示（IR）编译为独立 HTML。不写 JSX、不写模板文件、不需要前端运行时框架。

## 为什么选择 Declaro

### 1. DSL → IR → HTML 编译管线

```
Page({ title, env, children })  →  ComponentNode 树 (IR)  →  静态 HTML
```

- 页面定义就是 **TypeScript 对象**，不是字符串模板
- 编译器遍历 IR 树，生成完整 HTML 文档
- 输出是**零依赖的独立文件**，直接双击打开，不需要 React/Vue/任何 JS 框架

### 2. TypeScript 原生，不是新语言

不用学新语法。就是写 TypeScript，享受完整的类型检查、IDE 自动补全和重构工具。

```ts
import { Button, Column, Env, Page, Table, Text } from "../dsl"

const page = Page({
  title: "教师管理后台",
  env: Env({ id: "env", layout: "dashboard", slots: ["header", "main"] }),
  children: [
    Text({ text: "组队管理", variant: "title", slot: "header" }),
    Table({ dataSource: "/api/students", columns: [Column("name", "姓名")] }),
  ],
})
// ↑ 全是类型安全的函数调用，没有字符串拼接
```

### 3. 编译期渲染，客户端零负担

| | React/Vue SPA | Declaro |
|---|---|---|
| 页面渲染 | 浏览器端 JS 运行时 | 编译期在服务端完成 |
| 首屏加载 | 需要 JS bundle | 纯 HTML，即时渲染 |
| SEO | 需要 SSR | 天然静态 HTML |
| 部署 | 需要 Node/nginx + 构建 | 单个 HTML 文件即可 |

Katex 公式在编译期预渲染为 HTML，不需要浏览器加载 MathJax/KaTeX JS。原生 HTML 能力（`<details>`、`<figure>`、`<kbd>`）直接透传。

### 4. 一体化全栈

同一个项目里：
- **DSL 定义页面** → `src/dslPages/`
- **Express 服务端** → 页面路由 + 数据 API + 表单处理
- **静态 HTML 输出** → `Introduction-to-Data-Mining/index.html`

不需要前后端分离，不需要 API 层单独开发。

### 5. 声明式布局系统

用 slot 描述页面区域，不是写 CSS：

```ts
Env({ layout: "dashboard", slots: ["header", "sidebar", "toolbar", "main", "footer"] })
```

支持的布局：`default` | `dashboard` | `split` | `form` | `custom`

### 6. 完整的组件体系

| 组件 | 能力 |
|------|------|
| `Text` | title/subtitle/body/caption，段落自动拆分 |
| `Box` | 通用容器，vertical/horizontal/grid/inline 布局，可折叠 |
| `Card` | 卡片，header/body/footer 三段式，可折叠 |
| `Button` | primary/secondary/danger/ghost，onClick/hover |
| `Form` | 表单，Input/Select/Slider/TextArea 字段，submit 处理 |
| `Table` | 数据表格，多列排序，行操作，从 API 加载 |
| `List` | 动态列表，renderItem 动态生成子组件 |
| `Html` | **原生 HTML 透传**，details/summary/figure/kbd 等全部可用 |
| `Katex` | **LaTeX 公式**，编译期预渲染，支持行内和块级 |

全部组件支持：slot 定位、order 排序、roles 权限、visible 显隐、align/size 布局控制。

### 7. 类型安全的 Action 系统

所有交互通过统一的 `ActionContext`：

```ts
onClick: async (ctx) => {
  await ctx.request.post("/api/approve", { id: ctx.row?.id })  // 请求
  ctx.toast("已通过", { variant: "success" })                  // 通知
  ctx.refresh()                                                 // 刷新
  ctx.form?.values                                              // 表单值
  ctx.navigate("/next")                                         // 导航
}
```

编译为静态 HTML 时，toast 自动转为 vanilla JS 的 `showToast()`。

### 8. 中间表示 IR

DSL 生成的是纯数据（ComponentNode 树），不是渲染代码。这使得：
- 同一个 IR 可以有多个渲染后端（React 开发 / 静态 HTML 生产）
- 页面可以被程序化分析、转换、优化
- 未来可以接入更多渲染目标（PDF、Native UI）

## 快速开始

```bash
npm install
npm run dev          # 启动全栈服务端 → http://localhost:3000
npm run typecheck    # TypeScript 类型检查
```

默认页面：

```
http://localhost:3000/teacher/dashboard   → 教师后台
http://localhost:3000/student/apply       → 学生申请
http://localhost:3000/chat/alignment      → 聊天对齐
```

## 目录结构

```
src/
├── compiler/compile.ts   # DSL → 静态 HTML 编译器
├── server/               # Express 服务端
│   ├── index.ts          #   路由 + 页面托管
│   └── api.ts            #   数据 API
├── dsl/                  # DSL 类型系统
│   ├── core.ts           #   基础类型、ActionContext
│   ├── component.ts      #   ComponentNode 联合类型、IR 工具
│   ├── page.ts           #   Page / PageNode
│   ├── env.ts            #   Env / EnvNode（布局 + slot）
│   └── components/       #   14 个组件定义（类型 + 工厂函数）
├── dslPages/             # 正式 DSL 页面入口
├── renderer/react/       # React 渲染器（开发模式）
├── examples/             # 示例/教学页面
├── app/                  # Demo Shell + 路由注册
└── types/                # 通用类型
```

## 新增页面

1. 在 `src/dslPages/` 新建页面文件
2. `Page({ title, env, children })` 定义页面结构
3. 在 `src/dslPages/index.ts` 导出
4. 在 `src/app/routes.ts` 注册路由
5. 服务端自动编译并托管

最小模板：

```ts
import { Env, Page, Text } from "../dsl"

export const MyPage = Page({
  title: "我的页面",
  env: Env({ id: "my-env", layout: "default", slots: ["header", "main"] }),
  children: [
    Text({ text: "Hello Declaro", variant: "title", slot: "header" }),
  ],
})
```

## 组件示例

### Text + Button

```ts
Text({
  text: "组队管理",
  variant: "title",
  slot: "header",
  titleActions: [Button({ text: "导出", variant: "primary", onClick: exportGroups })],
})
```

### Card + Box（可折叠）

```ts
Card({
  title: "知识点 1：分类规则质量度量",
  collapsible: true,
  defaultCollapsed: true,
  body: [
    Box({
      layout: "vertical", gap: 12, tone: "accent",
      children: [
        Text({ text: "• 覆盖率 = |A| / N", variant: "body" }),
        Text({ text: "💡 高覆盖+高准确=好规则", variant: "body" }),
      ],
    }),
  ],
})
```

### Html（原生 HTML 透传）

```ts
Html({ html: `<details><summary>点击展开</summary><p>任意 HTML 内容</p></details>` })
```

### Katex（LaTeX 公式）

```ts
Katex({ expression: "P(C|X) = \\frac{P(X|C)P(C)}{P(X)}", displayMode: true })
// 编译期预渲染为 HTML，客户端不需要加载 KaTeX JS
```

### Form + Select + Slider

```ts
Form({
  id: "apply",
  fields: [
    Input({ name: "name", label: "姓名", required: true }),
    Select({ name: "role", label: "角色", options: [{ label: "前端", value: "fe" }] }),
    Slider({ name: "hours", label: "时间/周", min: 0, max: 168, valueType: "int", input: true }),
  ],
  submitButton: Button({ text: "提交", variant: "primary", onClick: handleSubmit }),
  onSignal: (ctx) => { /* 处理子组件信号 */ },
})
```

### Table（数据表格）

```ts
Table({
  title: "入组申请",
  dataSource: "/api/applications",
  columns: [
    Column("studentName", "姓名", { sortable: true }),
    Column("reason", "理由"),
  ],
  rowActions: [Button({ text: "同意", variant: "primary", onClick: approve })],
})
```

## 组件通用属性

所有组件共享：

```ts
{
  id?: string          // 唯一标识
  slot?: string        // 挂载到哪个布局区域
  order?: number       // 同 slot 内的排序
  visible?: boolean    // 显隐控制
  roles?: Role[]       // 角色权限（student/teacher/admin）
  meta?: Record<string, unknown>  // 自定义元数据
  alignX?: "left" | "center" | "right" | "stretch"
  alignY?: "top" | "center" | "bottom" | "stretch"
  sizeX?: "hug" | "fill"
  sizeY?: "hug" | "fill"
}
```

## Layout 布局

```ts
Env({ layout: "default", slots: [...] })    // 线性排列
Env({ layout: "dashboard", slots: [...] })  // header/sidebar/toolbar/main/footer
Env({ layout: "split", slots: [...] })      // main + sidebar 分栏
Env({ layout: "form", slots: [...] })       // 表单布局
Env({ layout: "custom", slots: [...] })     // 自定义（当前同 default）
```

## 使用约定

- 页面只写 DSL，不写 React 组件
- 所有事件写成 `Action`，通过 `ctx` 访问一切运行时能力
- 布局优先用 slot + order + align/size，不用坐标定位
- 动态列表用 `List`，不在页面定义阶段硬编码运行时数据
- 业务配置不显示在 UI 时放 `meta`
- 表格行操作通过 `ctx.row` 获取当前行数据
- 表单提交通过 `ctx.form?.values` 获取表单值

## 已知限制

- Table/List 在静态模式下需要服务端提供数据 API
- Modal 静态模式下仅展示结构，完整交互待后续
- IR 可导出但暂不支持反向恢复完整页面
- 主题系统尚未独立抽象，当前样式在 `src/styles.css`
