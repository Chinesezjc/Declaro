// A form that has to build its own request body — a multipart upload, say — must
// be able to hand submit to its Island instead of the built-in /api/form/<id>
// POST, and its fields must be able to declare an input type.

import assert from "node:assert/strict"
import { test } from "node:test"

import { Button, Env, Form, Input, Page, type ComponentNode } from "../src/dsl"
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

function formTag(html: string): string {
  const match = html.match(/<form[^>]*>/)
  assert.ok(match, "no form in output")
  return match[0]
}

test("an input declares its HTML type", () => {
  const html = compileChildren([
    Input({ name: "f", inputType: "file", accept: ".bin,.dat", slot: "main" }),
    Input({ name: "pw", inputType: "password", slot: "main" }),
  ])
  assert.match(html, /<input name="f" type="file"[^>]*accept="\.bin,\.dat"/)
  assert.match(html, /<input name="pw" type="password"/)
})

test("an input with no declared type emits no type attribute", () => {
  const html = compileChildren([Input({ name: "plain", slot: "main" })])
  assert.match(html, /<input name="plain"(?![^>]*\stype=)/)
})

test("an input emits its validation and autofill attributes", () => {
  const html = compileChildren([
    Input({
      name: "uid",
      inputMode: "numeric",
      pattern: "[0-9]+",
      autoComplete: "off",
      required: true,
      slot: "main",
    }),
  ])
  const input = html.match(/<input name="uid"[^>]*>/)?.[0] ?? ""
  assert.match(input, /inputmode="numeric"/)
  assert.match(input, /pattern="\[0-9\]\+"/)
  assert.match(input, /autocomplete="off"/)
  assert.match(input, / required/)
})

test("accept and defaultValue only apply where the browser accepts them", () => {
  // accept is meaningless off a file input, and a file input rejects a value.
  const html = compileChildren([
    Input({ name: "t", accept: ".bin", defaultValue: "keep", slot: "main" }),
    Input({ name: "f", inputType: "file", defaultValue: "/etc/passwd", slot: "main" }),
  ])
  const text = html.match(/<input name="t"[^>]*>/)?.[0] ?? ""
  const file = html.match(/<input name="f"[^>]*>/)?.[0] ?? ""
  assert.doesNotMatch(text, /accept=/)
  assert.match(text, /value="keep"/)
  assert.doesNotMatch(file, /value=/)
})

test("a hidden input skips the labelled field wrapper", () => {
  const html = compileChildren([
    Input({ name: "csrf", inputType: "hidden", defaultValue: "tok", slot: "main" }),
  ])
  assert.match(html, /<input name="csrf" type="hidden" value="tok">/)
  assert.doesNotMatch(html, /dsl-field[^>]*>\s*<span>csrf<\/span>/)
})

test("a form with an island handler submits through the island", () => {
  const html = compileChildren([
    Form({ id: "up", islandHandler: "submit", fields: [], slot: "main" }),
  ])
  const tag = formTag(html)
  assert.match(tag, /data-dsl-event="submit:submit"/)
  // The built-in POST must be gone: left in place it would navigate away when the
  // handler throws before preventDefault().
  assert.doesNotMatch(tag, /onsubmit=/)
  assert.doesNotMatch(tag, /action=/)
  assert.doesNotMatch(tag, /method=/)
})

test("a form with no island handler keeps the built-in submit", () => {
  const html = compileChildren([Form({ id: "plain", fields: [], slot: "main" })])
  const tag = formTag(html)
  assert.match(tag, /action="\/api\/form\/plain"/)
  assert.match(tag, /onsubmit="handleFormSubmit\(event,'plain'\)"/)
  assert.doesNotMatch(tag, /data-dsl-event=/)
})

test("a form's own submit button can submit it", () => {
  const html = compileChildren([
    Form({
      id: "up",
      islandHandler: "submit",
      fields: [],
      submitButton: Button({ text: "上传", variant: "primary" }),
      slot: "main",
    }),
  ])
  // type="button" would leave the form with no way to submit at all.
  assert.match(html, /<button class="dsl-button dsl-button-primary" type="submit"[^>]*>上传<\/button>/)
})

test("a button outside a form stays type=button", () => {
  const html = compileChildren([Button({ text: "x", slot: "main" })])
  assert.match(html, /<button[^>]* type="button"/)
})

test("a form id and field names are escaped", () => {
  const html = compileChildren([
    Form({
      id: 'f"><b>',
      islandHandler: 'h"><b>',
      fields: [Input({ name: 'n"><b>', accept: 'a"><b>', inputType: "file", slot: "main" })],
      slot: "main",
    }),
  ])
  // The page has its own <script> tags for the runtime, so only the form and input
  // markup is checked — an unescaped quote there would break out of the attribute.
  const tags = html.match(/<(?:form|input)[^>]*>/g) ?? []
  assert.equal(tags.length, 2)
  for (const tag of tags) {
    assert.doesNotMatch(tag, /<b>/)
    assert.match(tag, /&lt;b&gt;/)
  }
})
