// Island registration and hydration orchestration.
// Phase 5: adds rerender strategy + pageState support.

import { type StateHandle, createState } from "./state"
import { bindIslandEvents, syncBindings, patchElement, type EventHandler } from "./dom"

export interface IslandDefinition {
  id: string
  initialState: Record<string, unknown>
  handlers: Record<string, IslandHandler>
  /** Hydration strategy: "bindings" (default) or "rerender" */
  strategy?: "bindings" | "rerender"
  /** Serialized render function body for rerender strategy */
  renderFn?: (state: Record<string, unknown>) => string
  /** Whether this island uses page-level state */
  usePageState?: boolean
}

export type IslandHandler = (
  event: Event,
  stateHandle: StateHandle<Record<string, unknown>>,
  container: HTMLElement,
  pageStateHandle?: StateHandle<Record<string, unknown>>,
) => void

const islandRegistry = new Map<string, IslandDefinition>()
let pageStateHandle: StateHandle<Record<string, unknown>> | null = null

/** Set the page-level state handle (called by compiler-generated script). */
export function setPageState(handle: StateHandle<Record<string, unknown>>): void {
  pageStateHandle = handle
}

/** Register an island definition. Call BEFORE hydrateAll(). */
export function defineIsland(def: IslandDefinition): void {
  islandRegistry.set(def.id, def)
}

/** Hydrate all registered islands. */
export function hydrateAll(): void {
  islandRegistry.forEach((def) => {
    const container = document.querySelector<HTMLElement>(`[data-island="${def.id}"]`)
    if (!container) return

    // Read initial state
    const stateJson = container.getAttribute("data-dsl-initial-state")
    let initialState = def.initialState
    if (stateJson) {
      try { initialState = JSON.parse(stateJson) } catch { /* use default */ }
    }

    const stateHandle = createState(initialState)

    // Create wrapped handlers
    const wrappedHandlers: Record<string, EventHandler> = {}
    for (const key of Object.keys(def.handlers)) {
      wrappedHandlers[key] = (event: Event, _el: HTMLElement) => {
        def.handlers[key](event, stateHandle, container, pageStateHandle ?? undefined)
      }
    }

    bindIslandEvents(container, wrappedHandlers)

    // State change → update DOM
    if (def.strategy === "rerender" && def.renderFn) {
      // Full re-render strategy
      stateHandle.subscribe(() => {
        const newHTML = def.renderFn!(stateHandle.getSnapshot())
        patchElement(container, newHTML)
        // Re-bind events after DOM replacement
        bindIslandEvents(container, wrappedHandlers)
      })
      // Initial render
      const initialHTML = def.renderFn(stateHandle.getSnapshot())
      patchElement(container, initialHTML)
      bindIslandEvents(container, wrappedHandlers)
    } else {
      // Bindings strategy (default)
      stateHandle.subscribe(() => {
        syncBindings(container, stateHandle.getSnapshot())
      })
      syncBindings(container, stateHandle.getSnapshot())
    }

    // If using pageState, subscribe to pageState changes → update local state
    if (def.usePageState && pageStateHandle) {
      pageStateHandle.subscribe(() => {
        syncBindings(container, stateHandle.getSnapshot())
      })
    }

    container.setAttribute("data-dsl-hydrated", "true")
    ;(container as unknown as Record<string, unknown>).__dsl_state = stateHandle
  })
}

/** Get the StateHandle for an island by its ID. */
export function getIslandState(id: string): StateHandle<Record<string, unknown>> | null {
  const container = document.querySelector<HTMLElement>(`[data-island="${id}"]`)
  if (!container) return null
  return ((container as unknown as Record<string, unknown>).__dsl_state as StateHandle<Record<string, unknown>>) ?? null
}
