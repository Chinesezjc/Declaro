// Build the Declaro client runtime bundle using esbuild.
// Output: src/runtime/dist/runtime.min.js (IIFE, minified)

import * as esbuild from "esbuild"
import * as fs from "node:fs"
import * as path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function build() {
  const outDir = path.resolve(__dirname, "../src/runtime/dist")
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

  const result = await esbuild.build({
    entryPoints: [path.resolve(__dirname, "../src/runtime/runtime.ts")],
    bundle: true,
    minify: true,
    target: "es2020",
    format: "iife",
    globalName: "__DSL_RUNTIME__",
    outfile: path.resolve(outDir, "runtime.min.js"),
    write: true,
  })

  if (result.errors.length > 0) {
    console.error("Runtime build errors:", result.errors)
    process.exit(1)
  }

  if (result.warnings.length > 0) {
    console.warn("Runtime build warnings:", result.warnings)
  }

  const stats = fs.statSync(path.resolve(outDir, "runtime.min.js"))
  const sizeKB = (stats.size / 1024).toFixed(2)
  console.log(`✓ Runtime built: ${outDir}/runtime.min.js (${sizeKB} KB)`)

  // Also write an un-minified version for debugging
  await esbuild.build({
    entryPoints: [path.resolve(__dirname, "../src/runtime/runtime.ts")],
    bundle: true,
    minify: false,
    target: "es2020",
    format: "iife",
    globalName: "__DSL_RUNTIME__",
    outfile: path.resolve(outDir, "runtime.js"),
    write: true,
  })
  const debugStats = fs.statSync(path.resolve(outDir, "runtime.js"))
  console.log(`✓ Runtime debug: ${outDir}/runtime.js (${(debugStats.size / 1024).toFixed(2)} KB)`)
}

build().catch((err) => {
  console.error("Failed to build runtime:", err)
  process.exit(1)
})
