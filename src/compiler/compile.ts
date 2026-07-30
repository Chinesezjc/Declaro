import * as fs from "node:fs"
import * as path from "node:path"
import { fileURLToPath } from "node:url"
import katex from "katex"
import {
  type BoxNode,
  type ButtonNode,
  type CardNode,
  type ComponentNode,
  type EnvNode,
  type FormNode,
  type InputNode,
  type KatexNode,
  type ListNode,
  type ModalNode,
  type PageNode,
  type SelectNode,
  type SliderNode,
  type TableNode,
  type TextAreaNode,
  type TextNode,
  type Action,
  groupBySlot,
  getPlugin,
  registerBuiltinCompilers,
} from "../dsl"
import type { ScriptNode } from "../dsl/components/script"
import type { IslandNode } from "../dsl/components/island"
import type { ReactIslandNode } from "../dsl/components/react-island"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ===== CSS =====
function loadCSS(): string {
  const cssPath = path.resolve(__dirname, "../styles.css")
  return fs.readFileSync(cssPath, "utf-8")
}

// ===== Runtime JS =====
const RUNTIME_JS_PATH = path.resolve(__dirname, "../runtime/dist/runtime.min.js")
let RUNTIME_JS = ""
try {
  RUNTIME_JS = fs.readFileSync(RUNTIME_JS_PATH, "utf-8")
} catch {
  // Fallback: during development, runtime may not be built yet
  console.warn("Warning: Runtime bundle not found at", RUNTIME_JS_PATH)
  console.warn("Run `npm run build:runtime` to build the client runtime.")
}

