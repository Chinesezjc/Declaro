// A component's declared id has to reach the HTML as an id attribute, or a
// fragment link cannot target it. And the KaTeX stylesheet is an external
// request, so it must only appear when the page has a formula.

import assert from "node:assert/strict"
import { test } from "node:test"

import {
  Box,
  Button,
  Card,
  Env,
  Form,
  Input,
  Katex,
  List,
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

test("every component emits its declared id", () => {
  const html = compileChildren([
    Text({ id: "a-text", text: "x", slot: "main" }),
    Text({
      id: "a-text-actions",
      text: "y",
      slot: "main",
      titleActions: [Button({ text: "b" })],
    }),
    Box({ id: "a-box", slot: "main", children: [] }),
    Card({ id: "a-card", slot: "main", body: [] }),
    Button({ id: "a-button", text: "c", slot: "main" }),
    Input({ id: "a-input", name: "i", slot: "main" }),
    Select({ id: "a-select", name: "s", options: [], slot: "main" }),
    TextArea({ id: "a-textarea", name: "ta", slot: "main" }),
    Slider({ id: "a-slider", name: "sl", slot: "main" }),
    Table({ id: "a-table", dataSource: "/d", columns: [Column("k", "K")], slot: "main" }),
    List({ id: "a-list", slot: "main", renderItem: () => Text({ text: "i" }) }),
    Form({ id: "a-form", fields: [], slot: "main" }),
  ])

  for (const id of [
    "a-text",
    "a-text-actions",
    "a-box",
    "a-card",
    "a-button",
    "a-input",
    "a-select",
    "a-textarea",
    "a-slider",
    "a-table",
    "a-list",
    "a-form",
  ]) {
    assert.equal(
      html.includes(`id="${id}"`),
      true,
      `id ${id} did not reach the output — a fragment link to it would not resolve`,
    )
  }
})

test("a component without an id emits no id attribute", () => {
  const html = compileChildren([Card({ title: "no id", slot: "main", body: [] })])
  assert.match(html, /<section class="dsl-card">/)
})

test("an id with HTML-special characters is escaped", () => {
  const html = compileChildren([Box({ id: 'x"y<z', slot: "main", children: [] })])
  assert.match(html, /id="x&quot;y&lt;z"/)
})

test("a title with actions puts the id on the wrapper, not the heading", () => {
  const html = compileChildren([
    Text({ id: "hdr", text: "h", variant: "title", slot: "main", titleActions: [Button({ text: "b" })] }),
  ])
  // The wrapper is the outermost element, so the fragment link lands on the
  // heading and its actions together.
  assert.match(html, /<div class="dsl-titlebar" id="hdr">/)
  assert.doesNotMatch(html, /<h1[^>]*id="hdr"/)
})

test("the KaTeX stylesheet is absent from a page with no formula", () => {
  const html = compileChildren([Text({ text: "no math here", slot: "main" })])
  assert.doesNotMatch(html, /katex\.min\.css/)
  // No tag may reference an external origin either. The inlined runtime bundle
  // holds CDN URLs as string literals, so only tag attributes are checked.
  assert.deepEqual(html.match(/<(?:link|script)[^>]*(?:href|src)="https?:\/\/[^"]*"/g), null)
})

test("the KaTeX stylesheet appears once a formula is on the page", () => {
  const html = compileChildren([Katex({ expression: "x^2", slot: "main" })])
  assert.match(html, /katex\.min\.css/)
})

test("a formula nested inside a container still pulls the stylesheet in", () => {
  const html = compileChildren([
    Card({ slot: "main", body: [Box({ children: [Katex({ expression: "y^2" })] })] }),
  ])
  assert.match(html, /katex\.min\.css/)
})

test("compiling the same page twice produces identical output", () => {
  // Collapsible containers used to embed Math.random() in an attribute, which
  // made the build non-reproducible.
  const build = () =>
    compileChildren([
      Card({ title: "c", slot: "main", collapsible: true, body: [] }),
      Box({ title: "b", slot: "main", collapsible: true, children: [] }),
    ])
  assert.equal(build(), build())
})
