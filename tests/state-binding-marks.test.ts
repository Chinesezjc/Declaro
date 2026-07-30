// compileIsland guesses text bindings by looking for state values in the rendered
// HTML. The guess has to be conservative: a wrong guess writes unrelated state into
// whatever text happened to match, and every set() afterwards keeps rewriting it.

import assert from "node:assert/strict"
import { test } from "node:test"

import { Box, Env, Html, Island, Page, Text } from "../src/dsl"
import { compilePage } from "../src/compiler/compile"

function islandHTML(
  initialState: Record<string, unknown>,
  children: ReturnType<typeof Text>[],
): string {
  const html = compilePage(
    Page({
      title: "t",
      env: Env({ id: "e", layout: "default", slots: ["main"] }),
      children: [
        Island({
          id: "i",
          slot: "main",
          initialState,
          render: () => Box({ layout: "vertical", children }),
        }),
      ],
    }),
  )
  // The document's own markup has no data-dsl-text, so counting over the whole
  // document counts only what the island contributed.
  return html
}

function marks(html: string, key?: string): number {
  const pattern = key
    ? new RegExp(`data-dsl-text="${key}"`, "g")
    : /data-dsl-text="/g
  return (html.match(pattern) ?? []).length
}

test("an empty state value marks nothing", () => {
  // An empty value matches at every position, so a naive search wraps every text
  // node on the page and each set() then overwrites all of them.
  const html = islandHTML({ tone: "", result: "" }, [
    Text({ text: "一次上传一个文件" }),
    Text({ text: "服务器必须与抓包来源一致" }),
  ])
  assert.equal(marks(html), 0, "an empty value must not produce any binding")
})

test("a value appearing as a substring of prose marks nothing", () => {
  const html = islandHTML({ tone: "ok" }, [Text({ text: "looks ok to me" })])
  assert.equal(marks(html, "tone"), 0, "a substring match is not a binding")
})

test("a text node equal to the state value is marked", () => {
  const html = islandHTML({ label: "运行中" }, [Text({ text: "运行中" })])
  assert.equal(marks(html, "label"), 1)
})

test("marking does not double-escape the text around it", () => {
  const html = islandHTML({ label: "运行中" }, [
    Text({ text: "运行中" }),
    Text({ text: 'a & b < c > d "q"' }),
  ])
  assert.doesNotMatch(html, /&amp;(amp|lt|gt|quot|#39);/, "text must be escaped once, not twice")
})

test("a value that only appears inside an attribute is not marked", () => {
  const html = islandHTML({ cls: "up-status" }, [
    Html({ html: `<div class="up-status">x</div>` }),
  ])
  assert.equal(marks(html, "cls"), 0)
})

test("a number-valued state entry still binds when a text node is exactly it", () => {
  const html = islandHTML({ n: 42 }, [Text({ text: "42" })])
  assert.equal(marks(html, "n"), 1)
})
