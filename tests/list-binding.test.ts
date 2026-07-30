// data-dsl-list renders an array from a <template data-dsl-list-item>, and it is
// how a table of rows gets its body. These are the first tests to exercise the
// runtime rather than the compiler's output, so they build a DOM with jsdom and
// call syncBindings directly.
//
// Three defects motivated them, each caught in a real browser first:
//
//   - Each item was wrapped in a <div> whose innerHTML was assigned, so a <tr>
//     template produced two DIVs and zero rows: neither <tr> nor <li> is allowed
//     inside a div, and the parser discards what it cannot place.
//   - {{prop}} was substituted into an HTML string, so a value containing < or &
//     became markup. A row named `a<b>c` rendered a real <b> element.
//   - The previous render was cleared by removing everything matching
//     [data-dsl-list-item], which matched the template too. After one render —
//     including a render of an empty array — the template was gone and every
//     later render returned early, freezing the list.

import assert from "node:assert/strict"
import { test } from "node:test"

import { JSDOM } from "jsdom"

import { syncBindings } from "../src/runtime/dom"

/**
 * Install a jsdom document as the globals the runtime reads, and return the
 * element the given markup describes.
 *
 * syncBindings reaches for `document`, `NodeFilter` and `getComputedStyle` off
 * the global object, so they are assigned rather than passed.
 */
