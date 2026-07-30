// DOM utilities for Declaro islands.
// Phase 5: extended with 6 granular bindings + morphdom support.

import morphdom from "morphdom"

export type EventHandler = (event: Event, el: HTMLElement) => void

/**
 * Patch element content using morphdom for incremental DOM updates.
 * Preserves event listeners and DOM state.
 */
export function patchElement(el: HTMLElement, html: string): void {
  morphdom(el, html, {
    onBeforeElUpdated: (fromEl, toEl) => {
      // Preserve event-bound elements: if fromEl has data-dsl-event, don't replace it
      if (fromEl.hasAttribute("data-dsl-event") && toEl.hasAttribute("data-dsl-event")) {
        return true
      }
      return true
    },
    childrenOnly: false,
  })
}

/**
 * Attach delegated event listeners for island interactivity.
 * Scans the subtree for [data-dsl-event] and dispatches to handler registry.
 */
export function bindIslandEvents(root: HTMLElement, registry: Record<string, EventHandler>): void {
  // Clean up previous handler
  const rootRecord = root as unknown as Record<string, unknown>
  const oldHandler = rootRecord.__dsl_event_handler as ((e: Event) => void) | undefined
  if (oldHandler) {
    root.removeEventListener("click", oldHandler, true)
    root.removeEventListener("input", oldHandler, true)
    root.removeEventListener("change", oldHandler, true)
    root.removeEventListener("submit", oldHandler, true)
    root.removeEventListener("keydown", oldHandler, true)
  }

  const handler = (e: Event): void => {
    const target = e.target as HTMLElement | null
    if (!target) return
    const el = target.closest("[data-dsl-event]") as HTMLElement | null
    if (!el || !root.contains(el)) return
    const attr = el.getAttribute("data-dsl-event")!
    const parts = attr.split(":")
    if (parts.length < 2) return
    const eventName = parts[0]
    const handlerKey = parts.slice(1).join(":")
    if (e.type !== eventName) return
    const fn = registry[handlerKey]
    if (fn) fn(e, el)
  }

  rootRecord.__dsl_event_handler = handler
  root.addEventListener("click", handler, true)
  root.addEventListener("input", handler, true)
  root.addEventListener("change", handler, true)
  root.addEventListener("submit", handler, true)
  root.addEventListener("keydown", handler, true)
}

// ===== Granular Reactive Bindings (Phase 5a) =====
//
// Six binding types, all handled by syncBindings() in a single pass:

/**
 * The nodes each list container rendered last time, so the next render can
 * remove exactly those.
 *
 * A WeakMap rather than an attribute sweep because the template is itself marked
 * with data-dsl-list-item, and because it keeps no reference to a container once
 * the container leaves the DOM.
 */
const listRenders = new WeakMap<HTMLElement, ChildNode[]>()

/**
 * Substitute {{prop}} in a rendered list item with the item's values, walking
 * text nodes and attributes rather than rewriting the item's HTML.
 *
 * Values are assigned as text and attribute values, so `<` and `&` in data stay
 * literal. Rewriting innerHTML instead made every value a markup injection
 * point: an account named `a<b>c` became a real <b> element, and any value could
 * close its own tag and add attributes.
 *
 * A non-object item fills {{_value}}, which is what a list of strings needs. An
 * absent property becomes the empty string rather than being left as the literal
 * {{prop}}, so a row with a missing field renders blank instead of showing the
 * placeholder.
 */
function fillPlaceholders(fragment: DocumentFragment, item: unknown): void {
  const resolve = (prop: string): string => {
    if (typeof item === "object" && item != null) {
      const val = (item as Record<string, unknown>)[prop]
      return val != null ? String(val) : ""
    }
    return prop === "_value" ? String(item) : ""
  }
  const substitute = (text: string): string =>
    text.replace(/\{\{(\w+)\}\}/g, (_m, prop: string) => resolve(prop))

  const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === 3) {
      const text = node.nodeValue
      if (text && text.includes("{{")) node.nodeValue = substitute(text)
      continue
    }
    // Attributes too: a row's href, title or data-* is as much a place for a
    // value as its text, and an unsubstituted {{pid}} in a data-pid is what an
    // island handler would then read.
    const el = node as HTMLElement
    for (const attr of Array.from(el.attributes)) {
      if (attr.value.includes("{{")) el.setAttribute(attr.name, substitute(attr.value))
    }
    applyItemAttrs(el, resolve)
  }
}

