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
} from "../dsl"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ===== CSS =====
function loadCSS(): string {
  const cssPath = path.resolve(__dirname, "../styles.css")
  return fs.readFileSync(cssPath, "utf-8")
}

// ===== Action to JS =====
function actionToJS(action: Action | undefined): string {
  if (!action) return ""
  const src = action.toString()
  // ctx.toast("msg", { variant: "...", duration: N })
  const toastMatch = src.match(
    /ctx\.toast\s*\(\s*["']([^"']+)["']\s*,\s*\{[^}]*variant\s*:\s*["'](\w+)["'][^}]*duration\s*:\s*(\d+)[^}]*\}/,
  )
  if (toastMatch) {
    const [, msg, variant, duration] = toastMatch
    const decoded = unescapeJSString(msg)
    return `showToast('${escapeJS(decoded)}','${variant}',${duration})`
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
  // Degraded: render as text showing the default value
  const label = node.label ?? node.name
  const defVal = node.defaultValue ?? node.min ?? 0
  return `<label class="dsl-field dsl-slider-field">
  <span>${escapeHTML(label)}</span>
  <output>${defVal}</output>
  <span class="dsl-slider-static">(${node.min ?? 0}–${node.max ?? 100})</span>
</label>`
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

// ===== Dispatch =====
function compileComponent(node: ComponentNode): string {
  const inner = compileComponentInner(node)
  return wrapAlign(node, inner)
}

function compileComponentInner(node: ComponentNode): string {
  switch (node.type) {
    case "text": return compileText(node)
    case "box": return compileBox(node)
    case "card": return compileCard(node)
    case "button": return compileButton(node)
    case "html": return node.html
    case "input": return compileInput(node)
    case "katex": return compileKatex(node)
    case "select": return compileSelect(node)
    case "slider": return compileSlider(node)
    case "textarea": return compileTextArea(node)
    case "form": return compileForm(node)
    case "table": return compileTable(node)
    case "list": return compileList(node)
    case "modal": return compileModal(node)
    default: return ""
  }
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
</head>
<body>
<div class="dsl-page dsl-layout-${page.env.layout}" data-page-id="${page.id}" data-env-id="${page.env.id}">
${layoutHTML}
</div>
<div class="toast-stack" role="status" aria-live="polite"></div>
<script>
// ===== Declaro Runtime =====
function toggleCollapse(btn) {
  var section = btn.closest('.dsl-card') || btn.closest('.dsl-box');
  if (!section) return;
  var isCollapsed = section.getAttribute('data-collapsed') === 'true';
  section.setAttribute('data-collapsed', String(!isCollapsed));
  btn.textContent = isCollapsed
    ? (btn.getAttribute('data-collapse-label') || '收起')
    : (btn.getAttribute('data-expand-label') || '展开');
  btn.setAttribute('aria-expanded', String(isCollapsed));
  var bodies = section.querySelectorAll('.dsl-card-body, .dsl-card-footer, .dsl-box-children');
  bodies.forEach(function(el) { el.style.display = isCollapsed ? '' : 'none'; });
}

function showToast(message, variant, duration) {
  var stack = document.querySelector('.toast-stack');
  if (!stack) return;
  var toast = document.createElement('div');
  toast.className = 'toast toast-' + (variant || 'info') + ' toast-entering-fade-right';
  toast.textContent = message;
  toast.style.animationDuration = '180ms';
  stack.appendChild(toast);
  var t1 = setTimeout(function() {
    toast.className = 'toast toast-' + (variant || 'info') + ' toast-visible';
  }, 180);
  var t2 = setTimeout(function() {
    toast.className = 'toast toast-' + (variant || 'info') + ' toast-exiting-fade-right';
    toast.style.animationDuration = '240ms';
    setTimeout(function() { toast.remove(); }, 240);
  }, (duration || 2600) + 180);
}

function handleFormSubmit(event, formId) {
  event.preventDefault();
  var form = event.target;
  var data = new FormData(form);
  var values = {};
  data.forEach(function(v, k) { values[k] = v; });
  fetch('/api/form/' + formId, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values)
  }).then(function(r) { return r.json(); })
    .then(function(result) {
      showToast(result.message || '已提交', result.ok ? 'success' : 'warning', 3000);
    })
    .catch(function() { showToast('提交失败', 'danger', 3000); });
}

// Load tables
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.dsl-table[data-datasource]').forEach(function(table) {
    var url = table.getAttribute('data-datasource');
    fetch(url).then(function(r) { return r.json(); })
      .then(function(data) {
        var rows = Array.isArray(data) ? data : (data.data || data.items || data.rows || []);
        var tbody = table.querySelector('tbody');
        if (!tbody || rows.length === 0) {
          if (tbody) tbody.innerHTML = '<tr><td colspan="99" class="dsl-table-empty">暂无数据</td></tr>';
          return;
        }
        var cols = table.querySelectorAll('th');
        var colKeys = [];
        cols.forEach(function(th) {
          var sortBtn = th.querySelector('.dsl-sort-btn');
          colKeys.push(sortBtn ? sortBtn.getAttribute('onclick').match(/'([^']+)'/)[1] : null);
        });
        tbody.innerHTML = rows.map(function(row) {
          return '<tr>' + colKeys.map(function(key) {
            var val = key ? (row[key] != null ? row[key] : '') : '';
            return '<td>' + (typeof val === 'boolean' ? (val ? '是' : '否') : String(val)) + '</td>';
          }).join('') + '</tr>';
        }).join('');
      })
      .catch(function() {
        var tbody = table.querySelector('tbody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="99" class="dsl-table-error">加载失败</td></tr>';
      });
  });

  // Init collapsible sections
  document.querySelectorAll('[data-collapsed="true"]').forEach(function(el) {
    el.querySelectorAll('.dsl-card-body, .dsl-card-footer, .dsl-box-children').forEach(function(child) {
      child.style.display = 'none';
    });
  });
});
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
