import type { ComponentBase } from "../core"
import type { ComponentNode } from "../component"

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
   * Event handlers keyed by name.
   * Handlers receive (event, state, set) where `set` updates state and triggers re-render.
   */
  handlers?: Record<string, IslandHandler>
  /**
   * Hydration strategy. Default "bindings" for targeted updates,
   * "rerender" for full re-render with morphdom diffing.
   */
  strategy?: IslandStrategy
  /**
   * Enable access to page-level state.
   * When true, handlers receive (event, state, set, pageState, setPageState).
   */
  usePageState?: boolean
}

export type IslandHandler = (
  event: Event,
  state: Record<string, unknown>,
  set: (partial: Record<string, unknown>) => void,
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
