// data-dsl-attr-value writes a state value into an attribute. data-dsl-attr cannot:
// it only ever sets the empty string, which is what a boolean attribute wants but
// useless for an attribute whose value gets read (a data-* attribute a CSS selector
// matches on, for one).
//
// syncBindings only uses querySelectorAll/getAttribute/setAttribute/removeAttribute
// off the nodes it touches, so these tests drive it with stubs instead of pulling in
// a DOM implementation for one binding.

import assert from "node:assert/strict"
import { test } from "node:test"

import { syncBindings } from "../src/runtime/dom"

type StubElement = {
  attrs: Record<string, string>
  getAttribute(name: string): string | null
  setAttribute(name: string, value: string): void
  removeAttribute(name: string): void
  classList: { toggle(cls: string, on: boolean): void }
  style: Record<string, string>
}

function element(attrs: Record<string, string>): StubElement {
  return {
    attrs: { ...attrs },
    getAttribute(name) {
      return name in this.attrs ? this.attrs[name] : null
    },
    setAttribute(name, value) {
      this.attrs[name] = value
    },
    removeAttribute(name) {
      delete this.attrs[name]
    },
    classList: { toggle: () => {} },
    style: {},
  }
}

/**
 * A root that hands each binding selector the elements carrying that attribute.
 *
 * matches() reports false: syncBindings also checks whether the scope element
 * itself carries a binding, which matters for a list row but not for a root that
 * only stands in for the container.
 */
function root(elements: StubElement[]): HTMLElement {
  return {
    querySelectorAll: (selector: string) => {
      const name = selector.slice(1, -1)
      return elements.filter((el) => name in el.attrs)
    },
    matches: () => false,
  } as unknown as HTMLElement
}

test("the binding writes the state value into the attribute", () => {
  const el = element({ "data-dsl-attr-value": "data-tone:tone" })
  syncBindings(root([el]), { tone: "error" })
  assert.equal(el.attrs["data-tone"], "error")
})

test("a non-string value is stringified", () => {
  const el = element({ "data-dsl-attr-value": "data-count:n" })
  syncBindings(root([el]), { n: 3 })
  assert.equal(el.attrs["data-count"], "3")
})

test("an empty or absent value removes the attribute", () => {
  for (const state of [{ tone: "" }, {}]) {
    const el = element({ "data-dsl-attr-value": "data-tone:tone", "data-tone": "error" })
    syncBindings(root([el]), state)
    assert.equal("data-tone" in el.attrs, false, `state ${JSON.stringify(state)} must remove it`)
  }
})

test("the attribute name may contain no colon, so only the first one splits", () => {
  const el = element({ "data-dsl-attr-value": "data-tone:a:b" })
  syncBindings(root([el]), { "a:b": "ok" })
  assert.equal(el.attrs["data-tone"], "ok")
})

test("a spec without a colon is ignored rather than setting a nameless attribute", () => {
  const el = element({ "data-dsl-attr-value": "tone" })
  syncBindings(root([el]), { tone: "error" })
  assert.deepEqual(Object.keys(el.attrs), ["data-dsl-attr-value"])
})

test("data-dsl-attr still sets the empty string, so boolean attributes keep working", () => {
  const el = element({ "data-dsl-attr": "disabled:busy" })
  syncBindings(root([el]), { busy: true })
  assert.equal(el.attrs.disabled, "")
})
