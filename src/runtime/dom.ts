// DOM utilities for Declaro islands.

export type EventHandler = (event: Event, el: HTMLElement) => void

/**
 * Replace inner content of an element with new HTML.
 * Preserves the element itself so event listeners on the container survive.
 */
export function patchElement(el: HTMLElement, html: string): void {
  el.innerHTML = html
}

/**
 * Attach event listeners specified by `data-dsl-event` attributes.
 * Format: `data-dsl-event="eventName:handlerKey"`
 *
 * Uses a single delegated listener on the root element, dispatching
 * by `eventName:handlerKey` pairs.
 */
export function bindIslandEvents(root: HTMLElement, registry: Record<string, EventHandler>): void {
  // Remove previous delegated listener if any
  const oldHandler = (root as unknown as Record<string, unknown>).__dsl_event_handler as
    | ((e: Event) => void)
    | undefined
  if (oldHandler) {
    root.removeEventListener("click", oldHandler, true)
    root.removeEventListener("input", oldHandler, true)
    root.removeEventListener("change", oldHandler, true)
    root.removeEventListener("submit", oldHandler, true)
  }

  const handler = (e: Event): void => {
    const target = e.target as HTMLElement | null
    if (!target) return
    // Walk up to find the element with data-dsl-event
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

  ;(root as unknown as Record<string, unknown>).__dsl_event_handler = handler
  root.addEventListener("click", handler, true)
  root.addEventListener("input", handler, true)
  root.addEventListener("change", handler, true)
  root.addEventListener("submit", handler, true)
}

/**
 * Update all `[data-dsl-text]` elements within root to reflect current state.
 */
export function syncTextBindings(root: HTMLElement, state: Record<string, unknown>): void {
  root.querySelectorAll<HTMLElement>("[data-dsl-text]").forEach((el) => {
    const key = el.getAttribute("data-dsl-text")!
    const val = state[key]
    el.textContent = val != null ? String(val) : ""
  })
}

/**
 * Escape HTML entities to prevent XSS.
 */
export function escapeHTML(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