/**
 * Set or remove boolean attributes named by data-dsl-item-attr, from the item's
 * own properties.
 *
 * `data-dsl-item-attr="disabled:locked hidden:archived"` sets each attribute to
 * the empty string while the item's property is truthy and removes it otherwise.
 * An empty string, "false" and "0" all count as false, because the value arrives
 * through String() and a row's flag written as 0 or false means off.
 *
 * data-dsl-attr cannot do this: it reads island state, which is per-list rather
 * than per-row, so every row would get the same answer. A {{prop}} placeholder
 * cannot either — a boolean attribute is on as soon as it is present, whatever
 * its value, so `disabled="{{locked}}"` disables every row. Per-row `disabled`
 * and `hidden` are what a table of action buttons needs: a task that is no longer
 * pending must not offer "start now", and the session you are using must not
 * offer to revoke itself.
 */
function applyItemAttrs(el: HTMLElement, resolve: (prop: string) => string): void {
  const spec = el.getAttribute("data-dsl-item-attr")
  if (!spec) return
  for (const pair of spec.split(/\s+/)) {
    if (!pair) continue
    const colonIdx = pair.indexOf(":")
    if (colonIdx < 0) continue
    const attrName = pair.slice(0, colonIdx)
    const prop = pair.slice(colonIdx + 1)
    if (!attrName || !prop) continue
    const val = resolve(prop)
    if (val === "" || val === "false" || val === "0") {
      el.removeAttribute(attrName)
    } else {
      el.setAttribute(attrName, "")
    }
  }
}

/**
 * Every element in scope carrying `selector`, including scope itself.
 *
 * querySelectorAll alone never matches the element it is called on, which is
 * exactly the case for a list row: the row is the top-level node the template
 * produced, so a binding declared on the <tr> would be skipped while one on a
 * <td> inside it would not.
 */
function boundElements(scope: HTMLElement, selector: string): HTMLElement[] {
  const found = Array.from(scope.querySelectorAll<HTMLElement>(selector))
  return scope.matches(selector) ? [scope, ...found] : found
}

/**
 * Update all data-dsl-* bindings within root to reflect current state.
 *
 * Binding types:
 *   data-dsl-text="key"         → el.textContent = String(state[key])
 *   data-dsl-show="key"         → el.style.display = state[key] ? '' : 'none'
 *   data-dsl-class="cls:key"    → el.classList.toggle(cls, !!state[key])
 *   data-dsl-attr="attr:key"    → state[key] ? el.setAttribute(attr, '') : el.removeAttribute(attr)
 *   data-dsl-attr="attr:key=val"→ if state[key]===val → set attr, else remove
 *   data-dsl-attr-value="attr:key" → el.setAttribute(attr, String(state[key])), removed when empty
 *   data-dsl-list="key"         → render array from <template data-dsl-list-item>
 *   data-dsl-html="key"         → el.innerHTML = String(state[key])
 *
 * The list render happens last and then applies the other bindings to each row it
 * produced, because a row is created during this pass and would otherwise never
 * be visited: the scalar passes already ran, and the next call discards the row
 * and builds a new one. Without it a data-dsl-attr inside a row template is dead
 * markup, which is what a per-list "disabled while a request is in flight" needs.
 */
export function syncBindings(root: HTMLElement, state: Record<string, unknown>): void {
  syncScalarBindings(root, state)
  syncListBindings(root, state)
}

/** Everything except list rendering, over one scope. */
function syncScalarBindings(root: HTMLElement, state: Record<string, unknown>): void {
  // 1. Text bindings
  boundElements(root, "[data-dsl-text]").forEach((el) => {
    const key = el.getAttribute("data-dsl-text")!
    const val = state[key]
    el.textContent = val != null ? String(val) : ""
  })

  // 2. Show/hide bindings
  boundElements(root, "[data-dsl-show]").forEach((el) => {
    const key = el.getAttribute("data-dsl-show")!
    el.style.display = state[key] ? "" : "none"
  })

  // 3. Class toggle bindings
  boundElements(root, "[data-dsl-class]").forEach((el) => {
    const attr = el.getAttribute("data-dsl-class")!
    const colonIdx = attr.indexOf(":")
    if (colonIdx < 0) return
    const cls = attr.slice(0, colonIdx)
    const key = attr.slice(colonIdx + 1)
    el.classList.toggle(cls, !!state[key])
  })

  // 4. Attribute bindings
  boundElements(root, "[data-dsl-attr]").forEach((el) => {
    const attr = el.getAttribute("data-dsl-attr")!
    const colonIdx = attr.indexOf(":")
    if (colonIdx < 0) return
    const attrName = attr.slice(0, colonIdx)
    const rest = attr.slice(colonIdx + 1)
    // Check for "attr:key=val" pattern
    const eqIdx = rest.indexOf("=")
    if (eqIdx >= 0) {
      const key = rest.slice(0, eqIdx)
      const targetVal = rest.slice(eqIdx + 1)
      if (String(state[key]) === targetVal) {
        el.setAttribute(attrName, "")
      } else {
        el.removeAttribute(attrName)
      }
    } else {
      const key = rest
      if (state[key]) {
        el.setAttribute(attrName, "")
      } else {
        el.removeAttribute(attrName)
      }
    }
  })

  // 4b. Attribute value bindings.
  //
  // data-dsl-attr sets an attribute to the empty string, which is what a boolean
  // attribute wants but useless for one whose value is read — a data-* attribute
  // a CSS selector matches on, for instance. This writes the state value itself.
  boundElements(root, "[data-dsl-attr-value]").forEach((el) => {
    const spec = el.getAttribute("data-dsl-attr-value")!
    const colonIdx = spec.indexOf(":")
    if (colonIdx < 0) return
    const attrName = spec.slice(0, colonIdx)
    const key = spec.slice(colonIdx + 1)
    const val = state[key]
    // An empty or absent value removes the attribute, so `[attr]` selectors and
    // `:not([attr])` behave the same way they would on a never-set attribute.
    if (val == null || val === "") {
      el.removeAttribute(attrName)
    } else {
      el.setAttribute(attrName, String(val))
    }
  })

  // 6. HTML bindings
  boundElements(root, "[data-dsl-html]").forEach((el) => {
    const key = el.getAttribute("data-dsl-html")!
    const val = state[key]
    el.innerHTML = val != null ? String(val) : ""
  })
}