function mount(html: string): { root: HTMLElement; window: JSDOM["window"] } {
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`)
  const g = globalThis as Record<string, unknown>
  g.document = dom.window.document
  g.NodeFilter = dom.window.NodeFilter
  g.Node = dom.window.Node
  return { root: dom.window.document.body, window: dom.window }
}

/** A tbody whose rows come from a <tr> template — the dashboard's table shape. */
const TABLE = `<table><tbody id="b" data-dsl-list="rows">
  <template data-dsl-list-item><tr><td class="nm">{{name}}</td><td class="pid">{{pid}}</td></tr></template>
</tbody></table>`

test("a tr template puts rows in the tbody, not wrapper divs", () => {
  // The wrapper div made this produce zero <tr> and two <div>, so a table body
  // rendered as unstyled text with its columns run together.
  const { root } = mount(TABLE)
  syncBindings(root, { rows: [{ name: "a", pid: "1" }, { name: "b", pid: "2" }] })

  const tbody = root.querySelector("#b")!
  const rows = tbody.querySelectorAll("tr")
  assert.equal(rows.length, 2)
  assert.equal(rows[0].querySelector("td.nm")!.textContent, "a")
  assert.equal(rows[0].querySelector("td.pid")!.textContent, "1")
  assert.equal(rows[1].querySelector("td.nm")!.textContent, "b")
  // No div came along to break the table's structure.
  assert.equal(tbody.querySelectorAll("div").length, 0)
})

test("an li template puts items directly in the ul", () => {
  const { root } = mount(`<ul id="l" data-dsl-list="rows">
    <template data-dsl-list-item><li>{{name}}</li></template>
  </ul>`)
  syncBindings(root, { rows: [{ name: "one" }] })

  const items = root.querySelectorAll("#l > li")
  assert.equal(items.length, 1)
  assert.equal(items[0].textContent, "one")
})

test("each rendered item is marked with its index", () => {
  const { root } = mount(TABLE)
  syncBindings(root, { rows: [{ name: "a" }, { name: "b" }, { name: "c" }] })

  const marked = root.querySelectorAll("tr[data-dsl-list-item]")
  assert.equal(marked.length, 3)
  assert.deepEqual(
    Array.from(marked).map((el) => el.getAttribute("data-dsl-list-index")),
    ["0", "1", "2"],
  )
})

test("a value containing markup stays text", () => {
  // Assigning innerHTML made every value an injection point: this rendered a
  // real <b> element, and a value could close its tag and add attributes.
  const { root } = mount(TABLE)
  syncBindings(root, { rows: [{ name: "a<b>c", pid: "x&y" }] })

  const nm = root.querySelector("td.nm")!
  assert.equal(nm.textContent, "a<b>c")
  assert.equal(nm.querySelector("b"), null)
  assert.equal(root.querySelector("td.pid")!.textContent, "x&y")
})

test("a value in an attribute is substituted and escaped", () => {
  // A row's data-* is what an island handler reads to know which row fired, so
  // an unsubstituted {{pid}} there is a broken action, not just broken text.
  const { root } = mount(`<div id="l" data-dsl-list="rows">
    <template data-dsl-list-item><button data-action="stop" data-pid="{{pid}}" title="{{name}}"></button></template>
  </div>`)
  syncBindings(root, { rows: [{ pid: "418", name: 'a"b' }] })

  const button = root.querySelector("button")!
  assert.equal(button.getAttribute("data-pid"), "418")
  assert.equal(button.dataset.pid, "418")
  // Assigned as an attribute value, so the quote cannot end the attribute.
  assert.equal(button.getAttribute("title"), 'a"b')
})

test("a second render replaces the rows rather than appending", () => {
  // Every WebSocket message calls set(), so a list that appends grows without
  // bound and one that stops rendering never updates.
  const { root } = mount(TABLE)
  syncBindings(root, { rows: [{ name: "first" }] })
  syncBindings(root, { rows: [{ name: "second" }, { name: "third" }] })

  const rows = root.querySelectorAll("tbody tr")
  assert.equal(rows.length, 2)
  assert.deepEqual(
    Array.from(rows).map((r) => r.querySelector("td.nm")!.textContent),
    ["second", "third"],
  )
})

test("the template survives a render, including a render of nothing", () => {
  // The clearing sweep matched the template, so one render removed it and every
  // later render found none and returned. An empty array was enough.
  const { root } = mount(TABLE)
  const template = () => root.querySelector("template[data-dsl-list-item]")

  syncBindings(root, { rows: [] })
  assert.ok(template(), "an empty render must keep the template")

  syncBindings(root, { rows: [{ name: "a" }] })
  assert.ok(template(), "a non-empty render must keep the template")
  assert.equal(root.querySelectorAll("tbody tr").length, 1)
})

test("rendering an empty array after rows clears them", () => {
  const { root } = mount(TABLE)
  syncBindings(root, { rows: [{ name: "a" }, { name: "b" }] })
  syncBindings(root, { rows: [] })

  assert.equal(root.querySelectorAll("tbody tr").length, 0)
  assert.ok(root.querySelector("template[data-dsl-list-item]"))
})

test("the template is kept out of layout by an inline style", () => {
  // It stays in the DOM carrying data-dsl-list-item, so a page rule keyed on that
  // attribute matches it and overrides the display:none a <template> gets from
  // the UA stylesheet. An inline style outranks the page rule.
  const { root, window } = mount(
    `<style>[data-dsl-list-item] { display: block; padding: 8px }</style>${TABLE}`,
  )
  syncBindings(root, { rows: [{ name: "a" }] })

  const template = root.querySelector("template[data-dsl-list-item]") as HTMLElement
  assert.equal(template.style.display, "none")
  assert.equal(window.getComputedStyle(template).display, "none")
})

test("a list of strings fills {{_value}}", () => {
  const { root } = mount(`<ul id="l" data-dsl-list="rows">
    <template data-dsl-list-item><li>{{_value}}</li></template>
  </ul>`)
  syncBindings(root, { rows: ["a", "b"] })

  assert.deepEqual(
    Array.from(root.querySelectorAll("#l > li")).map((el) => el.textContent),
    ["a", "b"],
  )
})

test("an absent property renders empty, not as its placeholder", () => {
  // A row missing a field should render blank rather than showing {{pid}} to the
  // user, and a null should not print as "null".
  const { root } = mount(TABLE)
  syncBindings(root, { rows: [{ name: "a", pid: null }] })

  assert.equal(root.querySelector("td.pid")!.textContent, "")
})

test("a non-array value renders nothing and keeps the previous rows", () => {
  // An endpoint that returns an error object instead of a list should not blank
  // the table it was feeding.
  const { root } = mount(TABLE)
  syncBindings(root, { rows: [{ name: "a" }] })
  syncBindings(root, { rows: { detail: "unauthorized" } })

  assert.equal(root.querySelectorAll("tbody tr").length, 1)
})

test("a container with no template renders nothing", () => {
  const { root } = mount(`<ul id="l" data-dsl-list="rows"></ul>`)
  syncBindings(root, { rows: [{ name: "a" }] })

  assert.equal(root.querySelector("#l")!.children.length, 0)
})

test("two lists on one page render independently", () => {
  // listRenders is keyed by container, so one list's rows must not be cleared by
  // the other's render.
  const { root } = mount(`<ul id="a" data-dsl-list="xs">
      <template data-dsl-list-item><li>{{v}}</li></template>
    </ul>
    <ul id="b" data-dsl-list="ys">
      <template data-dsl-list-item><li>{{v}}</li></template>
    </ul>`)
  syncBindings(root, { xs: [{ v: "x1" }], ys: [{ v: "y1" }, { v: "y2" }] })

  assert.equal(root.querySelectorAll("#a > li").length, 1)
  assert.equal(root.querySelectorAll("#b > li").length, 2)

  syncBindings(root, { xs: [{ v: "x1" }, { v: "x2" }], ys: [{ v: "y1" }, { v: "y2" }] })
  assert.equal(root.querySelectorAll("#a > li").length, 2)
  assert.equal(root.querySelectorAll("#b > li").length, 2)
})

test("data-dsl-item-attr sets a boolean attribute per row", () => {
  // Which rows offer an action is a per-row question, and data-dsl-attr answers
  // it from island state, so it would disable every row or none.
  const { root } = mount(`<table><tbody id="b" data-dsl-list="rows">
    <template data-dsl-list-item><tr><td>
      <button data-dsl-item-attr="disabled:locked">start</button>
    </td></tr></template>
  </tbody></table>`)
  syncBindings(root, { rows: [{ locked: true }, { locked: false }] })

  const buttons = root.querySelectorAll("button")
  assert.equal(buttons.length, 2)
  assert.equal(buttons[0].hasAttribute("disabled"), true)
  assert.equal(buttons[1].hasAttribute("disabled"), false)
})

test("data-dsl-item-attr treats an absent property, \"false\" and 0 as off", () => {
  // A row's flag arrives through String(), so a boolean false and a numeric 0
  // both reach the attribute as text that is nonetheless not a truthy flag.
  const { root } = mount(`<ul id="l" data-dsl-list="rows">
    <template data-dsl-list-item><li data-dsl-item-attr="hidden:gone"></li></template>
  </ul>`)
  syncBindings(root, { rows: [{}, { gone: false }, { gone: 0 }, { gone: "" }, { gone: "yes" }] })

  const items = root.querySelectorAll("#l > li")
  assert.deepEqual(
    Array.from(items).map((el) => el.hasAttribute("hidden")),
    [false, false, false, false, true],
  )
})

test("data-dsl-item-attr sets several attributes from one spec", () => {
  const { root } = mount(`<ul id="l" data-dsl-list="rows">
    <template data-dsl-list-item><li data-dsl-item-attr="disabled:a hidden:b"></li></template>
  </ul>`)
  syncBindings(root, { rows: [{ a: 1, b: 0 }] })

  const li = root.querySelector("#l > li")!
  assert.equal(li.hasAttribute("disabled"), true)
  assert.equal(li.hasAttribute("hidden"), false)
})

test("a template with several top-level nodes marks each of them", () => {
  // A two-row template is how a table shows a detail row under each entry.
  // Wrapped in a <table>: a bare <tbody> is not allowed as a child of <body>, so
  // the parser drops it and the list container never exists.
  const { root } = mount(`<table><tbody id="b" data-dsl-list="rows">
    <template data-dsl-list-item><tr class="main"><td>{{name}}</td></tr><tr class="detail"><td>{{note}}</td></tr></template>
  </tbody></table>`)
  syncBindings(root, { rows: [{ name: "a", note: "n1" }] })

  assert.equal(root.querySelectorAll("tr.main").length, 1)
  assert.equal(root.querySelectorAll("tr.detail").length, 1)
  assert.equal(root.querySelector("tr.detail td")!.textContent, "n1")

  // Both are tracked, so the next render removes both rather than leaving one.
  syncBindings(root, { rows: [{ name: "b", note: "n2" }] })
  assert.equal(root.querySelectorAll("tr.main").length, 1)
  assert.equal(root.querySelectorAll("tr.detail").length, 1)
  assert.equal(root.querySelector("tr.main td")!.textContent, "b")
})
