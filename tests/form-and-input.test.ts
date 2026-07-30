// A form that has to build its own request body — a multipart upload, say — must
// be able to hand submit to its Island instead of the built-in /api/form/<id>
// POST, and its fields must be able to declare an input type.

import assert from "node:assert/strict"
import { test } from "node:test"

import { Button, Env, Form, Input, Page, Select, type ComponentNode } from "../src/dsl"
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

test("an input emits its range and length bounds", () => {
  const html = compileChildren([
    Input({ name: "rounds", inputType: "number", min: 1, max: 500, step: 0.001, slot: "main" }),
    Input({ name: "pw", inputType: "password", minLength: 8, maxLength: 128, slot: "main" }),
  ])
  const rounds = html.match(/<input name="rounds"[^>]*>/)?.[0] ?? ""
  const pw = html.match(/<input name="pw"[^>]*>/)?.[0] ?? ""
  assert.match(rounds, /min="1"/)
  assert.match(rounds, /max="500"/)
  assert.match(rounds, /step="0\.001"/)
  assert.match(pw, /minlength="8"/)
  assert.match(pw, /maxlength="128"/)
})

test("a bound of 0 is emitted, and an unset bound is not", () => {
  // 0 is a bound a caller means: min="0" is what rejects a negative number, and
  // dropping it as falsy would silently accept one.
  const html = compileChildren([
    Input({ name: "wait", inputType: "number", min: 0, slot: "main" }),
    Input({ name: "free", inputType: "number", slot: "main" }),
  ])
  assert.match(html.match(/<input name="wait"[^>]*>/)?.[0] ?? "", /min="0"/)
  const free = html.match(/<input name="free"[^>]*>/)?.[0] ?? ""
  assert.doesNotMatch(free, /min=|max=|step=|minlength=|maxlength=/)
})

test("step accepts \"any\" to opt out of granularity checking", () => {
  const html = compileChildren([
    Input({ name: "rate", inputType: "number", step: "any", slot: "main" }),
  ])
  assert.match(html, /step="any"/)
})

test("a select pre-selects its defaultValue rather than the first option", () => {
  const html = compileChildren([
    Select({
      name: "difficulty",
      defaultValue: "expert",
      options: ["easy", "normal", "hard", "expert", "master"].map((v) => ({ label: v, value: v })),
      slot: "main",
    }),
  ])
  assert.match(html, /<option value="expert" selected>expert<\/option>/)
  // Exactly one option may be selected, or the browser takes the last one and the
  // declared default silently stops applying.
  assert.equal((html.match(/ selected>/g) ?? []).length, 1)
  assert.match(html, /<option value="easy">easy<\/option>/)
})

test("a select with no defaultValue marks nothing selected", () => {
  const html = compileChildren([
    Select({ name: "s", options: [{ label: "a", value: "a" }], slot: "main" }),
  ])
  assert.doesNotMatch(html, / selected/)
})

test("a select defaultValue matching no option selects nothing", () => {
  const html = compileChildren([
    Select({ name: "s", defaultValue: "zzz", options: [{ label: "a", value: "a" }], slot: "main" }),
  ])
  assert.doesNotMatch(html, / selected/)
})

test("a select option value is compared unescaped, so a quoted default still matches", () => {
  const html = compileChildren([
    Select({
      name: "s",
      defaultValue: 'a"b',
      options: [{ label: "x", value: 'a"b' }],
      slot: "main",
    }),
  ])
  assert.match(html, /<option value="a&quot;b" selected>/)
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