/**
 * Render every list under root, then apply the scalar bindings to each row.
 *
 * A row is built here, after the scalar passes have already run, so it has to be
 * visited explicitly — and it cannot wait for the next call, which discards this
 * row and builds a fresh one from the template. The scope passed for each row is
 * the row element itself, which is why the scalar passes match their scope as well
 * as its descendants: a binding declared on the <tr> is on the row's own element.
 */
function syncListBindings(root: HTMLElement, state: Record<string, unknown>): void {
  boundElements(root, "[data-dsl-list]").forEach((container) => {
    const key = container.getAttribute("data-dsl-list")!
    const items = state[key]
    if (!Array.isArray(items)) return
    const template = container.querySelector<HTMLTemplateElement>("template[data-dsl-list-item]")
    if (!template) return

    // The template stays in the DOM and carries data-dsl-list-item, so a page
    // rule keyed on that attribute — `[data-dsl-list-item] { display: block }` —
    // matches it too and overrides the `display: none` a <template> gets from the
    // UA stylesheet, giving the template a rendered box. An inline style outranks
    // the page rule and keeps it out of layout.
    template.style.display = "none"

    // Remove exactly the nodes the last render appended, tracked in listRenders
    // rather than matched with a selector. The template carries
    // data-dsl-list-item itself, so a querySelectorAll sweep for that attribute
    // deletes the template along with the rows — after which every later render
    // finds no template and returns, freezing the list at its first render. An
    // empty first render is enough to trigger it.
    const previous = listRenders.get(container)
    if (previous) previous.forEach((node) => node.remove())

    const rendered: ChildNode[] = []
    items.forEach((item: unknown, index: number) => {
      const clone = template.content.cloneNode(true) as DocumentFragment
      fillPlaceholders(clone, item)

      // Mark the top-level elements, then append. The rows go in as nodes, not
      // as an HTML string, and without a wrapper element around each one: a
      // <tr> reaches its <tbody> and an <li> its <ul> directly. Wrapping in a
      // <div> and assigning innerHTML dropped both, because neither tag is
      // allowed inside a div and the parser discards what it cannot place.
      const nodes = Array.from(clone.childNodes)
      for (const node of nodes) {
        if (node.nodeType === 1) {
          const el = node as HTMLElement
          el.setAttribute("data-dsl-list-item", "")
          el.setAttribute("data-dsl-list-index", String(index))
        }
      }
      container.appendChild(clone)
      rendered.push(...nodes)

      // Now that the row is in the document, give it the scalar bindings. Only
      // the row and its descendants, so a nested list inside a row is left for
      // the recursion below rather than being rendered twice.
      for (const node of nodes) {
        if (node.nodeType === 1) syncScalarBindings(node as HTMLElement, state)
      }
    })
    listRenders.set(container, rendered)

    // A row may itself contain a list — a per-row detail table, say — and that
    // container did not exist when the outer querySelectorAll ran.
    for (const node of rendered) {
      if (node.nodeType === 1) syncListBindings(node as HTMLElement, state)
    }
  })
}

/**
 * Legacy syncTextBindings — now delegates to syncBindings.
 * Kept for backward compat with existing compiled pages.
 */
export function syncTextBindings(root: HTMLElement, state: Record<string, unknown>): void {
  syncBindings(root, state)
}

/**
 * Escape HTML entities.
 */
export function escapeHTML(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
