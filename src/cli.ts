import * as fs from "node:fs"
import * as path from "node:path"
import { compilePage, compilePageToFile } from "./compiler/compile.js"
import type { PageNode } from "./dsl/index.js"

const HELP = `
Declaro — TypeScript 嵌入式 UI DSL 编译器

用法:
  declaro dev                 启动 Express 服务端（编译所有页面 + 数据 API）
  declaro compile <file>     编译单个 DSL 页面 → 输出 HTML
  declaro compile --all       编译所有注册页面 → dist/
  declaro --help              显示帮助

示例:
  declaro dev
  declaro compile src/dslPages/myPage.ts
  declaro compile --all
`

async function main() {
  const args = process.argv.slice(2)
  const cmd = args[0]

  if (!cmd || cmd === "--help" || cmd === "-h") {
    console.log(HELP)
    return
  }

  if (cmd === "dev") {
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

  console.error(`Unknown command: ${cmd}`)
  console.log(HELP)
  process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
