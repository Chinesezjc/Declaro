// Auto-register all built-in Declaro components at import time.
// Plugin components (third-party) call defineComponent() in their own modules.

import { defineComponent } from "./plugin"
import type { BoxNode } from "./components/box"
import type { ButtonNode } from "./components/button"
import type { CardNode } from "./components/card"
import type { FormNode } from "./components/form"
import type { HtmlNode } from "./components/html"
import type { InputNode } from "./components/input"
import type { KatexNode } from "./components/katex"
import type { ListNode } from "./components/list"
import type { ModalNode } from "./components/modal"
import type { ScriptNode } from "./components/script"
import type { SelectNode } from "./components/select"
import type { SliderNode } from "./components/slider"
import type { TableNode } from "./components/table"
import type { TextNode } from "./components/text"
import type { TextAreaNode } from "./components/textarea"
import type { ComponentNode } from "./component"

// Compile functions — imported lazily to avoid circular deps.
// These are set up by the compiler module calling registerBuiltinCompilers().
type CompileFn = (node: ComponentNode) => string
let compileFns: Record<string, CompileFn> = {}

export function registerBuiltinCompilers(fns: Record<string, CompileFn>): void {
  compileFns = { ...compileFns, ...fns }
}

function compile(name: string, node: ComponentNode): string {
  return compileFns[name]?.(node) ?? ""
}

// Children extraction for tree walking
function empty(_n: ComponentNode): ComponentNode[] { return [] }

defineComponent({ type: "box", compile: (n) => compile("box", n), nested: (n) => [...((n as BoxNode).titleActions ?? []), ...(n as BoxNode).children] })
defineComponent({ type: "button", compile: (n) => compile("button", n), nested: empty })
defineComponent({ type: "card", compile: (n) => compile("card", n), nested: (n) => [...((n as CardNode).titleActions ?? []), ...((n as CardNode).header ?? []), ...((n as CardNode).body ?? []), ...((n as CardNode).footer ?? [])] })
defineComponent({ type: "form", compile: (n) => compile("form", n), nested: (n) => [...(n as FormNode).fields, ...((n as FormNode).submitButton ? [(n as FormNode).submitButton!] : [])] })
defineComponent({ type: "html", compile: (n) => (n as HtmlNode).html, nested: empty })
defineComponent({ type: "input", compile: (n) => compile("input", n), nested: empty })
defineComponent({ type: "katex", compile: (n) => compile("katex", n), nested: empty })
defineComponent({ type: "list", compile: (n) => compile("list", n), nested: (n) => [...((n as ListNode).loading ?? []), ...((n as ListNode).empty ?? [])] })
defineComponent({ type: "modal", compile: (n) => compile("modal", n), nested: (n) => [...(n as ModalNode).children] })
defineComponent({ type: "script", compile: (n) => compile("script", n), nested: empty })
defineComponent({ type: "select", compile: (n) => compile("select", n), nested: empty })
defineComponent({ type: "slider", compile: (n) => compile("slider", n), nested: empty })
defineComponent({ type: "table", compile: (n) => compile("table", n), nested: (n) => [...((n as TableNode).titleActions ?? []), ...((n as TableNode).rowActions ?? [])] })
defineComponent({ type: "text", compile: (n) => compile("text", n), nested: (n) => [...((n as TextNode).titleActions ?? [])] })
defineComponent({ type: "textarea", compile: (n) => compile("textarea", n), nested: empty })
