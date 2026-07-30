// The compiler re-emits handler bodies inside a generated function, and the
// runtime calls that function positionally. These tests pin the contract so the
// two sides cannot drift apart again.

import assert from "node:assert/strict"
import { test } from "node:test"

import { Box, Button, Env, Island, Page, Text } from "../src/dsl"
import { compilePage } from "../src/compiler/compile"

function compileIslandPage(island: ReturnType<typeof Island>): string {
  return compilePage(
    Page({
      title: "t",
      env: Env({ id: "e", layout: "default", slots: ["main"] }),
      children: [island],
    }),
  )
}

test("generated handler declares the parameters the runtime passes", () => {
  const html = compileIslandPage(
    Island({
      id: "c",
      slot: "main",
      initialState: { n: 0 },
      render: (s) =>
        Box({ children: [Text({ text: `n=${s.n}` }), Button({ text: "go", islandHandler: "bump" })] }),
      handlers: {
        bump: (_e, stateHandle) => {
          stateHandle.set({ n: 1 })
        },
      },
    }),
  )

  // src/runtime/island.ts calls handlers as
  // (event, stateHandle, container, pageStateHandle?).
  assert.match(html, /function __dsl_h_c_bump\(event,stateHandle,container\)/)
})

test("usePageState adds the fourth parameter", () => {
  const html = compileIslandPage(
    Island({
      id: "p",
      slot: "main",
      usePageState: true,
      initialState: { n: 0 },
      render: (s) =>
        Box({ children: [Text({ text: `n=${s.n}` }), Button({ text: "go", islandHandler: "sync" })] }),
      handlers: {
        sync: (_e, stateHandle, _container, pageStateHandle) => {
          stateHandle.set({ n: Number(pageStateHandle?.getSnapshot().n ?? 0) })
        },
      },
    }),
  )

  assert.match(html, /function __dsl_h_p_sync\(event,stateHandle,container,pageStateHandle\)/)
})

test("handler body reaches the output verbatim, so state API calls survive", () => {
  const html = compileIslandPage(
    Island({
      id: "v",
      slot: "main",
      initialState: { n: 0, label: "idle" },
      render: (s) =>
        Box({ children: [Text({ text: `n=${s.n}` }), Button({ text: "go", islandHandler: "act" })] }),
      handlers: {
        act: (_e, stateHandle) => {
          const cur = stateHandle.getSnapshot()
          stateHandle.set({ n: Number(cur.n) + 1, label: "busy" })
        },
      },
    }),
  )

  // Both StateHandle methods the DSL type advertises must appear as written;
  // a mismatched type would have led authors to call a non-existent API.
  assert.match(html, /stateHandle\.getSnapshot\(\)/)
  assert.match(html, /stateHandle\.set\(\{\s*n:\s*Number\(cur\.n\)\s*\+\s*1/)
})

test("every declared handler is registered in the island handler map", () => {
  const html = compileIslandPage(
    Island({
      id: "m",
      slot: "main",
      initialState: { n: 0 },
      render: () =>
        Box({
          children: [
            Button({ text: "a", islandHandler: "alpha" }),
            Button({ text: "b", islandHandler: "beta" }),
          ],
        }),
      handlers: {
        alpha: (_e, st) => { st.set({ n: 1 }) },
        beta: (_e, st) => { st.set({ n: 2 }) },
      },
    }),
  )

  assert.match(html, /"alpha":__dsl_h_m_alpha/)
  assert.match(html, /"beta":__dsl_h_m_beta/)
})
