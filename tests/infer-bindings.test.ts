// An Island can turn off text-binding inference. The inference marks any text
// node equal to a state value, which is a guess: an island holding
// { route: "overview" } also marks the navigation label reading "overview", and
// every set() then rewrites that label to the current route.

import assert from "node:assert/strict"
import { test } from "node:test"

import { Box, Env, Island, Page, Text } from "../src/dsl"
import { compilePage } from "../src/compiler/compile"

/** A rail whose labels collide with the state that tracks the current route. */
function routeRail(inferBindings?: boolean): string {
  return compilePage(
    Page({
      title: "t",
      env: Env({ id: "e", layout: "default", slots: ["main"] }),
      children: [
        Island({
          id: "shell",
          slot: "main",
          initialState: { route: "overview" },
          inferBindings,
          render: () =>
            Box({
              layout: "vertical",
              children: [
                Text({ text: "overview" }),
                Text({ text: "", bind: { text: "route" } }),
              ],
            }),
        }),
      ],
    }),
  )
}

test("inference is on by default", () => {
  const html = routeRail()
  assert.match(html, /<span data-dsl-text="route">overview<\/span>/)
})

test("inferBindings false leaves a colliding label alone", () => {
  const html = routeRail(false)
  assert.doesNotMatch(html, /<span data-dsl-text="route">/)
  // The label still renders; it just is not bound.
  assert.match(html, />overview</)
})

test("declared bindings survive with inference off", () => {
  // Turning the inference off is only usable if `bind` still works, since that is
  // what the page uses instead.
  const html = routeRail(false)
  assert.match(html, /<p class="dsl-text dsl-text-body" data-dsl-text="route">/)
})

test("inferBindings true is the same as omitting it", () => {
  assert.equal(routeRail(true), routeRail())
})
