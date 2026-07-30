// A component declares its reactive bindings with `bind`, and the compiler emits
// the data-dsl-* attributes the runtime syncs. Without it a page can only get a
// binding by hand-writing the element in Html(), and cannot bind a field the
// compiler's own text-binding inference misses — one whose initial value is empty,
// or whose text is a substring of surrounding prose.

import assert from "node:assert/strict"
import { test } from "node:test"

import {
  Box,
  Button,
  Card,
  Env,
  Form,
  Input,
  Page,
  Select,
  Text,
  TextArea,
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

/** The first tag of the given name in the output. */
function tag(html: string, name: string): string {
  const match = html.match(new RegExp(`<${name}[^>]*>`))
  assert.ok(match, `no <${name}> in output`)
  return match[0]
}

test("each binding kind emits its data-dsl attribute", () => {
  const html = compileChildren([
    Text({ text: "x", slot: "main", bind: { text: "status" } }),
    Text({ text: "y", slot: "main", bind: { html: "detail" } }),
    Box({ layout: "vertical", children: [], slot: "main", bind: { show: "hasResult" } }),
    Box({ layout: "vertical", children: [], slot: "main", bind: { list: "rows" } }),
  ])
  assert.match(html, /data-dsl-text="status"/)
  assert.match(html, /data-dsl-html="detail"/)
  assert.match(html, /data-dsl-show="hasResult"/)
  assert.match(html, /data-dsl-list="rows"/)
})

test("a class binding pairs the class with the state key", () => {
  const html = compileChildren([
    Text({ text: "x", slot: "main", bind: { class: { cls: "active", key: "isOn" } } }),
  ])
  assert.match(html, /data-dsl-class="active:isOn"/)
})

test("an attr binding emits presence form, and equals form when given", () => {
  const html = compileChildren([
    Button({ text: "go", slot: "main", bind: { attr: { attr: "disabled", key: "busy" } } }),
    Button({
      text: "stop",
      slot: "main",
      bind: { attr: { attr: "disabled", key: "status", equals: "idle" } },
    }),
  ])
  assert.match(html, /data-dsl-attr="disabled:busy"/)
  assert.match(html, /data-dsl-attr="disabled:status=idle"/)
})

test("an attrValue binding is distinct from attr", () => {
  // data-dsl-attr can only set the empty string, so an attribute whose value is
  // read — a data-* a CSS selector matches on — needs the value form.
  const html = compileChildren([
    Text({ text: "x", slot: "main", bind: { attrValue: { attr: "data-tone", key: "tone" } } }),
  ])
  assert.match(html, /data-dsl-attr-value="data-tone:tone"/)
  assert.doesNotMatch(html, /data-dsl-attr="/)
})

test("several bindings on one component all land on the same element", () => {
  const html = compileChildren([
    Text({
      text: "x",
      slot: "main",
      bind: {
        text: "result",
        show: "hasResult",
        attrValue: { attr: "data-tone", key: "tone" },
      },
    }),
  ])
  const p = tag(html, "p")
  assert.match(p, /data-dsl-text="result"/)
  assert.match(p, /data-dsl-show="hasResult"/)
  assert.match(p, /data-dsl-attr-value="data-tone:tone"/)
})

test("a component with no bind emits no data-dsl attributes", () => {
  const html = compileChildren([Text({ text: "x", slot: "main" })])
  assert.doesNotMatch(tag(html, "p"), /data-dsl-/)
})

test("a field binds its control, not the label around it", () => {
  // disabled on a <label> does nothing; it has to reach the control.
  const html = compileChildren([
    Input({ name: "uid", slot: "main", bind: { attr: { attr: "disabled", key: "busy" } } }),
    Select({
      name: "server",
      options: [{ label: "jp", value: "jp" }],
      slot: "main",
      bind: { attr: { attr: "disabled", key: "busy" } },
    }),
    TextArea({ name: "body", slot: "main", bind: { attr: { attr: "disabled", key: "busy" } } }),
  ])
  for (const name of ["input", "select", "textarea"]) {
    assert.match(tag(html, name), /data-dsl-attr="disabled:busy"/, `${name} must carry the binding`)
  }
  assert.doesNotMatch(tag(html, "label"), /data-dsl-/)
})

test("a field keeps its id on the label while the binding goes on the control", () => {
  const html = compileChildren([
    Input({ id: "f-uid", name: "uid", slot: "main", bind: { attr: { attr: "disabled", key: "busy" } } }),
  ])
  assert.match(tag(html, "label"), /id="f-uid"/)
  assert.doesNotMatch(tag(html, "input"), /id=/)
})

test("a Text with titleActions binds the text, not the title bar", () => {
  // A text binding on the title bar would replace the action buttons with the
  // state value on the first set().
  const html = compileChildren([
    Text({
      id: "head",
      text: "总览",
      slot: "main",
      titleActions: [Button({ text: "查看JSON" })],
      bind: { text: "heading" },
    }),
  ])
  const titlebar = html.match(/<div class="dsl-titlebar"[^>]*>/)?.[0] ?? ""
  assert.match(titlebar, /id="head"/)
  assert.doesNotMatch(titlebar, /data-dsl-/)
  assert.match(tag(html, "p"), /data-dsl-text="heading"/)
  assert.match(html, /查看JSON/)
})

test("a Card and a Box bind their outer section, keeping their id", () => {
  const html = compileChildren([
    Card({ id: "c", title: "t", slot: "main", bind: { show: "onRoute" } }),
    Box({ id: "b", layout: "vertical", children: [], slot: "main", bind: { show: "onRoute" } }),
  ])
  for (const id of ["c", "b"]) {
    const section = html.match(new RegExp(`<section[^>]*id="${id}"[^>]*>`))?.[0] ?? ""
    assert.match(section, /data-dsl-show="onRoute"/)
  }
})

test("a form binds without losing its submit wiring", () => {
  const withIsland = compileChildren([
    Form({ id: "f1", islandHandler: "submit", fields: [], slot: "main", bind: { show: "onRoute" } }),
  ])
  const island = tag(withIsland, "form")
  assert.match(island, /data-dsl-event="submit:submit"/)
  assert.match(island, /data-dsl-show="onRoute"/)

  const plain = tag(
    compileChildren([Form({ id: "f2", fields: [], slot: "main", bind: { show: "onRoute" } })]),
    "form",
  )
  assert.match(plain, /action="\/api\/form\/f2"/)
  assert.match(plain, /data-dsl-show="onRoute"/)
})

test("a state key and a class name are escaped", () => {
  const html = compileChildren([
    Text({
      text: "x",
      slot: "main",
      bind: {
        text: 'k"><b>',
        class: { cls: 'c"><b>', key: 'k"><b>' },
        attr: { attr: 'a"><b>', key: 'k"><b>' },
      },
    }),
  ])
  const p = tag(html, "p")
  assert.doesNotMatch(p, /<b>/)
  assert.match(p, /&lt;b&gt;/)
})
