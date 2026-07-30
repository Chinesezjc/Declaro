// `data` emits data-* attributes, which is what lets one island handler serve
// many controls: the handler reads event.target.closest(...).dataset and branches
// on it. Without it, a table of rows needs one handler name per row and no way to
// tell which row fired.

import assert from "node:assert/strict"
import { test } from "node:test"

import {
  Box,
  Button,
  Card,
  Env,
  Form,
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
} from "../src/dsl"
import { compilePage } from "../src/compiler/compile"

/** Compile children in isolation, without the document chrome around them. */
function compileChildren(...children: Parameters<typeof Page>[0]["children"]): string {
  return compilePage(
    Page({
      title: "t",
      env: Env({ id: "e", layout: "default", slots: ["main"] }),
      children: children.map((c) => ({ ...c, slot: "main" })),
    }),
  )
}

/** The first tag of the given name, with its attributes. */
function tag(html: string, name: string): string {
  return html.match(new RegExp(`<${name}[^>]*>`))?.[0] ?? ""
}

/**
 * The first tag carrying the given class. Needed where the tag name alone is
 * ambiguous: the document chrome contains plain divs and sections of its own.
 */
function tagWithClass(html: string, name: string, cls: string): string {
  return html.match(new RegExp(`<${name} class="${cls}[^"]*"[^>]*>`))?.[0] ?? ""
}

test("a button carries its data attributes", () => {
  const html = compileChildren(
    Button({ text: "停止", data: { action: "stop", pid: "418" } }),
  )
  const button = tag(html, "button")
  assert.match(button, /data-action="stop"/)
  assert.match(button, /data-pid="418"/)
})

test("keys are emitted verbatim, hyphens included", () => {
  // dataset camelCases on read, so data-out-dir is dataset.outDir. The attribute
  // itself must stay hyphenated or the browser will not expose it that way.
  const html = compileChildren(Button({ text: "日志", data: { "out-dir": "/runs/7" } }))
  assert.match(tag(html, "button"), /data-out-dir="\/runs\/7"/)
})

test("every component type carries data", () => {
  // Each case names the element the attribute must land on by its dsl-* class,
  // because the document chrome contains plain divs and sections of its own.
  const cases: Array<[string, string, string, string]> = [
    ["text", compileChildren(Text({ text: "x", data: { k: "v" } })), "p", "dsl-text"],
    [
      "box",
      compileChildren(Box({ layout: "vertical", children: [], data: { k: "v" } })),
      "section",
      "dsl-box",
    ],
    ["card", compileChildren(Card({ body: [], data: { k: "v" } })), "section", "dsl-card"],
    ["button", compileChildren(Button({ text: "x", data: { k: "v" } })), "button", "dsl-button"],
    ["slider", compileChildren(Slider({ name: "n", data: { k: "v" } })), "div", "dsl-slider-field"],
    ["form", compileChildren(Form({ id: "f", fields: [], data: { k: "v" } })), "form", "dsl-form"],
    [
      "table",
      compileChildren(
        Table({ dataSource: "/d", columns: [{ key: "a", title: "A" }], data: { k: "v" } }),
      ),
      "section",
      "dsl-table-card",
    ],
    ["list", compileChildren(List({ items: [], data: { k: "v" } })), "section", "dsl-list"],
    ["modal", compileChildren(Modal({ id: "m", children: [], data: { k: "v" } })), "section", "dsl-modal"],
    ["katex", compileChildren(Katex({ expression: "a", data: { k: "v" } })), "span", "dsl-katex"],
  ]
  for (const [name, html, tagName, cls] of cases) {
    assert.match(tagWithClass(html, tagName, cls), /data-k="v"/, `${name} must carry data`)
  }

  // The three fields put it on their control, which carries no class, so they are
  // matched by tag name — unambiguous inside a compiled field.
  const fields: Array<[string, string, string]> = [
    ["input", compileChildren(Input({ name: "n", data: { k: "v" } })), "input"],
    [
      "select",
      compileChildren(Select({ name: "n", options: [{ label: "a", value: "a" }], data: { k: "v" } })),
      "select",
    ],
    ["textarea", compileChildren(TextArea({ name: "n", data: { k: "v" } })), "textarea"],
  ]
  for (const [name, html, tagName] of fields) {
    assert.match(tag(html, tagName), /data-k="v"/, `${name} must carry data`)
  }
})

test("a field's data goes on its control, not its label", () => {
  // A click or change event fires on the control, so a handler reading
  // closest("[data-action]") from the event target never sees a label's data.
  const html = compileChildren(Input({ name: "n", data: { action: "touch" } }))
  assert.match(tag(html, "input"), /data-action="touch"/)
  assert.doesNotMatch(tag(html, "label"), /data-action/)
})

test("data and bind coexist on the same element", () => {
  const html = compileChildren(
    Button({ text: "x", bind: { attr: { attr: "disabled", key: "busy" } }, data: { action: "go" } }),
  )
  const button = tag(html, "button")
  assert.match(button, /data-dsl-attr="disabled:busy"/)
  assert.match(button, /data-action="go"/)
})

test("a form with an island handler keeps its data", () => {
  // The islandHandler branch of compileForm writes its own id and event
  // attributes rather than going through idAttr, so it is a separate path.
  const html = compileChildren(
    Form({ id: "f", fields: [], islandHandler: "submit", data: { action: "login" } }),
  )
  const form = tag(html, "form")
  assert.match(form, /data-dsl-event="submit:submit"/)
  assert.match(form, /data-action="login"/)
})

test("values are escaped", () => {
  const html = compileChildren(Button({ text: "x", data: { note: `a"b<c&d` } }))
  assert.match(tag(html, "button"), /data-note="a&quot;b&lt;c&amp;d"/)
})

test("no data attribute means no extra attributes", () => {
  const html = compileChildren(Button({ text: "x" }))
  assert.doesNotMatch(tag(html, "button"), /\sdata-(?!dsl-)/)
})

test("an invalid key is rejected at compile time", () => {
  // Silently emitting these would be worse than failing: the browser accepts
  // data-Foo and exposes it as dataset.foo, and a key with a space becomes two
  // attributes.
  for (const key of ["Foo", "out dir", "1st", "-x", "a_b", ""]) {
    assert.throws(
      () => compileChildren(Button({ text: "x", data: { [key]: "v" } })),
      /must match/,
      `key ${JSON.stringify(key)} must be rejected`,
    )
  }
})

test("an island does not carry data onto its own element", () => {
  // A click on the island's own element dispatches no handler — bindIslandEvents
  // matches closest("[data-dsl-event]") inside it — so data there is unreachable.
  const html = compilePage(
    Page({
      title: "t",
      env: Env({ id: "e", layout: "default", slots: ["main"] }),
      children: [
        Island({
          id: "i",
          slot: "main",
          initialState: {},
          data: { action: "nope" },
          render: () => Text({ text: "x" }),
        }),
      ],
    }),
  )
  assert.doesNotMatch(html, /data-action="nope"/)
})
