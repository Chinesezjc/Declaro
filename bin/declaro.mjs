#!/usr/bin/env node
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"
import path from "node:path"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const cliPath = path.resolve(__dirname, "../src/cli.ts")

const child = spawn("npx", ["tsx", cliPath, ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: true,
})
child.on("exit", (code) => process.exit(code ?? 0))
