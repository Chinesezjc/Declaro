import type { ComponentBase } from "../core"

/**
 * A React Island wraps a third-party React component for use in Declaro pages.
 *
 * At compile time, the compiler emits a mount point + dynamic import script.
 * At runtime, the React Bridge hydrates the mount point with the React component.
 *
 * @example
 * ```ts
 * ReactIsland({
 *   id: "datepicker",
 *   component: "react-datepicker",
 *   props: { selected: "2026-06-20" },
 * })
 * ```
 */
export type ReactIslandNode = ComponentBase & {
  type: "react-island"
  /** Unique ID for this island */
  id: string
  /** npm package name or module path of the React component */
  component: string
  /** Props to pass to the React component (serialized as JSON) */
  props?: Record<string, unknown>
}

export type ReactIslandConfig = Omit<ReactIslandNode, "type">

export function ReactIsland(config: ReactIslandConfig): ReactIslandNode {
  return {
    type: "react-island",
    id: config.id,
    component: config.component,
    props: config.props,
    slot: config.slot,
    order: config.order,
    visible: config.visible,
    roles: config.roles,
    meta: config.meta,
  }
}
