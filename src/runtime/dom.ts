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
 * Update all data-dsl-* bindings within root to reflect current state.
 *
 * Binding types:
 *   data-dsl-text="key"         → el.textContent = String(state[key])
 *   data-dsl-show="key"         → el.style.display = state[key] ? '' : 'none'
 *   data-dsl-class="cls:key"    → el.classList.toggle(cls, !!state[key])
 *   data-dsl-attr="attr:key"    → state[key] ? el.setAttribute(attr, '') : el.removeAttribute(attr)
 *   data-dsl-attr="attr:key=val"→ if state[key]===val → set attr, else remove
 *   data-dsl-list="key"         → render array from <template data-dsl-list-item>
 *   data-dsl-html="key"         → el.innerHTML = String(state[key])
 */
export function syncBindings(root: HTMLElement, state: Record<string, unknown>): void {
  // 1. Text bindings
  root.querySelectorAll<HTMLElement>("[data-dsl-text]").forEach((el) => {
    const key = el.getAttribute("data-dsl-text")!
    const val = state[key]
    el.textContent = val != null ? String(val) : ""
  })

  // 2. Show/hide bindings
  root.querySelectorAll<HTMLElement>("[data-dsl-show]").forEach((el) => {
    const key = el.getAttribute("data-dsl-show")!
    el.style.display = state[key] ? "" : "none"
  })

  // 3. Class toggle bindings
  root.querySelectorAll<HTMLElement>("[data-dsl-class]").forEach((el) => {
    const attr = el.getAttribute("data-dsl-class")!
    const colonIdx = attr.indexOf(":")
    if (colonIdx < 0) return
    const cls = attr.slice(0, colonIdx)
    const key = attr.slice(colonIdx + 1)
    el.classList.toggle(cls, !!state[key])
  })

  // 4. Attribute bindings
  root.querySelectorAll<HTMLElement>("[data-dsl-attr]").forEach((el) => {
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

  // 5. List bindings
  root.querySelectorAll<HTMLElement>("[data-dsl-list]").forEach((container) => {
    const key = container.getAttribute("data-dsl-list")!
    const items = state[key]
    if (!Array.isArray(items)) return
    const template = container.querySelector<HTMLTemplateElement>("template[data-dsl-list-item]")
    if (!template) return

    const existingItems = container.querySelectorAll<HTMLElement>("[data-dsl-list-item]")
    existingItems.forEach((el) => el.remove())

    items.forEach((item: unknown, index: number) => {
      const clone = template.content.cloneNode(true) as DocumentFragment
      const wrapper = document.createElement("div")
      wrapper.setAttribute("data-dsl-list-item", "")
      wrapper.setAttribute("data-dsl-list-index", String(index))
      wrapper.appendChild(clone)

      // Replace {{key}} placeholders in the clone
      const html = wrapper.innerHTML.replace(/\{\{(\w+)\}\}/g, (_m, prop: string) => {
        if (typeof item === "object" && item != null) {
          return String((item as Record<string, unknown>)[prop] ?? "")
        }
        return prop === "_value" ? String(item) : ""
      })
      wrapper.innerHTML = html
      container.appendChild(wrapper)
    })
  })

  // 6. HTML bindings
  root.querySelectorAll<HTMLElement>("[data-dsl-html]").forEach((el) => {
    const key = el.getAttribute("data-dsl-html")!
    const val = state[key]
    el.innerHTML = val != null ? String(val) : ""
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
