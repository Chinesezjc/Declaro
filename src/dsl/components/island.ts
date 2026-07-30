import type { ComponentBase } from "../core"
import type { ComponentNode } from "../component"

/**
 * State accessor handed to island handlers at runtime.
 * Mirrors the StateHandle produced by createState() in src/runtime/state.ts.
 */
export type IslandStateHandle = {
  /** Live proxy: assigning a property triggers a re-render. */
  state: Record<string, unknown>
  /** Merge a partial update and trigger a re-render. */
  set: (partial: Record<string, unknown>) => void
  /** Read a plain copy of the current state. */
  getSnapshot: () => Record<string, unknown>
}

/**
 * Island hydration strategy:
 * - "bindings": targeted data-dsl-* attribute updates (default, fastest)
 * - "rerender": full render() re-invocation + morphdom diff (for structural changes)
 */
export type IslandStrategy = "bindings" | "rerender"

/**
 * An Island is an interactive component with client-side state.
 */
export type IslandNode = ComponentBase & {
  type: "island"
  /** Unique island ID — required */
  id: string
  /** Initial state for the island */
  initialState: Record<string, unknown>
  /** Render function: receives current state, returns a ComponentNode tree */
  render: (state: Record<string, unknown>) => ComponentNode
  /**
   * Event handlers keyed by name. A button triggers one by setting
   * Button({ islandHandler: "<name>" }).
   */
  handlers?: Record<string, IslandHandler>
  /**
   * Hydration strategy. Default "bindings" for targeted updates,
   * "rerender" for full re-render with morphdom diffing.
   */
  strategy?: IslandStrategy
  /**
   * Enable access to page-level state.
   * When true, handlers receive pageStateHandle as their fourth argument.
   */
  usePageState?: boolean
}

/**
 * Island event handler.
 *
 * The body is serialized with Function.prototype.toString() at compile time, so
 * it runs with no access to the enclosing module scope: it may only reference
 * its own parameters, its own locals, literals, and globals reachable from the
 * browser at runtime. Imported helpers and module-level constants are NOT
 * available — put shared logic on a global namespace via Script({ inline }).
 *
 * The parameter list must be spelled out in full up to the last one used,
 * because the generated function is called positionally.
 */
export type IslandHandler = (
  event: Event,
  stateHandle: IslandStateHandle,
  container: HTMLElement,
  pageStateHandle?: IslandStateHandle,
) => void

export type IslandConfig = Omit<IslandNode, "type">

/**
 * Create an interactive Island component.
 */
export function Island(config: IslandConfig): IslandNode {
  return {
    type: "island",
    id: config.id,
    initialState: config.initialState,
    render: config.render,
    handlers: config.handlers,
    strategy: config.strategy,
    usePageState: config.usePageState,
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
