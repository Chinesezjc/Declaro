import * as fs from "node:fs"
import * as path from "node:path"
import { compilePage, compilePageToFile } from "./compiler/compile.js"
import type { PageNode } from "./dsl/index.js"

const HELP = `
Declaro — TypeScript 嵌入式 UI DSL 编译器

用法:
  declaro dev [--hot]          启动 Express 服务端（编译所有页面 + 数据 API）
  declaro compile <file>       编译单个 DSL 页面 → 输出 HTML
  declaro compile --all        编译所有注册页面 → dist/
  declaro add <package>        安装 Declaro 插件包
  declaro deploy [--target=vercel|cloudflare|node]  部署到生产环境
  declaro --help               显示帮助

示例:
  declaro dev
  declaro dev --hot           启动开发服务器（HMR 热更新）
  declaro compile src/dslPages/myPage.ts
  declaro compile --all
  declaro add declaro-chart
  declaro deploy --target=vercel
`

async function main() {
  const args = process.argv.slice(2)
  const cmd = args[0]

  if (!cmd || cmd === "--help" || cmd === "-h") {
    console.log(HELP)
    return
  }

  if (cmd === "dev") {
    const hot = args.includes("--hot")
    if (hot) {
      console.log("Starting Declaro dev server with HMR...")
      // Use Vite with the Declaro HMR plugin
      const { createServer } = await import("vite")
      const { declaroHMRPlugin } = await import("./server/vite-plugin.js")
      const { dslRoutes } = await import("./app/routes.js")

      const server = await createServer({
        root: process.cwd(),
        plugins: [
          declaroHMRPlugin({
            getRoutes: () => dslRoutes as unknown as Array<{ key: string; path: string; page: import("./dsl/index.js").PageNode }>,
            pagesDir: "src/dslPages",
          }),
        ],
        server: {
          port: 3000,
        },
      })
      await server.listen()
      console.log(`\n🚀 Declaro HMR server running at http://localhost:3000`)
      console.log("Watching src/dslPages/ for changes...")
      return
    }

    console.log("Starting Declaro server...")
    await import("./server/index.js")
    return
  }

  if (cmd === "compile") {
    const target = args[1]

    if (target === "--all") {
      const { dslRoutes } = await import("./app/routes.js")
      const outDir = path.resolve(args[2] ?? "dist")
      console.log(`Compiling ${dslRoutes.length} pages to ${outDir}/ ...`)

      for (const route of dslRoutes) {
        const html = compilePage(route.page, {
          title: route.page.title,
          route: route.path,
        })
        const relPath = route.path.replace(/^\//, "") || "index"
        const outPath = path.join(outDir, `${relPath}.html`)
        if (!fs.existsSync(path.dirname(outPath))) fs.mkdirSync(path.dirname(outPath), { recursive: true })
        fs.writeFileSync(outPath, html, "utf-8")
        console.log(`  ✓ ${route.key} → ${outPath}`)
      }

      console.log(`\nDone. Open with: file://${outDir}/`)
      return
    }

    // Compile single file
    if (!target) {
      console.error("Error: 请指定要编译的 .ts 文件")
      console.log("  declaro compile src/dslPages/myPage.ts")
      process.exit(1)
    }

    const absPath = path.resolve(target)
    console.log(`Compiling ${absPath} ...`)

    try {
      const mod = await import(absPath)
      // Find the first PageNode export
      let page: PageNode | undefined
      for (const key of Object.keys(mod)) {
        const val = mod[key]
        if (val && typeof val === "object" && (val as PageNode).type === "page") {
          page = val as PageNode
          console.log(`  Found page: ${key}`)
          break
        }
      }

      if (!page) {
        console.error("Error: 文件中未找到 Page 导出")
        process.exit(1)
      }

      const outPath = args[2] ?? path.join(path.dirname(absPath), "index.html")
      compilePageToFile(page, outPath, { title: page.title })
      console.log(`  ✓ ${outPath}`)
    } catch (err) {
      console.error("Error:", err instanceof Error ? err.message : err)
      process.exit(1)
    }
    return
  }

  if (cmd === "add") {
    const pkgName = args[1]
    if (!pkgName) {
      console.error("Error: 请指定要安装的插件包名")
      console.log("  declaro add declaro-chart")
      process.exit(1)
    }

    console.log(`Installing ${pkgName}...`)
    const { execSync } = await import("node:child_process")
    try {
      execSync(`npm install ${pkgName}`, { stdio: "inherit", cwd: process.cwd() })
      console.log(`\n✓ ${pkgName} installed`)
      console.log(`\nTo use it, import the component in your page file:`)
      console.log(`  import { ... } from "${pkgName}"`)
    } catch {
      console.error(`Failed to install ${pkgName}`)
      process.exit(1)
    }
    return
  }

  if (cmd === "deploy") {
    const { deployCommand } = await import("./cli/deploy.js")
    await deployCommand(args.slice(1))
    return
  }

  console.error(`Unknown command: ${cmd}`)
  console.log(HELP)
  process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
