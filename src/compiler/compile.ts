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

  const inner = `<${tag} class="${cls}"${style ? ` style="${style}"` : ""}>${bodyHTML}</${tag}>`

  if (node.titleActions && node.titleActions.length > 0) {
    const actions = node.titleActions.map(compileComponent).join("")
    return `<div class="dsl-titlebar">${inner}<div class="dsl-titlebar-actions">${actions}</div></div>`
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
    const collId = node.collapsible ? ` data-collapse-id="bx-${node.id ?? Math.random().toString(36).slice(2)}"` : ""
    const toggleBtn = node.collapsible
      ? `<button class="dsl-collapse-toggle" onclick="toggleCollapse(this)" data-expand-label="${escapeHTML(node.expandLabel ?? "展开")}" data-collapse-label="${escapeHTML(node.collapseLabel ?? "收起")}" aria-expanded="${node.defaultCollapsed ? "false" : "true"}">${node.defaultCollapsed ? (node.expandLabel ?? "展开") : (node.collapseLabel ?? "收起")}</button>`
      : ""
    titleBar = `<div class="dsl-titlebar"${collId}>${titleTag}<div class="dsl-titlebar-actions">${actions}${toggleBtn}</div></div>`
  }

  const collapsed = node.collapsible && node.defaultCollapsed ? ` data-collapsed="true"` : ""
  const scroll = node.scroll && node.scroll !== "none" ? ` style="overflow-${node.scroll === "both" ? "auto" : node.scroll}"` : ""
  const childrenDisplay = node.collapsible && node.defaultCollapsed ? ` style="display:none"` : ""

  return `<section class="${cls}"${style ? ` style="${style}"` : ""}${collapsed}${scroll}>
  ${titleBar}
  <div class="dsl-box-children" style="${childrenStyle}"${childrenDisplay}>${childrenHTML}</div>
</section>`
}

function compileCard(node: CardNode): string {
  const collId = node.collapsible ? ` data-collapse-id="card-${node.id ?? Math.random().toString(36).slice(2)}"` : ""
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

  return `<section class="dsl-card"${collapsedAttr}>
  <div class="dsl-card-header">
    <div class="dsl-titlebar"${collId}>${title}<div class="dsl-titlebar-actions">${titleActions}${toggleBtn}</div></div>
    ${header}
  </div>
  <div class="dsl-card-body"${bodyDisplay}>${body}</div>
  ${footer ? `<div class="dsl-card-footer"${footerDisplay}>${footer}</div>` : ""}
</section>`
}

function compileButton(node: ButtonNode): string {
  const variant = node.variant ?? "secondary"
  const disabled = node.disabled ? " disabled" : ""
  const onClick = actionToJS(node.onClick)
  const onclickAttr = onClick ? ` onclick="${onClick}"` : ""
  return `<button class="dsl-button dsl-button-${variant}" type="button"${disabled}${onclickAttr}>${escapeHTML(node.text)}</button>`
}

function compileInput(node: InputNode): string {
  const required = node.required ? " required" : ""
  const placeholder = node.placeholder ? ` placeholder="${escapeHTML(node.placeholder)}"` : ""
  const value = node.defaultValue ? ` value="${escapeHTML(node.defaultValue)}"` : ""
  return `<label class="dsl-field">
  <span>${escapeHTML(node.label ?? node.name)}</span>
  <input name="${node.name}"${placeholder}${required}${value}>
</label>`
}

function compileSelect(node: SelectNode): string {
  const required = node.required ? " required" : ""
  const multiple = node.multiple ? " multiple" : ""
  const options = node.options
    .map((o) => `<option value="${escapeHTML(o.value)}">${escapeHTML(o.label)}</option>`)
    .join("")
  return `<label class="dsl-field">
  <span>${escapeHTML(node.label ?? node.name)}</span>
  <select name="${node.name}"${required}${multiple}>${options}</select>
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
  return `<div class="dsl-slider-field" data-dsl-slider='${sliderConfig}'>
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
  return `<label class="dsl-field">
  <span>${escapeHTML(node.label ?? node.name)}</span>
  <textarea name="${node.name}"${placeholder}${required}${rows}></textarea>
</label>`
}

function compileForm(node: FormNode): string {
  const fields = node.fields.map(compileComponent).join("")
  const submitBtn = node.submitButton ? compileButton(node.submitButton) : `<button class="dsl-button dsl-button-primary" type="submit">提交</button>`
  const onSignal = node.onSignal ? ` data-signal="${escapeJS(node.onSignal.toString().slice(0, 200))}"` : ""

  return `<form class="dsl-form" id="${node.id}" method="post" action="/api/form/${node.id}" onsubmit="handleFormSubmit(event,'${node.id}')"${onSignal}>
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

  return `<section class="dsl-table-card" data-datasource="${escapeHTML(node.dataSource)}">
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

  return `<section class="dsl-list"${node.dataSource ? ` data-datasource="${escapeHTML(node.dataSource)}"` : ""}>
  <div class="dsl-list-items">${itemsHTML || '<span class="dsl-list-empty">无数据</span>'}</div>
</section>`
}

