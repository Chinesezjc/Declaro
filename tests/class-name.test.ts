// `className` appends classes to a component's outermost element, so a page can
// reach a stylesheet that keys on its own names. Without it, a design whose CSS
// is written against .panel / .btn.primary / .align-end cannot be expressed in
// the DSL at all -- every styled element would have to be hand-written in Html().

import assert from "node:assert/strict"
import { test } from "node:test"

import {
  Box,
  Button,
  Card,
  Env,
  Form,
  Html,
  Input,
  Island,
  Katex,
  List,
  Modal,
  Page,
  Select,
  Slider,
  Table,
  Text,
  TextArea,
  Column,
  type ComponentNode,
} from "../src/dsl"
import { compilePage } from "../src/compiler/compile"

function compileChildren(children: ComponentNode[]): string {
  return compilePage(
    Page({
      title: "t",
      env: Env({ id: "e", layout: "default", slots: ["main"] }),
      children,
    }),
  )
}

/** The first tag carrying the given class, so an assertion cannot match page chrome. */
function withClass(html: string, cls: string): string {
  const match = html.match(new RegExp(`<[a-z]+[^>]*class="[^"]*\\b${cls}\\b[^"]*"[^>]*>`))
  assert.ok(match, `no element with class ${cls} in output`)
  return match[0]
}

test("every component appends className to its outermost element", () => {
  // One case per compiler: a component whose class list the port cannot reach is
  // a component the page has to hand-write.
  const cases: Array<[string, ComponentNode]> = [
    ["text", Text({ text: "x", slot: "main", className: "c-text" })],
    ["box", Box({ layout: "vertical", children: [], slot: "main", className: "c-box" })],
    ["card", Card({ title: "t", slot: "main", className: "c-card" })],
    ["button", Button({ text: "b", slot: "main", className: "c-button" })],
    ["input", Input({ name: "i", slot: "main", className: "c-input" })],
    ["select", Select({ name: "s", options: [{ label: "a", value: "a" }], slot: "main", className: "c-select" })],
    ["textarea", TextArea({ name: "ta", slot: "main", className: "c-textarea" })],
    ["slider", Slider({ name: "sl", slot: "main", className: "c-slider" })],
    ["form", Form({ id: "f", fields: [], slot: "main", className: "c-form" })],
    ["table", Table({ dataSource: "/d", columns: [Column("a", "A")], slot: "main", className: "c-table" })],
    ["list", List({ items: [], slot: "main", className: "c-list" })],
    ["modal", Modal({ id: "m", children: [], slot: "main", className: "c-modal" })],
    ["katex", Katex({ expression: "x", slot: "main", className: "c-katex" })],
    [
      "island",
      Island({
        id: "isl",
        slot: "main",
        initialState: {},
        render: () => Text({ text: "inner" }),
        className: "c-island",
      }),
    ],
  ]
  for (const [name, node] of cases) {
    const html = compileChildren([node])
    assert.match(html, new RegExp(`class="[^"]*\\bc-${name}\\b`), `${name} must carry its className`)
  }
})

test("the component's own dsl classes survive alongside the extra ones", () => {
  // Additive, not replacing: the dsl-* classes are where the component's own
  // styling comes from, so dropping them would strip it.
  const html = compileChildren([Button({ text: "b", slot: "main", className: "btn primary" })])
  const button = withClass(html, "primary")
  assert.match(button, /dsl-button/)
  assert.match(button, /dsl-button-secondary/)
  assert.match(button, /class="dsl-button dsl-button-secondary btn primary"/)
})

test("several classes are passed through space-separated", () => {
  const html = compileChildren([Box({ layout: "vertical", children: [], slot: "main", className: "panel stack wide" })])
  assert.match(withClass(html, "panel"), /class="[^"]*panel stack wide"/)
})

test("a component with no className emits only its dsl classes", () => {
  const html = compileChildren([Box({ layout: "vertical", children: [], slot: "main" })])
  assert.match(html, /class="dsl-box dsl-box-vertical"/)
})

test("an empty or whitespace className adds nothing", () => {
  // A page computing a class list can end up with "" and should not get a
  // trailing space in the attribute.
  for (const value of ["", "   "]) {
    const html = compileChildren([Box({ layout: "vertical", children: [], slot: "main", className: value })])
    assert.match(html, /class="dsl-box dsl-box-vertical"/)
  }
})

test("a field's className goes on the label, not the control", () => {
  // The label is the grid item a form positions, so .align-end has to land there.
  // This is the opposite of `bind`, which targets the control.
  const html = compileChildren([
    Input({ name: "count", slot: "main", className: "align-end", bind: { attr: { attr: "disabled", key: "busy" } } }),
  ])
  const label = withClass(html, "align-end")
  assert.match(label, /^<label/)
  assert.doesNotMatch(label, /data-dsl-attr/)
  assert.match(html.match(/<input[^>]*>/)![0], /data-dsl-attr="disabled:busy"/)
  assert.doesNotMatch(html.match(/<input[^>]*>/)![0], /align-end/)
})

test("a Text with titleActions puts className on the title bar", () => {
  // The title bar is the outermost element, so a layout class belongs there;
  // putting it on the inner text would leave the action buttons unpositioned.
  const html = compileChildren([
    Text({ text: "总览", slot: "main", className: "section-head", titleActions: [Button({ text: "查看JSON" })] }),
  ])
  const bar = withClass(html, "section-head")
  assert.match(bar, /dsl-titlebar/)
  assert.doesNotMatch(html.match(/<p class="[^"]*"/)![0], /section-head/)
})

test("a form keeps its submit wiring while carrying a className", () => {
  const island = compileChildren([
    Form({ id: "f1", islandHandler: "submit", fields: [], slot: "main", className: "stack" }),
  ])
  const form = withClass(island, "stack")
  assert.match(form, /data-dsl-event="submit:submit"/)
  assert.match(form, /id="f1"/)

  const plain = withClass(compileChildren([Form({ id: "f2", fields: [], slot: "main", className: "stack" })]), "stack")
  assert.match(plain, /action="\/api\/form\/f2"/)
})

test("a class name is escaped", () => {
  const html = compileChildren([Box({ layout: "vertical", children: [], slot: "main", className: 'a"><script>x' })])
  assert.doesNotMatch(html, /<script>x/)
  assert.match(html, /&quot;&gt;&lt;script&gt;x/)
})

test("Html and Script are unaffected by className", () => {
  // Html writes its own markup, so there is no element the compiler could add a
  // class to without rewriting the string it was handed.
  const html = compileChildren([Html({ html: "<p>raw</p>", slot: "main", className: "ignored" })])
  assert.match(html, /<p>raw<\/p>/)
  assert.doesNotMatch(html, /ignored/)
})
