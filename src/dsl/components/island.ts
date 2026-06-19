import type { ComponentBase } from "../core"
import type { ComponentNode } from "../component"

/**
 * An Island is an interactive component with client-side state.
 *
 * The compiler:
 * 1. Calls `render(initialState)` at compile time for the initial static HTML
 * 2. Marks state-dependent text with `data-dsl-text` attributes
 * 3. Serializes handler functions as named JS functions
 * 4. Injects island registration + hydration calls
 *
 * The runtime:
 * 1. Creates a reactive StateHandle from initialState
 * 2. Binds event handlers to `[data-dsl-event]` elements
 * 3. On state change, updates `[data-dsl-text]` elements
 */
export type IslandNode = ComponentBase & {
  type: "island"
  /** Unique island ID (used as data-island attribute value) — required */
  id: string
  /** Initial state for the island */
  initialState: Record<string, unknown>
  /** Render function: receives current state, returns a ComponentNode tree */
  render: (state: Record<string, unknown>) => ComponentNode
  /**
   * Event handlers keyed by name.
   * Handlers receive (event, state, set) where `set` updates state and triggers re-render.
   */
  handlers?: Record<string, IslandHandler>
}

export type IslandHandler = (
  event: Event,
  state: Record<string, unknown>,
  set: (partial: Record<string, unknown>) => void,
) => void

export type IslandConfig = Omit<IslandNode, "type">

/**
 * Create an interactive Island component.
 *
 * @example
 * ```ts
 * Island({
 *   id: "counter",
 *   initialState: { count: 0 },
 *   render: ({ count }) =>
 *     Box({ children: [
 *       Text({ text: `Count: ${count}` }),
 *       Button({ text: "+1", onClick: () => {} }),
 *     ]}),
 *   handlers: {
 *     increment: (_event, state, set) => {
 *       set({ count: (state.count as number) + 1 })
 *     },
 *   },
 * })
 * ```
 */
export function Island(config: IslandConfig): IslandNode {
  return {
    type: "island",
    id: config.id,
    initialState: config.initialState,
    render: config.render,
    handlers: config.handlers,
    slot: config.slot,
    order: config.order,
    visible: config.visible,
    roles: config.roles,
    meta: config.meta,
    alignX: config.alignX,
    alignY: config.alignY,
    sizeX: config.sizeX,
    sizeY: config.sizeY,
  }
}
