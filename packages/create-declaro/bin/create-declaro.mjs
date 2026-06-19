#!/usr/bin/env node
// Scaffolding CLI for Declaro projects.
// Usage: npx create-declaro my-app

import * as fs from "node:fs"
import * as path from "node:path"
import { fileURLToPath } from "node:url"
import { execSync } from "node:child_process"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const args = process.argv.slice(2)
const projectName = args[0]

if (!projectName) {
  console.log(`
Declaro — 脚手架工具

用法:
  npx create-declaro <project-name>

示例:
  npx create-declaro my-app
`)
  process.exit(0)
}

const cwd = process.cwd()
const projectDir = path.resolve(cwd, projectName)

if (fs.existsSync(projectDir)) {
  console.error(`Error: 目录 "${projectName}" 已存在`)
  process.exit(1)
}

console.log(`\n🚀 创建 Declaro 项目: ${projectName}\n`)

// Create directory structure
const dirs = [
  "src/dslPages",
  "src/app",
  "src/server",
  "src/components",
  "public",
]

for (const dir of dirs) {
  fs.mkdirSync(path.join(projectDir, dir), { recursive: true })
}

// package.json
const pkgJson = {
  name: projectName,
  version: "0.1.0",
  private: true,
  type: "module",
  scripts: {
    dev: "declaro dev",
    build: "declaro compile --all dist",
    typecheck: "tsc --noEmit",
  },
  dependencies: {
    declaro: "*",
    express: "^5.2.1",
  },
  devDependencies: {
    typescript: "^5.4.0",
    tsx: "^4.22.0",
    "@types/express": "^5.0.0",
  },
}

fs.writeFileSync(
  path.join(projectDir, "package.json"),
  JSON.stringify(pkgJson, null, 2),
)

// tsconfig.json
fs.writeFileSync(
  path.join(projectDir, "tsconfig.json"),
  JSON.stringify(
    {
      compilerOptions: {
        target: "ES2020",
        lib: ["DOM", "DOM.Iterable", "ES2020"],
        module: "ESNext",
        moduleResolution: "Bundler",
        strict: true,
        noEmit: true,
        jsx: "react-jsx",
        esModuleInterop: true,
        skipLibCheck: true,
        resolveJsonModule: true,
        isolatedModules: true,
      },
      include: ["src"],
    },
    null,
    2,
  ),
)

// .gitignore
fs.writeFileSync(
  path.join(projectDir, ".gitignore"),
  `node_modules/
dist/
*.tsbuildinfo
`,
)

// Routes
fs.writeFileSync(
  path.join(projectDir, "src/app/routes.ts"),
  `import type { PageNode, RuntimeUser } from "declaro"
import { HomePage } from "../dslPages/home"

export type PageKey = "home"

export type DslRoute = {
  key: PageKey
  path: string
  label: string
  page: PageNode
  user: RuntimeUser
}

export const dslRoutes = [
  {
    key: "home",
    path: "/",
    label: "首页",
    page: HomePage,
    user: { id: "0", role: "admin", name: "User" },
  },
] as const satisfies readonly DslRoute[]

export function getDslRoute(key: PageKey): DslRoute {
  return dslRoutes.find((r) => r.key === key) ?? dslRoutes[0]
}

export function getDslRouteByPath(p: string): DslRoute | undefined {
  const normalized = p.split("?")[0].replace(/\\/$/, "") || "/"
  return dslRoutes.find((r) => r.path === normalized)
}
`,
)

// Home page
fs.writeFileSync(
  path.join(projectDir, "src/dslPages/home.ts"),
  `import { Page, Env, Box, Text, Button, Card } from "declaro"

const HomeEnv = Env({
  id: "home-env",
  layout: "default",
  slots: ["header", "main", "footer"],
})

export const HomePage = Page({
  title: "Declaro App",
  env: HomeEnv,
  children: [
    Text({
      slot: "header",
      variant: "title",
      text: "🚀 Welcome to Declaro!",
    }),
    Box({
      slot: "main",
      layout: "vertical",
      gap: 24,
      children: [
        Card({
          title: "快速开始",
          body: [
            Text({
              variant: "body",
              text: "编辑 src/dslPages/home.ts 开始构建你的页面。\\n\\nDeclaro 是一个编译型 DSL 框架，TypeScript 写 UI，编译器生成纯 HTML。",
            }),
            Button({
              text: "查看文档",
              variant: "primary",
            }),
          ],
        }),
      ],
    }),
    Text({
      slot: "footer",
      variant: "caption",
      text: "Built with Declaro",
    }),
  ],
})
`,
)

// Server entry
fs.writeFileSync(
  path.join(projectDir, "src/server/index.ts"),
  `import express from "express"
import { dslRoutes } from "../app/routes"
import { compilePage } from "declaro/compiler"

const app = express()
const PORT = process.env.PORT ?? 3000

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Pre-compile pages
const cache = new Map<string, string>()
for (const route of dslRoutes) {
  cache.set(route.key, compilePage(route.page, { title: route.page.title, route: route.path }))
}

// Register routes
for (const route of dslRoutes) {
  app.get(route.path, (_req, res) => res.send(cache.get(route.key)!))
}

app.listen(PORT, () => {
  console.log(\`Declaro server: http://localhost:\${PORT}\`)
})
`,
)

// README
fs.writeFileSync(
  path.join(projectDir, "README.md"),
  `# ${projectName}

Built with [Declaro](https://github.com/Chinesezjc/Declaro) — TypeScript-embedded UI DSL, compiled to static HTML.

## 快速开始

\`\`\`bash
npm install
npm run dev
\`\`\`

打开 http://localhost:3000

## 项目结构

\`\`\`
src/
  dslPages/    # DSL 页面定义
  app/         # 路由 + 数据
  server/      # Express 服务端
\`\`\`

## 命令

- \`npm run dev\` — 启动开发服务器
- \`npm run build\` — 编译所有页面到 dist/
- \`declaro compile <file>\` — 编译单个页面
`,
)

console.log("✓ 项目结构已创建")
console.log("✓ package.json, tsconfig.json, .gitignore")
console.log("✓ 首页模板 → src/dslPages/home.ts")
console.log("✓ 路由配置 → src/app/routes.ts")
console.log("✓ Express 服务端 → src/server/index.ts")
console.log("")
console.log("开始开发:")
console.log(`  cd ${projectName}`)
console.log("  npm install")
console.log("  npm run dev")
console.log("")
