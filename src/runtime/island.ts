// Island registration and hydration orchestration.

import { type StateHandle, createState } from "./state"
import { bindIslandEvents, syncTextBindings, type EventHandler } from "./dom"

export interface IslandDefinition {
  /** Unique island ID, matches data-island attribute */
  id: string
  /** Initial state object */
  initialState: Record<string, unknown>
  /** Event handler map: key -> handler function */
  handlers: Record<string, IslandHandler>
}

export type IslandHandler = (
  event: Event,
  stateHandle: StateHandle<Record<string, unknown>>,
  container: HTMLElement,
) => void

const islandRegistry = new Map<string, IslandDefinition>()

/** Register an island definition. Call BEFORE hydrateAll(). */
export function defineIsland(def: IslandDefinition): void {
  islandRegistry.set(def.id, def)
}

/** Hydrate all registered islands: find DOM elements, attach state, bind events. */
export function hydrateAll(): void {
  islandRegistry.forEach((def) => {
    const container = document.querySelector<HTMLElement>(`[data-island="${def.id}"]`)
    if (!container) return

    // Read initial state from the DOM (compiler may have updated it)
    const stateJson = container.getAttribute("data-dsl-initial-state")
    let initialState = def.initialState
    if (stateJson) {
      try {
        initialState = JSON.parse(stateJson)
      } catch {
        // use default
      }
    }

    const stateHandle = createState(initialState)

    // Wrap handlers to inject stateHandle + container
    const wrappedHandlers: Record<string, EventHandler> = {}
    for (const key of Object.keys(def.handlers)) {
      wrappedHandlers[key] = (event: Event, _el: HTMLElement) => {
        def.handlers[key](event, stateHandle, container)
      }
    }

    // Bind events
    bindIslandEvents(container, wrappedHandlers)

    // Subscribe to state changes → update text bindings
    stateHandle.subscribe(() => {
      syncTextBindings(container, stateHandle.getSnapshot())
    })

    // Initial text binding sync
    syncTextBindings(container, stateHandle.getSnapshot())

    // Store handle for external access
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
