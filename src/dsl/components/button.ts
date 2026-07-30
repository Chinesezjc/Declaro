import type { Action, ComponentBase } from "../core"

export type ButtonNode = ComponentBase & {
  type: "button"
  text: string
  variant?: "primary" | "secondary" | "danger" | "ghost"
  disabled?: boolean
  onClick?: Action
  onHover?: Action
  /**
   * Name of the enclosing Island's handler to invoke on click.
   * Required to wire a button inside an Island: the compiler emits
   * data-dsl-event="click:<name>" from this field. Without it the button
   * stays inert, because a button cannot be matched to a handler by position.
   */
  islandHandler?: string
}

export function Button(config: Omit<ButtonNode, "type">): ButtonNode {
  return {
    type: "button",
    ...config,
  }
}
