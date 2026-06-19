# Declaro 路线图

## 当前定位

| | Declaro | React |
|--|---------|-------|
| 范式 | 编译型 DSL | 运行时框架 |
| 渲染 | 编译期服务端一次完成 | 浏览器 JS Virtual DOM |
| 客户端 JS | ~0KB | 40KB+ |
| 首屏 | 纯 HTML 即时渲染 | 需 JS 解析执行 |
| 适合 | 内容型网站、管理后台、文档 | 应用型软件、编辑器、实时协作 |

## 五个待解决问题

1. 📊 **交互能力** — 只能做基本交互，拖拽/实时协作/动画做不到
2. 🧩 **生态** — 没有组件市场、UI 库、工具链
3. 🔄 **状态管理** — 无客户端状态，依赖服务端往返
4. 🏗️ **扩展** — 加新组件需改编译器源码
5. 🔌 **第三方集成** — GA/Sentry/Analytics 需手写 JS

---

## Phase 1：插件 API + Script/Head（立即）

**解决**：扩展性 🏗️ + 第三方集成 🔌 + 生态基础 🧩

### 1a. `defineComponent` 插件 API

让编译器从注册表查找组件，不再硬编码 switch-case。第三方写 npm 包即可扩展组件，不需要改 Declaro 源码。

```ts
// declaro-chart npm 包
import { defineComponent } from "declaro"

export const Chart = defineComponent({
  type: "chart",
  props: { config: "object", width: "number", height: "number" },
  compile: ({ config, width, height }) =>
    `<div class="chart" data-config='${JSON.stringify(config)}' style="width:${width}px;height:${height}px">
      <canvas></canvas>
    </div>`,
})
```

```ts
// 用户项目
import { Chart } from "declaro-chart"
import { Declaro } from "declaro"

Declaro.use(Chart)

Page({
  children: [
    Chart({ config: { type: "bar", data: [...] }, width: 600 }),
  ],
})
```

**改动**：
- `src/dsl/plugin.ts` — 新增 `defineComponent` API + 注册表
- `src/compiler/compile.ts` — 开关语句改为查注册表
- `src/renderer/react/renderComponent.tsx` — 同上
- `src/dsl/component.ts` — ComponentNode 改为开放类型

### 1b. Script / Head 组件

让页面声明式注入第三方脚本。

```ts
Page({
  head: [
    Script({ src: "https://www.googletagmanager.com/gtag/js?id=G-XXX", async: true }),
    Script({ inline: "window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);}" }),
  ],
  children: [...],
})
```

**改动**：
- `src/dsl/components/script.ts` — ScriptNode 类型定义
- `src/dsl/page.ts` — PageNode 新增 `head?: ComponentNode[]`
- `src/compiler/compile.ts` — compilePage 支持 head 渲染
- `src/renderer/react/renderPage.tsx` — 同上

### Phase 1 代价

| 文件 | 行数 |
|------|------|
| `src/dsl/plugin.ts` | ~60 行 |
| `src/dsl/components/script.ts` | ~25 行 |
| `src/dsl/page.ts` | +3 行 |
| `src/dsl/component.ts` | ~15 行改动 |
| `src/compiler/compile.ts` | ~40 行改动 |
| `src/renderer/react/renderComponent.tsx` | ~15 行改动 |

---

## Phase 2：Islands 架构 + 客户端运行时（近期）

**解决**：交互能力 📊 + 状态管理 🔄

### 2a. Islands 架构

页面 99% 纯静态 HTML，标记 `interactive: true` 的组件成为交互孤岛，编译器输出对应的 vanilla JS 运行时。

```ts
Counter({
  initialState: { count: 0 },
  interactive: true,
  render: ({ count }, set) =>
    Box({ children: [
      Text({ text: `计数: ${count}` }),
      Button({ text: "+1", onClick: () => set({ count: count + 1 }) }),
    ]}),
})
```

### 2b. 客户端运行时（~5KB）

- 响应式状态代理（`State` 对象）
- Island 注册 + hydrate
- 局部 DOM 更新
- 事件绑定
- 不依赖任何框架

```ts
// 页面级共享状态
const store = State({ tab: 0, filter: "" })

Page({
  state: store,
  children: [
    TabBar({
      interactive: true,
      render: ({ tab }, set) => (...),
    }),
    Content({
      interactive: true,
      render: ({ tab }, set) => (...),
    }),
  ],
})
```

### Phase 2 代价

| 文件 | 行数 |
|------|------|
| `src/runtime/state.ts` | ~80 行 |
| `src/runtime/island.ts` | ~120 行 |
| `src/runtime/dom.ts` | ~100 行 |
| `src/compiler/compile.ts` | ~60 行改动 |
| `src/runtime/runtime.ts`（入口） | ~40 行 |

客户端 JS 总大小：~5KB（gzip ~2KB）

---

## Phase 3：组件市场 + 工具链（中期）

**解决**：生态 🧩

### 3a. npm 组件发布规范

```
declaro-chart/          ← npm 包
├── package.json        ←  "declaro": { "components": ["Chart"] }
├── src/chart.ts        ←  defineComponent({ type: "chart", ... })
└── README.md
```

### 3b. 反向适配器

让 Declaro 页面编译为 React/Vue 组件，复用其生态：

```
Declaro DSL → compileToReact() → React 组件
                                → 在 Next.js 项目中直接使用
                                → 可用所有 React UI 库
```

### 3c. 工具链

- `create-declaro` — 脚手架
- `declaro add <plugin>` — 插件安装
- `declaro dev --hot` — HMR 开发

---

## Phase 4：高级状态 + 全栈能力（远期）

### 4a. 响应式 State 系统

```ts
const store = State({
  user: { name: "Alice", loggedIn: false },
  todos: [
    { id: 1, text: "Learn Declaro", done: false },
  ],
})

// 自动依赖追踪
// store.todos[0].done = true → 用到了 done 的 Island 自动更新
```

### 4b. 服务端状态同步

```ts
const store = State({
  source: "/api/todos",          // 从 API 加载
  sync: { method: "POST", debounce: 300 },  // 变更自动提交
})
```

### 4c. 全栈部署

```
declaro deploy → 编译所有页面 + 启动服务端 + 部署到 Vercel/Cloudflare
```

---

## 时间线

```
Phase 1  ████████░░░░░░░░░░  插件 API + Script/Head    现在
Phase 2  ░░░░░░░░████████░░  Islands 架构              1-2 周
Phase 3  ░░░░░░░░░░░░░░████  组件市场 + 工具链          1-2 月
Phase 4  ░░░░░░░░░░░░░░░░░░  高级状态 + 全栈            3-6 月
```