// ===== Action to JS =====
function actionToJS(action: Action | undefined): string {
  if (!action) return ""
  const src = action.toString()
  const D = "__DSL__"

  // ctx.toast("msg", { variant: "...", duration: N })
  const toastMatch = src.match(
    /ctx\.toast\s*\(\s*["']([^"']+)["']\s*,\s*\{[^}]*variant\s*:\s*["'](\w+)["'][^}]*duration\s*:\s*(\d+)[^}]*\}/,
  )
  if (toastMatch) {
    const [, msg, variant, duration] = toastMatch
    const decoded = unescapeJSString(msg)
    return `${D}.showToast('${escapeJS(decoded)}','${variant}',${duration})`
  }

  // ctx.request.get(url)
  const getMatch = src.match(/ctx\.request\.get\s*\(\s*["']([^"']+)["']\s*\)/)
  if (getMatch) {
    return `fetch('${getMatch[1]}').then(function(r){return r.json()})`
  }

  // ctx.request.post(url, body)
  const postMatch = src.match(/ctx\.request\.post\s*\(\s*["']([^"']+)["']\s*,\s*(\w+(?:\.\w+)*)\s*\)/)
  if (postMatch) {
    return `fetch('${postMatch[1]}',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(${postMatch[2]})}).then(function(r){return r.json()})`
  }

  // ctx.navigate(path)
  const navMatch = src.match(/ctx\.navigate\s*\(\s*["']([^"']+)["']\s*\)/)
  if (navMatch) {
    return `window.location.href='${navMatch[1]}'`
  }

  // ctx.refresh()
  if (src.includes("ctx.refresh()")) {
    return "window.location.reload()"
  }

  // ctx.openModal(id)
  const openModalMatch = src.match(/ctx\.openModal\s*\(\s*["']([^"']+)["']\s*\)/)
  if (openModalMatch) {
    return `${D}.openModal('${openModalMatch[1]}')`
  }

  // ctx.closeModal(id)
  const closeModalMatch = src.match(/ctx\.closeModal\s*\(\s*["']([^"']+)["']\s*\)/)
  if (closeModalMatch) {
    return `${D}.closeModal('${closeModalMatch[1]}')`
  }

  // ctx.emitSignal(sig)
  const emitMatch = src.match(/ctx\.emitSignal\s*\((\{[^}]+\})\)/)
  if (emitMatch) {
    return `${D}.emitSignal(${emitMatch[1]})`
  }

  return `console.log('Action: ${escapeJS(src.slice(0, 60))}...')`
}

// Unescape JS string escapes like \uXXXX, \u{XXXXXX}, \n, etc.
function unescapeJSString(s: string): string {
  return s
    .replace(/\\u\{([0-9A-Fa-f]+)\}/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/\\u([0-9A-Fa-f]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\")
}

function escapeJS(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n")
}

function escapeHTML(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

// ===== Self-alignment wrapper =====
/**
 * Emit `id="..."` for a component that declared one, so it can be targeted by a
 * fragment link and by CSS. Components that already put their id in the markup
 * themselves (form, modal, island) pass through this untouched — see idAttr's
 * call sites.
 */
function idAttr(node: ComponentNode): string {
  return `${idOnly(node)}${runtimeAttrs(node)}`
}

/**
 * The attributes client-side code reads off an element: the binding attributes
 * the runtime syncs, and the data-* attributes an island handler reads from the
 * event target.
 *
 * Emitted together because they belong on the same element for the same reason —
 * both are read at runtime rather than styled — so a component that puts
 * bindings on an inner control has to put its data there too.
 */
function runtimeAttrs(node: ComponentNode): string {
  return `${bindAttrs(node)}${dataAttrs(node)}`
}

/** Matches the attribute-name shape `data` accepts; see ComponentBase.data. */
const DATA_KEY = /^[a-z][a-z0-9-]*$/

/**
 * Emit the `data-*` attributes a component declared, so one island handler can
 * serve many controls by branching on the event target's dataset.
 *
 * A key outside DATA_KEY throws rather than being escaped into the output: HTML
 * would accept `data-Foo` and then expose it as `dataset.foo`, and an attribute
 * name with a space in it silently becomes two attributes. Both are bugs the page
 * author cannot see in the DSL, so they are rejected at compile time.
 */
function dataAttrs(node: ComponentNode): string {
  if (!node.data) return ""
  return Object.entries(node.data)
    .map(([key, value]) => {
      if (!DATA_KEY.test(key)) {
        throw new Error(
          `data key ${JSON.stringify(key)} must match ${DATA_KEY} (lowercase, hyphen-separated)`,
        )
      }
      return ` data-${key}="${escapeHTML(value)}"`
    })
    .join("")
}

/**
 * Emit only the id, for a component whose bindings belong on an inner element
 * instead — a field's bindings go on its control, not on the label around it,
 * because that is what `disabled` and a value binding have to reach.
 */
function idOnly(node: ComponentNode): string {
  return node.id ? ` id="${escapeHTML(node.id)}"` : ""
}

/**
 * Emit the data-dsl-* attributes for a component's declared bindings, which the
 * client runtime syncs on every island state change.
 *
 * Emitted here rather than left to the compiler's text-binding inference so a
 * page can bind a field the inference cannot see: one whose initial value is
 * empty, or whose text is a substring of surrounding prose.
 */
function bindAttrs(node: ComponentNode): string {
  const bind = node.bind
  if (!bind) return ""
  const parts: string[] = []
  if (bind.text) parts.push(` data-dsl-text="${escapeHTML(bind.text)}"`)
  if (bind.html) parts.push(` data-dsl-html="${escapeHTML(bind.html)}"`)
  if (bind.show) parts.push(` data-dsl-show="${escapeHTML(bind.show)}"`)
  if (bind.list) parts.push(` data-dsl-list="${escapeHTML(bind.list)}"`)
  if (bind.class) {
    parts.push(` data-dsl-class="${escapeHTML(`${bind.class.cls}:${bind.class.key}`)}"`)
  }
  if (bind.attr) {
    // The runtime splits "attr:key" on the first colon and "key=val" on the first
    // equals, so an attribute name may not contain a colon and a key may not
    // contain an equals.
    const spec = bind.attr.equals != null
      ? `${bind.attr.attr}:${bind.attr.key}=${bind.attr.equals}`
      : `${bind.attr.attr}:${bind.attr.key}`
    parts.push(` data-dsl-attr="${escapeHTML(spec)}"`)
  }
  if (bind.attrValue) {
    parts.push(` data-dsl-attr-value="${escapeHTML(`${bind.attrValue.attr}:${bind.attrValue.key}`)}"`)
  }
  return parts.join("")
}

/**
 * The class list for a component's outermost element: its own dsl-* classes plus
 * whatever `className` declared.
 *
 * Additive rather than replacing, because a component's own styling comes from
 * the dsl-* classes and dropping them would strip it. A page that has to
 * override one writes a more specific rule.
 */
function classList(node: ComponentNode, own: string): string {
  const extra = node.className?.trim()
  return extra ? `${own} ${escapeHTML(extra)}` : own
}

function wrapAlign(node: ComponentNode, inner: string): string {
  const style: string[] = []
  const { alignX, alignY, sizeX, sizeY } = node
  if (alignX) {
    const map: Record<string, string> = { left: "flex-start", center: "center", right: "flex-end", stretch: "stretch" }
    style.push(`justify-self:${map[alignX] ?? alignX}`)
  }
  if (alignY) {
    const map: Record<string, string> = { top: "flex-start", center: "center", bottom: "flex-end", stretch: "stretch" }
    style.push(`align-self:${map[alignY] ?? alignY}`)
  }
  if (sizeX) style.push(`width:${sizeX === "fill" ? "100%" : "auto"}`)
  if (sizeY) style.push(`height:${sizeY === "fill" ? "100%" : "auto"}`)
  if (style.length === 0) return inner
  return `<div class="dsl-align-self" style="${style.join(";")}">${inner}</div>`
}

// ===== Component compilers =====

function compileText(node: TextNode): string {
  const tag = { title: "h1", subtitle: "h2", body: "p", caption: "small" }[node.variant ?? "body"] ?? "p"
  const cls = `dsl-text dsl-text-${node.variant ?? "body"}`
  const style = [
    node.lineHeight ? `line-height:${typeof node.lineHeight === "number" ? node.lineHeight : { tight: "1.2", normal: "1.5", relaxed: "1.75", loose: "2" }[node.lineHeight] ?? node.lineHeight}` : "",
    node.paragraphSpacing ? `--paragraph-spacing:${node.paragraphSpacing}` : "",
  ].filter(Boolean).join(";")

  const paragraphs = node.text.split(/\n\s*\n/)
  const bodyHTML = paragraphs.length > 1
    ? paragraphs.map((p) => `<span class="dsl-text-paragraph">${escapeHTML(p)}</span>`).join("")
    : escapeHTML(node.text)

  const hasActions = Boolean(node.titleActions && node.titleActions.length > 0)
  // The id and className belong on the outermost element: a fragment link should
  // land on the whole block, title bar included, and a layout class has to
  // position the block rather than the text inside it. Bindings stay on the text
  // element either way — a text binding on the title bar would replace the action
  // buttons with the state value, and a show binding would hide them with it.
  const inner = `<${tag} class="${hasActions ? cls : classList(node, cls)}"${hasActions ? "" : idOnly(node)}${runtimeAttrs(node)}${style ? ` style="${style}"` : ""}>${bodyHTML}</${tag}>`

  if (hasActions) {
    const actions = (node.titleActions ?? []).map(compileComponent).join("")
    return `<div class="${classList(node, "dsl-titlebar")}"${idOnly(node)}>${inner}<div class="dsl-titlebar-actions">${actions}</div></div>`
  }
  return inner
}

function compileBox(node: BoxNode): string {
  const layout = node.layout ?? "vertical"
  const cls = ["dsl-box", `dsl-box-${layout}`, node.tone ? `dsl-box-tone-${node.tone}` : ""].filter(Boolean).join(" ")
  const style = [
    node.gap ? `gap:${typeof node.gap === "number" ? `${node.gap}px` : node.gap}` : "",
    node.padding ? `padding:${typeof node.padding === "number" ? `${node.padding}px` : node.padding}` : "",
    node.radius ? `border-radius:${typeof node.radius === "number" ? `${node.radius}px` : node.radius}` : "",
    node.borderWidth ? `border-width:${typeof node.borderWidth === "number" ? `${node.borderWidth}px` : node.borderWidth}` : "",
    node.shadow === "none" ? "box-shadow:none" : node.shadow === "raised" ? "box-shadow:0 4px 16px rgba(0,0,0,.12)" : "",
    node.maxHeight ? `max-height:${typeof node.maxHeight === "number" ? `${node.maxHeight}px` : node.maxHeight}` : "",
    node.maxWidth ? `max-width:${typeof node.maxWidth === "number" ? `${node.maxWidth}px` : node.maxWidth}` : "",
  ].filter(Boolean).join(";")

  const childrenAlignX = node.childrenAlignX
  const childrenAlignY = node.childrenAlignY
  const childrenStyle = [
    childrenAlignX ? `--align-x:${childrenAlignX}` : "",
    childrenAlignY ? `--align-y:${childrenAlignY}` : "",
    node.childrenSizeX ? `--size-x:${node.childrenSizeX === "fill" ? "100%" : "auto"}` : "",
    node.childrenSizeY ? `--size-y:${node.childrenSizeY === "fill" ? "100%" : "auto"}` : "",
    node.columns ? `grid-template-columns:repeat(${node.columns},minmax(0,1fr))` : "",
  ].filter(Boolean).join(";")

  const childrenHTML = node.children.map(compileComponent).join("")

  // Title bar
  let titleBar = ""
  if (node.title || node.titleActions || node.collapsible) {
    const titleTag = node.title ? `<h2 class="dsl-box-title">${escapeHTML(node.title)}</h2>` : ""
    const actions = (node.titleActions ?? []).map(compileComponent).join("")
    const toggleBtn = node.collapsible
      ? `<button class="dsl-collapse-toggle" onclick="toggleCollapse(this)" data-expand-label="${escapeHTML(node.expandLabel ?? "展开")}" data-collapse-label="${escapeHTML(node.collapseLabel ?? "收起")}" aria-expanded="${node.defaultCollapsed ? "false" : "true"}">${node.defaultCollapsed ? (node.expandLabel ?? "展开") : (node.collapseLabel ?? "收起")}</button>`
      : ""
    titleBar = `<div class="dsl-titlebar">${titleTag}<div class="dsl-titlebar-actions">${actions}${toggleBtn}</div></div>`
  }

  const collapsed = node.collapsible && node.defaultCollapsed ? ` data-collapsed="true"` : ""
  const scroll = node.scroll && node.scroll !== "none" ? ` style="overflow-${node.scroll === "both" ? "auto" : node.scroll}"` : ""
  const childrenDisplay = node.collapsible && node.defaultCollapsed ? ` style="display:none"` : ""

  return `<section class="${classList(node, cls)}"${idAttr(node)}${style ? ` style="${style}"` : ""}${collapsed}${scroll}>
  ${titleBar}
  <div class="dsl-box-children" style="${childrenStyle}"${childrenDisplay}>${childrenHTML}</div>
</section>`
}

function compileCard(node: CardNode): string {
  const toggleBtn = node.collapsible
    ? `<button class="dsl-collapse-toggle" onclick="toggleCollapse(this)" data-expand-label="${escapeHTML(node.expandLabel ?? "展开")}" data-collapse-label="${escapeHTML(node.collapseLabel ?? "收起")}" aria-expanded="${node.defaultCollapsed ? "false" : "true"}">${node.defaultCollapsed ? (node.expandLabel ?? "展开") : (node.collapseLabel ?? "收起")}</button>`
    : ""

  const titleActions = (node.titleActions ?? []).map(compileComponent).join("")
  const title = node.title ? `<h2>${escapeHTML(node.title)}</h2>` : ""
  const header = (node.header ?? []).map(compileComponent).join("")
  const body = (node.body ?? []).map(compileComponent).join("")
  const footer = (node.footer ?? []).map(compileComponent).join("")

  const collapsed = node.collapsible && node.defaultCollapsed
  const bodyDisplay = collapsed ? ` style="display:none"` : ""
  const footerDisplay = collapsed ? ` style="display:none"` : ""
  const collapsedAttr = collapsed ? ` data-collapsed="true"` : ""

  return `<section class="${classList(node, "dsl-card")}"${idAttr(node)}${collapsedAttr}>
  <div class="dsl-card-header">
    <div class="dsl-titlebar">${title}<div class="dsl-titlebar-actions">${titleActions}${toggleBtn}</div></div>
    ${header}
  </div>
  <div class="dsl-card-body"${bodyDisplay}>${body}</div>
  ${footer ? `<div class="dsl-card-footer"${footerDisplay}>${footer}</div>` : ""}
</section>`
}

/**
 * @param buttonType value for the HTML type attribute. Buttons default to
 *   "button" so a stray one cannot submit an enclosing form; a Form's own submit
 *   button is compiled with "submit".
 */
function compileButton(node: ButtonNode, buttonType: "button" | "submit" = "button"): string {
  const variant = node.variant ?? "secondary"
  const disabled = node.disabled ? " disabled" : ""
  const onClick = actionToJS(node.onClick)
  const onclickAttr = onClick ? ` onclick="${onClick}"` : ""
  // Island wiring is declared per button, so the handler a button triggers does
  // not depend on where the button sits in the rendered tree.
  const eventAttr = islandEventAttr(node.islandHandler, undefined, "click")
  return `<button class="${classList(node, `dsl-button dsl-button-${variant}`)}"${idAttr(node)} type="${buttonType}"${disabled}${eventAttr}${onclickAttr}>${escapeHTML(node.text)}</button>`
}

/**
 * Emit the island wiring attribute for a field. The event name defaults per
 * field type; bindIslandEvents() dispatches on it in the browser.
 */
function islandEventAttr(
  handler: string | undefined,
  event: string | undefined,
  defaultEvent: string,
): string {
  if (!handler) return ""
  return ` data-dsl-event="${escapeHTML(event ?? defaultEvent)}:${escapeHTML(handler)}"`
}

/** Emit `name="value"` when the value is set, escaped. Omit the attribute otherwise. */
function attr(name: string, value: string | undefined): string {
  return value ? ` ${name}="${escapeHTML(value)}"` : ""
}

/**
 * Emit a numeric attribute. Separate from attr() because 0 is a value a caller
 * means — min="0" and step="0" both say something — and attr()'s truthiness
 * check would drop it.
 */
function numAttr(name: string, value: number | string | undefined): string {
  if (value == null || value === "") return ""
  return ` ${name}="${escapeHTML(String(value))}"`
}

function compileInput(node: InputNode): string {
  const required = node.required ? " required" : ""
  const placeholder = attr("placeholder", node.placeholder)
  // A file input cannot carry a value: the browser rejects it, and the attribute
  // would be a way to claim a local path the user never picked.
  const isFile = node.inputType === "file"
  const value = isFile ? "" : attr("value", node.defaultValue)
  const event = islandEventAttr(node.islandHandler, node.islandEvent, "input")
  const type = attr("type", node.inputType)
  const accept = isFile ? attr("accept", node.accept) : ""
  const inputMode = attr("inputmode", node.inputMode)
  const pattern = attr("pattern", node.pattern)
  const range = numAttr("min", node.min) + numAttr("max", node.max) + numAttr("step", node.step)
  const length = numAttr("minlength", node.minLength) + numAttr("maxlength", node.maxLength)
  const autoComplete = attr("autocomplete", node.autoComplete)
  // Bindings go on the input, not the label: `disabled` has to reach the control.
  const input = `<input name="${escapeHTML(node.name)}"${type}${placeholder}${required}${value}${accept}${inputMode}${pattern}${range}${length}${autoComplete}${event}${runtimeAttrs(node)}>`

  // A hidden input has nothing to label, and the dsl-field wrapper would leave a
  // gap in the form's field grid.
  if (node.inputType === "hidden") return input

  // className goes on the label, the item a form grid positions, while bindings
  // stay on the control. A rule for the control itself is a descendant selector.
  return `<label class="${classList(node, "dsl-field")}"${idOnly(node)}>
  <span>${escapeHTML(node.label ?? node.name)}</span>
  ${input}
</label>`
}

function compileSelect(node: SelectNode): string {
  const required = node.required ? " required" : ""
  const multiple = node.multiple ? " multiple" : ""
  const event = islandEventAttr(node.islandHandler, node.islandEvent, "change")
  // defaultValue marks the option to pre-select. Comparing the raw values, not
  // the escaped ones, so a default containing & or " still matches its option.
  const options = node.options
    .map((o) => {
      const selected = node.defaultValue != null && o.value === node.defaultValue ? " selected" : ""
      return `<option value="${escapeHTML(o.value)}"${selected}>${escapeHTML(o.label)}</option>`
    })
    .join("")
  return `<label class="${classList(node, "dsl-field")}"${idOnly(node)}>
  <span>${escapeHTML(node.label ?? node.name)}</span>
  <select name="${node.name}"${required}${multiple}${event}${runtimeAttrs(node)}>${options}</select>
</label>`
}

function compileSlider(node: SliderNode): string {
  const label = node.label ?? node.name
  const defVal = node.defaultValue ?? node.min ?? 0
  const min = node.min ?? 0
  const max = node.max ?? 100
  const step = node.step ?? 1
  const valueType = node.valueType ?? "int"
  const sliderConfig = JSON.stringify({ name: node.name, min, max, step, valueType, defaultValue: defVal })
  const inputAttrs = node.input ? " data-dsl-slider-input" : ""
  return `<div class="${classList(node, "dsl-slider-field")}"${idAttr(node)} data-dsl-slider='${sliderConfig}'>
  <span class="dsl-slider-label">
    <span>${escapeHTML(label)}</span>
    <output>${defVal}</output>
  </span>
  <input type="range" min="${min}" max="${max}" step="${step}" value="${defVal}"${inputAttrs}>
  ${node.input ? `<input type="number" min="${min}" max="${max}" step="${step}" value="${defVal}" class="dsl-slider-num">` : ""}
</div>`
}

function compileTextArea(node: TextAreaNode): string {
  const required = node.required ? " required" : ""
  const placeholder = node.placeholder ? ` placeholder="${escapeHTML(node.placeholder)}"` : ""
  const rows = node.rows ? ` rows="${node.rows}"` : ""
  // A textarea is read by its island the same way an input is, so it takes the
  // same wiring. "input" is the default because that is what a field whose every
  // keystroke matters needs, and it matches Input.
  const event = islandEventAttr(node.islandHandler, node.islandEvent, "input")
  return `<label class="${classList(node, "dsl-field")}"${idOnly(node)}>
  <span>${escapeHTML(node.label ?? node.name)}</span>
  <textarea name="${escapeHTML(node.name)}"${placeholder}${required}${rows}${event}${runtimeAttrs(node)}></textarea>
</label>`
}

function compileForm(node: FormNode): string {
  const fields = node.fields.map(compileComponent).join("")
  const submitBtn = node.submitButton ? compileButton(node.submitButton, "submit") : `<button class="dsl-button dsl-button-primary" type="submit">提交</button>`
  const onSignal = node.onSignal ? ` data-signal="${escapeJS(node.onSignal.toString().slice(0, 200))}"` : ""

  // A form with islandHandler set submits through its Island instead of the
  // built-in /api/form/<id> POST, so it must not also carry that action: if the
  // handler throws before preventDefault(), the built-in onsubmit would navigate
  // away and the multipart body the handler was assembling would be lost.
  if (node.islandHandler) {
    const event = islandEventAttr(node.islandHandler, "submit", "submit")
    return `<form class="${classList(node, "dsl-form")}" id="${escapeHTML(node.id)}"${event}${runtimeAttrs(node)}${onSignal}>
  <div class="dsl-form-fields">${fields}</div>
  <div class="dsl-form-actions">${submitBtn}</div>
</form>`
  }

  return `<form class="${classList(node, "dsl-form")}" id="${node.id}" method="post" action="/api/form/${node.id}" onsubmit="handleFormSubmit(event,'${node.id}')"${runtimeAttrs(node)}${onSignal}>
  <div class="dsl-form-fields">${fields}</div>
  <div class="dsl-form-actions">${submitBtn}</div>
</form>`
}

function compileTable(node: TableNode): string {
  const titleBar = node.title
    ? `<div class="dsl-titlebar"><h2>${escapeHTML(node.title)}</h2></div>`
    : ""
  const headers = node.columns
    .map((c) => `<th${c.width ? ` style="width:${c.width}px"` : ""}>${escapeHTML(c.title)}${c.sortable ? ` <button class="dsl-sort-btn" onclick="sortTable(this,'${c.key}')">↕</button>` : ""}</th>`)
    .join("")
  const rowActions = (node.rowActions ?? []).map(compileComponent).join("")

  return `<section class="${classList(node, "dsl-table-card")}"${idAttr(node)} data-datasource="${escapeHTML(node.dataSource)}">
  ${titleBar}
  <div class="dsl-table-wrap">
    <table class="dsl-table" data-datasource="${escapeHTML(node.dataSource)}">
      <thead><tr>${headers}${rowActions ? `<th>操作</th>` : ""}</tr></thead>
      <tbody><tr><td colspan="${node.columns.length + (rowActions ? 1 : 0)}" class="dsl-table-loading">加载中...</td></tr></tbody>
    </table>
  </div>
</section>`
}

function compileList(node: ListNode): string {
  const items = node.items ?? []
  const itemsHTML = items.length > 0
    ? items.map((item, i) => {
      const key = typeof node.itemKey === "function" ? node.itemKey(item, i) : (node.itemKey ? String(item[node.itemKey] ?? i) : String(i))
      return `<div class="dsl-list-item" data-key="${key}">${escapeHTML(JSON.stringify(item))}</div>`
    }).join("")
    : ""

  return `<section class="${classList(node, "dsl-list")}"${idAttr(node)}${node.dataSource ? ` data-datasource="${escapeHTML(node.dataSource)}"` : ""}>
  <div class="dsl-list-items">${itemsHTML || '<span class="dsl-list-empty">无数据</span>'}</div>
</section>`
}

function compileModal(node: ModalNode): string {
  const title = node.title ? `<h2>${escapeHTML(node.title)}</h2>` : ""
  const children = node.children.map(compileComponent).join("")
  return `<section class="${classList(node, "dsl-modal")}" id="${node.id}"${runtimeAttrs(node)} hidden>
  ${title}
  <div class="dsl-modal-body">${children}</div>
</section>`
}

// ===== Island (Phase 5 enhanced) =====
function compileIsland(node: IslandNode, devMode = false): string {
  // Compile the initial render to static HTML
  const childTree = node.render(node.initialState)
  const staticHTML = compileComponent(childTree)

  // Mark state bindings with data-dsl-* attributes. An island whose state holds
  // values that also appear as literal text turns this off and declares its
  // bindings with `bind` instead, so the inference cannot mark the wrong node.
  let markedHTML =
    node.inferBindings === false ? staticHTML : markStateBindings(staticHTML, node.initialState)

  // Add source mapping in dev mode
  if (devMode) {
    markedHTML = markedHTML.replace(/<div /, `<div data-dsl-source="island:${node.id}" `)
  }

  // Buttons carry their own data-dsl-event, emitted by compileButton from
  // Button({ islandHandler }). Nothing to wire here.
  const handlerNames = node.handlers ? Object.keys(node.handlers) : []

  const stateJson = JSON.stringify(node.initialState)
  const strategy = node.strategy ?? "bindings"

  // Generate handler definitions
  const pageStateArg = node.usePageState ? ",pageStateHandle" : ""
  const handlerDefs = handlerNames
    .map((name) => {
      const handler = node.handlers![name]
      return `function __dsl_h_${safeJSId(node.id)}_${safeJSId(name)}(event,stateHandle,container${pageStateArg}){${generateHandlerBody(handler.toString())}}`
    })
    .join("\n")
  const handlerMap = handlerNames
    .map((name) => `"${name}":__dsl_h_${safeJSId(node.id)}_${safeJSId(name)}`)
    .join(",")

  // For rerender strategy, serialize the render function
  let renderFnDef = ""
  if (strategy === "rerender") {
    const renderFnBody = node.render.toString()
    // Generate an HTML-emitter function that calls compileComponent-like logic at runtime
    // For simplicity, the render function is serialized and called; morphdom patches the result
    renderFnDef = `function __dsl_rf_${safeJSId(node.id)}(state){return compileIslandHTML_${safeJSId(node.id)}(state)}
function compileIslandHTML_${safeJSId(node.id)}(state){${generateRenderFnBody(renderFnBody)}}`
  }

  // className lands on the island wrapper, which is a plain div the layout would
  // otherwise have no way to style. `bind` is excluded from this element instead:
  // the runtime syncs with querySelectorAll from here, which never matches it.
  const wrapperClass = node.className ? ` class="${escapeHTML(node.className)}"` : ""

  return `<div data-island="${escapeHTML(node.id)}"${wrapperClass} data-dsl-initial-state='${escapeHTML(stateJson)}'>
${markedHTML}
</div>
<script>
${handlerDefs}
${renderFnDef}
__DSL__.defineIsland({
  id: "${escapeJS(node.id)}",
  initialState: ${stateJson},
  strategy: "${strategy}",
  ${strategy === "rerender" ? `renderFn: __dsl_rf_${safeJSId(node.id)},` : ""}
  ${node.usePageState ? "usePageState: true," : ""}
  handlers: {${handlerMap}}
});
__DSL__.hydrateAll();
</script>`
}

// ===== React Island =====
function compileReactIsland(node: ReactIslandNode): string {
  const propsJson = JSON.stringify(node.props ?? {})
  const component = node.component

  return `<div data-react-island="${escapeHTML(node.id)}" data-react-component="${escapeHTML(component)}" data-react-props='${escapeHTML(propsJson)}'>
  <span>Loading ${escapeHTML(component)}...</span>
</div>`
}

// Generate a runtime HTML string builder from the render function body
function generateRenderFnBody(fnStr: string): string {
  // Extract the return statement from the render function
  // The render function is (state) => ComponentNode
  // At runtime, we need to produce an HTML string from the returned ComponentNode
  // For simplicitly, we serialize the render result as a template literal
  const bodyMatch = fnStr.match(/=>\s*(\{[\s\S]*\})/m)
  if (bodyMatch) {
    // Extract the return expression from the body
    const returnMatch = bodyMatch[1].match(/return\s+([^;]+);?\s*\}/s)
    if (returnMatch) {
      return `return '<div>rerender: ' + JSON.stringify(state) + '</div>'`
    }
  }
  return `return '<div>rerender island</div>'`
}

/**
 * Wrap the text nodes that render an island's initial state in
 * <span data-dsl-text="key">, so the runtime can update them without a re-render.
 *
 * The match has to be a whole text node, not a substring. A substring match binds
 * text that has nothing to do with the state, and because the runtime rewrites every
 * marked node on each set(), one wrong guess means unrelated state text keeps
 * appearing there for the life of the page. Two consequences of requiring the whole
 * node:
 *
 *   - An empty value never matches. Under substring matching it matched at every
 *     position, marking every text node on the page.
 *   - `Text({ text: "looks ok to me" })` is not a binding for `{ tone: "ok" }`.
 *
 * The value is escaped before the search because `html` is already escaped, and the
 * text around the match is left alone rather than re-escaped.
 *
 * A page that needs a binding this cannot infer should declare it directly, with
 * Html({ html: '<div data-dsl-text="key"></div>' }).
 */
function markStateBindings(html: string, state: Record<string, unknown>): string {
  let result = html
  for (const key of Object.keys(state)) {
    const val = state[key]
    if (val == null) continue
    const strVal = String(val)
    if (strVal === "") continue
    const escaped = escapeHTML(strVal)
    const textRegex = new RegExp(`>${escapeRegex(escaped)}<`, "g")
    result = result.replace(textRegex, `><span data-dsl-text="${escapeHTML(key)}">${escaped}</span><`)
  }
  return result
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function safeJSId(s: string): string {
  return s.replace(/[^a-zA-Z0-9_$]/g, "_")
}

function generateHandlerBody(fnStr: string): string {
  // Extract the function body from the toString() output. The body is re-emitted
  // inside a function whose parameters follow IslandHandler:
  // (event, stateHandle, container, pageStateHandle?).
  const bodyMatch = fnStr.match(/=>\s*(\{[\s\S]*\})/m)
  if (bodyMatch) return bodyMatch[1]
  // Try function body
  const funcMatch = fnStr.match(/function\s*\([^)]*\)\s*(\{[\s\S]*\})/m)
  if (funcMatch) return funcMatch[1]
  return fnStr
}

// ===== Katex =====
function compileKatex(node: KatexNode): string {
  try {
    const html = katex.renderToString(node.expression, {
      displayMode: node.displayMode ?? false,
      throwOnError: false,
    })
    // idAttr rather than nothing: a formula is as much a link target as any other
    // block, and `show` is how a page reveals one conditionally. A `text` or
    // `html` binding here would overwrite the rendered formula, which is the
    // caller's business — the same is true of Box and Card.
    return node.displayMode
      ? `<div class="${classList(node, "dsl-katex dsl-katex-block")}"${idAttr(node)}>${html}</div>`
      : `<span class="${classList(node, "dsl-katex dsl-katex-inline")}"${idAttr(node)}>${html}</span>`
  } catch {
    return `<code class="dsl-katex-error">${escapeHTML(node.expression)}</code>`
  }
}

// ===== Script =====
function compileScript(node: ScriptNode): string {
  if (node.inline) {
    const typeAttr = node.type_ ? ` type="${escapeHTML(node.type_)}"` : ""
    return `<script${typeAttr}>${node.inline}</script>`
  }
  if (node.src) {
    const attrs = [
      `src="${escapeHTML(node.src)}"`,
      node.async ? "async" : "",
      node.defer ? "defer" : "",
      node.type_ ? `type="${escapeHTML(node.type_)}"` : "",
    ].filter(Boolean).join(" ")
    return `<script ${attrs}></script>`
  }
  return ""
}

// ===== Compile helpers =====
const builtinCompilers: Record<string, (node: ComponentNode) => string> = {
  box: (n) => compileBox(n as unknown as BoxNode),
  button: (n) => compileButton(n as unknown as ButtonNode),
  card: (n) => compileCard(n as unknown as CardNode),
  form: (n) => compileForm(n as unknown as FormNode),
  html: (n) => (n as unknown as { html: string }).html,
  input: (n) => compileInput(n as unknown as InputNode),
  katex: (n) => compileKatex(n as unknown as KatexNode),
  list: (n) => compileList(n as unknown as ListNode),
  modal: (n) => compileModal(n as unknown as ModalNode),
  script: (n) => compileScript(n as unknown as ScriptNode),
  select: (n) => compileSelect(n as unknown as SelectNode),
  slider: (n) => compileSlider(n as unknown as SliderNode),
  table: (n) => compileTable(n as unknown as TableNode),
  text: (n) => compileText(n as unknown as TextNode),
  textarea: (n) => compileTextArea(n as unknown as TextAreaNode),
  island: (n) => compileIsland(n as unknown as IslandNode),
  "react-island": (n) => compileReactIsland(n as unknown as ReactIslandNode),
}

// Wire up built-in compilers into the registry
registerBuiltinCompilers(builtinCompilers)

// ===== Dispatch =====
function compileComponent(node: ComponentNode): string {
  const inner = compileComponentInner(node)
  return wrapAlign(node, inner)
}

function compileComponentInner(node: ComponentNode): string {
  const plugin = getPlugin(node.type)
  if (plugin) return plugin.compile(node)
  return ""
}

// ===== Layout shell =====
function compileLayoutShell(env: EnvNode, children: ComponentNode[]): string {
  const slotted = groupBySlot(children, env.slots.includes("main") ? "main" : env.slots[0] ?? "main")
  const layout = env.layout

  if (layout === "dashboard") {
    return `<div class="dsl-dashboard-shell">
  ${compileSlot(slotted, "header", "header")}
  <div class="dsl-dashboard-body">
    ${compileSlot(slotted, "sidebar", "aside")}
    <div class="dsl-dashboard-content">
      ${compileSlot(slotted, "toolbar", "section")}
      ${compileSlot(slotted, "main", "main")}
      ${compileExtraSlots(slotted, ["header","sidebar","toolbar","main","footer","modal"])}
    </div>
  </div>
  ${compileSlot(slotted, "footer", "footer")}
  ${compileSlot(slotted, "modal", "section")}
</div>`
  }

  if (layout === "split") {
    return `<div class="dsl-split-shell">
  ${compileSlot(slotted, "header", "header")}
  <div class="dsl-split-body">
    ${compileSlot(slotted, "main", "main")}
    ${compileSlot(slotted, "sidebar", "aside")}
  </div>
  ${compileExtraSlots(slotted, ["header","main","sidebar","footer","modal"])}
  ${compileSlot(slotted, "footer", "footer")}
  ${compileSlot(slotted, "modal", "section")}
</div>`
  }

  // default / form
  const cls = layout === "form" ? "dsl-form-shell" : "dsl-linear-shell"
  const keep = ["header", "footer", "modal"]
  return `<div class="${cls}">
  ${compileSlot(slotted, "header", "header")}
  ${env.slots.filter((s) => !keep.includes(s)).map((slot) => compileSlot(slotted, slot, slot === "main" ? "main" : "section")).join("\n")}
  ${compileSlot(slotted, "footer", "footer")}
  ${compileSlot(slotted, "modal", "section")}
</div>`
}

function compileSlot(slotted: Record<string, ComponentNode[]>, slot: string, tag: string): string {
  const children = slotted[slot]
  if (!children || children.length === 0) return ""
  const inner = children.map(compileComponent).join("\n")
  return `<${tag} class="dsl-slot dsl-slot-${slot}" data-slot="${slot}">${inner}</${tag}>`
}

function compileExtraSlots(slotted: Record<string, ComponentNode[]>, keep: string[]): string {
  return Object.keys(slotted)
    .filter((s) => !keep.includes(s))
    .map((s) => compileSlot(slotted, s, "section"))
    .join("\n")
}

// ===== Top-level page compiler =====
export interface CompileOptions {
  title?: string
  route?: string
  /** Enable dev mode (source maps + DevTools) */
  dev?: boolean
}

export function compilePage(page: PageNode, options: CompileOptions = {}): string {
  const css = loadCSS()
  const layoutHTML = compileLayoutShell(page.env, page.children)
  const headHTML = page.head ? page.head.map(compileComponent).join("\n") : ""
  const devMode = options.dev ?? false

  // Page-level state initialization
  let pageStateScript = ""
  if (page.state) {
    const stateJson = JSON.stringify(page.state)
    pageStateScript = `<script>
__DSL__.setPageState(__DSL__.createState(${stateJson}));
</script>`
  }

  // DevTools injection in dev mode
  let devToolsScript = ""
  if (devMode) {
    devToolsScript = `<script>
if (window.location.search.includes('__dsl_debug=1')) {
  document.addEventListener('DOMContentLoaded', function() {
    if (window.__DSL__ && window.__DSL__.devtools) window.__DSL__.devtools();
  });
}
</script>`
  }

  // KaTeX ships its own stylesheet, and the pre-rendered formula markup is
  // unreadable without it. Link it only when the page actually has a formula, so
  // a page with no Katex node stays free of external requests.
  const hasKatex =
    page.children.some(hasKatexInTree) || (page.head ?? []).some(hasKatexInTree)
  const katexCSS = hasKatex
    ? `\n<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">`
    : ""

  // Check if any ReactIsland is used — if so, inject React CDN
  const hasReactIsland = page.children.some((c) => hasReactIslandInTree(c))
  let reactCDN = ""
  if (hasReactIsland) {
    reactCDN = `<script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>`
  }

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHTML(options.title ?? page.title)}</title>${katexCSS}
<style>
${css}
</style>
<script>
${RUNTIME_JS}
</script>
${pageStateScript}
${headHTML}
</head>
<body>
<div class="dsl-page dsl-layout-${page.env.layout}" data-page-id="${page.id}" data-env-id="${page.env.id}">
${layoutHTML}
</div>
<div class="toast-stack" role="status" aria-live="polite"></div>
${reactCDN}
${devToolsScript}
</body>
</html>`
}

// Recursively check if any component in the tree is a ReactIsland
function hasReactIslandInTree(node: ComponentNode): boolean {
  return someInTree(node, (n) => n.type === "react-island")
}

function hasKatexInTree(node: ComponentNode): boolean {
  return someInTree(node, (n) => n.type === "katex")
}

/**
 * Children of a node that the plugin registry does not describe.
 *
 * PluginNode carries an `[key: string]: unknown` index signature, which widens
 * ComponentNode enough that `node.type === "box"` no longer narrows the union.
 * Each case therefore asserts the node type it just matched on.
 */
function legacyChildren(node: ComponentNode): ComponentNode[] {
  switch (node.type) {
    case "box":
      return (node as BoxNode).children
    case "card": {
      const card = node as CardNode
      return [...(card.header ?? []), ...(card.body ?? []), ...(card.footer ?? [])]
    }
    case "form":
      return (node as FormNode).fields
    case "modal":
      return (node as ModalNode).children
    case "island": {
      const island = node as IslandNode
      return [island.render(island.initialState)]
    }
    default:
      return []
  }
}

/** Depth-first search over a component tree, including plugin-declared children. */
function someInTree(node: ComponentNode, predicate: (node: ComponentNode) => boolean): boolean {
  if (predicate(node)) return true
  const plugin = getPlugin(node.type)
  const children = plugin?.nested ? plugin.nested(node) : legacyChildren(node)
  return children.some((child) => someInTree(child, predicate))
}

// ===== Compile a single page to file =====
export function compilePageToFile(page: PageNode, outputPath: string, options?: CompileOptions): void {
  const html = compilePage(page, options)
  const dir = path.dirname(outputPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(outputPath, html, "utf-8")
  console.log(`Compiled: ${outputPath}`)
}