function compileModal(node: ModalNode): string {
  const title = node.title ? `<h2>${escapeHTML(node.title)}</h2>` : ""
  const children = node.children.map(compileComponent).join("")
  return `<section class="dsl-modal" id="${node.id}" hidden>
  ${title}
  <div class="dsl-modal-body">${children}</div>
</section>`
}

// ===== Island =====
function compileIsland(node: IslandNode): string {
  // Compile the initial render to static HTML
  const childTree = node.render(node.initialState)
  const staticHTML = compileComponent(childTree)

  // Walk the child tree to find Text nodes that reference state properties,
  // marking them with data-dsl-text attributes for runtime binding.
  let markedHTML = markStateBindings(staticHTML, childTree, node.initialState)

  // Collect handler names and wire up button events
  const handlerNames = node.handlers ? Object.keys(node.handlers) : []

  // Add data-dsl-event attributes to buttons by matching handler names to button text
  // Strategy: each handler is mapped to a button whose text matches (case-insensitive camelCase)
  if (handlerNames.length > 0) {
    // Replace button elements to include data-dsl-event attributes
    // We assign handlers to buttons in document order
    let handlerIdx = 0
    markedHTML = markedHTML.replace(
      /<button class="dsl-button([^"]*)" type="button"([^>]*)>/g,
      (match, cls, rest) => {
        if (handlerIdx < handlerNames.length) {
          const name = handlerNames[handlerIdx]
          handlerIdx++
          // Insert data-dsl-event before closing >
          return `<button class="dsl-button${cls}" type="button" data-dsl-event="click:${escapeHTML(name)}"${rest}>`
        }
        return match
      },
    )
  }

  // Generate island definition script
  const stateJson = JSON.stringify(node.initialState)
  const handlerDefs = handlerNames
    .map((name) => {
      const handler = node.handlers![name]
      const fnBody = handler.toString()
      return `function __dsl_h_${safeJSId(node.id)}_${safeJSId(name)}(event,stateHandle,container){${generateHandlerBody(fnBody)}}`
    })
    .join("\n")
  const handlerMap = handlerNames
    .map((name) => `"${name}":__dsl_h_${safeJSId(node.id)}_${safeJSId(name)}`)
    .join(",")

  return `<div data-island="${escapeHTML(node.id)}" data-dsl-initial-state='${escapeHTML(stateJson)}'>
${markedHTML}
</div>
<script>
${handlerDefs}
__DSL__.defineIsland({
  id: "${escapeJS(node.id)}",
  initialState: ${stateJson},
  handlers: {${handlerMap}}
});
__DSL__.hydrateAll();
</script>`
}

// Walk the compiled HTML and child tree to insert data-dsl-text markers
function markStateBindings(html: string, tree: ComponentNode, state: Record<string, unknown>): string {
  // Find Text nodes whose text contains state property values
  // and wrap those values in <span data-dsl-text="key">value</span>
  let result = html
  for (const key of Object.keys(state)) {
    const val = state[key]
    if (val == null) continue
    const strVal = String(val)
    // Only replace if the value appears as text content (not inside HTML tags)
    const textRegex = new RegExp(`(>)([^<]*?)(${escapeRegex(strVal)})([^<]*?)(<)`, "g")
    result = result.replace(textRegex, (_m, before, prefix, match, suffix, after) => {
      return `${before}${escapeHTML(prefix)}<span data-dsl-text="${escapeHTML(key)}">${escapeHTML(match)}</span>${escapeHTML(suffix)}${after}`
    })
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
  // Extract the function body from the toString() output
  // The handler signature is (event, state, set) => { ... }
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
    return node.displayMode
      ? `<div class="dsl-katex dsl-katex-block">${html}</div>`
      : `<span class="dsl-katex dsl-katex-inline">${html}</span>`
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
}

export function compilePage(page: PageNode, options: CompileOptions = {}): string {
  const css = loadCSS()
  const slotted = groupBySlot(page.children, page.env.slots.includes("main") ? "main" : page.env.slots[0] ?? "main")
  const layoutHTML = compileLayoutShell(page.env, page.children)
  const headHTML = page.head ? page.head.map(compileComponent).join("\n") : ""

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHTML(options.title ?? page.title)}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
<style>
${css}
</style>
${headHTML}
</head>
<body>
<div class="dsl-page dsl-layout-${page.env.layout}" data-page-id="${page.id}" data-env-id="${page.env.id}">
${layoutHTML}
</div>
<div class="toast-stack" role="status" aria-live="polite"></div>
<script>
${RUNTIME_JS}
</script>
</body>
</html>`
}

// ===== Compile a single page to file =====
export function compilePageToFile(page: PageNode, outputPath: string, options?: CompileOptions): void {
  const html = compilePage(page, options)
  const dir = path.dirname(outputPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(outputPath, html, "utf-8")
  console.log(`Compiled: ${outputPath}`)
}
