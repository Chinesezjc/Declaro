// Island event wiring: a button/field must trigger the handler it declares,
// regardless of where it sits in the rendered tree.

import assert from "node:assert/strict"
import { test } from "node:test"

import { Box, Button, Env, Input, Island, Page, Select, Text } from "../src/dsl"
import { compilePage } from "../src/compiler/compile"

type EventBinding = { label: string; handler: string }

/** Extract (button label -> bound handler) pairs in document order. */
function buttonBindings(html: string): EventBinding[] {
  const out: EventBinding[] = []
  const re = /<button[^>]*data-dsl-event="click:([^"]+)"[^>]*>([^<]*)</g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    out.push({ handler: m[1], label: m[2].trim() })
  }
  return out
}

function pageWith(children: ReturnType<typeof Island>[]): string {
  return compilePage(
    Page({
      title: "t",
      env: Env({ id: "e", layout: "default", slots: ["main"] }),
      children,
    }),
  )
}

test("each button binds the handler it declares, not the one at its position", () => {
  // Buttons are rendered stop/start/refresh but declared start/stop/refresh.
  // Position-based wiring would bind "停止" to start — a destructive mismatch.
  const html = pageWith([
    Island({
      id: "ops",
      slot: "main",
      initialState: { last: "none" },
      render: (s) =>
        Box({
          layout: "horizontal",
          children: [
            Text({ text: `last=${s.last}` }),
            Button({ text: "停止", islandHandler: "stop" }),
            Button({ text: "启动", islandHandler: "start" }),
            Button({ text: "刷新", islandHandler: "refresh" }),
          ],
        }),
      handlers: {
        start: (_e, st) => { st.set({ last: "started" }) },
        stop: (_e, st) => { st.set({ last: "stopped" }) },
        refresh: (_e, st) => { st.set({ last: "refreshed" }) },
      },
    }),
  ])

  assert.deepEqual(buttonBindings(html), [
    { label: "停止", handler: "stop" },
    { label: "启动", handler: "start" },
    { label: "刷新", handler: "refresh" },
  ])
})

test("a button without islandHandler gets no event binding", () => {
  const html = pageWith([
    Island({
      id: "mixed",
      slot: "main",
      initialState: { n: 0 },
      render: (s) =>
        Box({
          children: [
            Text({ text: `n=${s.n}` }),
            Button({ text: "装饰" }),
            Button({ text: "计数", islandHandler: "bump" }),
          ],
        }),
      handlers: { bump: (_e, st) => { st.set({ n: 1 }) } },
    }),
  ])

  // Only the declared button is wired; the decorative one stays inert.
  assert.deepEqual(buttonBindings(html), [{ label: "计数", handler: "bump" }])
})

test("more handlers than buttons does not wire unrelated buttons", () => {
  const html = pageWith([
    Island({
      id: "extra",
      slot: "main",
      initialState: { n: 0 },
      render: () => Box({ children: [Button({ text: "唯一", islandHandler: "only" })] }),
      handlers: {
        only: (_e, st) => { st.set({ n: 1 }) },
        unusedA: (_e, st) => { st.set({ n: 2 }) },
        unusedB: (_e, st) => { st.set({ n: 3 }) },
      },
    }),
  ])

  assert.deepEqual(buttonBindings(html), [{ label: "唯一", handler: "only" }])
})

test("input and select bind their declared handlers with per-type default events", () => {
  const html = pageWith([
    Island({
      id: "form",
      slot: "main",
      initialState: { uid: "" },
      render: () =>
        Box({
          children: [
            Input({ name: "uid", label: "UID", islandHandler: "onUid" }),
            Select({
              name: "server",
              label: "区服",
              options: [{ label: "CN", value: "cn" }],
              islandHandler: "onServer",
            }),
            Input({ name: "q", label: "搜索", islandHandler: "onEnter", islandEvent: "keydown" }),
          ],
        }),
      handlers: {
        onUid: (_e, st) => { st.set({ uid: "x" }) },
        onServer: (_e, st) => { st.set({ uid: "y" }) },
        onEnter: (_e, st) => { st.set({ uid: "z" }) },
      },
    }),
  ])

  // Input defaults to "input", Select to "change", and an explicit
  // islandEvent overrides the default.
  assert.match(html, /<input name="uid"[^>]*data-dsl-event="input:onUid"/)
  assert.match(html, /<select name="server"[^>]*data-dsl-event="change:onServer"/)
  assert.match(html, /<input name="q"[^>]*data-dsl-event="keydown:onEnter"/)
})

test("handler names containing regex-special characters survive wiring", () => {
  const html = pageWith([
    Island({
      id: "odd",
      slot: "main",
      initialState: { n: 0 },
      render: () => Box({ children: [Button({ text: "go", islandHandler: "ns.do" })] }),
      handlers: { "ns.do": (_e, st) => { st.set({ n: 1 }) } },
    }),
  ])

  assert.deepEqual(buttonBindings(html), [{ label: "go", handler: "ns.do" }])
})
