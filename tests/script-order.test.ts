// An Island compiles to inline script that calls __DSL__ directly, so the runtime
// bundle has to be defined before any of the body's scripts run.

import assert from "node:assert/strict"
import { test } from "node:test"

import { Env, Island, Page, Script, Text } from "../src/dsl"
import { compilePage } from "../src/compiler/compile"

function islandPage(): string {
  return compilePage(
    Page({
      title: "t",
      env: Env({ id: "e", layout: "default", slots: ["main"] }),
      state: { pageValue: 1 },
      head: [Script({ inline: "window.__HEAD_RAN__ = typeof __DSL__" })],
      children: [
        Island({
          id: "i",
          slot: "main",
          initialState: { n: 0 },
          render: () => Text({ text: "x" }),
          handlers: { bump: (_e, stateHandle) => stateHandle.set({ n: 1 }) },
        }),
      ],
    }),
  )
}

test("the runtime is defined before the island script that uses it", () => {
  const html = islandPage()
  const runtime = html.indexOf("__DSL_RUNTIME__")
  const define = html.indexOf("__DSL__.defineIsland")
  assert.ok(runtime >= 0 && define >= 0)
  assert.ok(runtime < define, `runtime at ${runtime} must precede defineIsland at ${define}`)
})

test("the runtime is defined before page state is set", () => {
  const html = islandPage()
  assert.ok(html.indexOf("__DSL_RUNTIME__") < html.indexOf("__DSL__.setPageState"))
})

test("a head script runs after the runtime, so it can use __DSL__", () => {
  const html = islandPage()
  assert.ok(html.indexOf("__DSL_RUNTIME__") < html.indexOf("window.__HEAD_RAN__"))
})

test("the island's own markup precedes the hydrateAll call that looks for it", () => {
  const html = islandPage()
  assert.ok(html.indexOf('data-island="i"') < html.indexOf("__DSL__.hydrateAll()"))
})
