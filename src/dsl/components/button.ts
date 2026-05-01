import type { Action, ComponentBase } from "../core"

export type ButtonNode = ComponentBase & {
  type: "button"
  text: string
  variant?: "primary" | "secondary" | "danger" | "ghost"
  disabled?: boolean
  onClick?: Action
  onHover?: Action
}

export function Button(config: Omit<ButtonNode, "type">): ButtonNode {
  return {
    type: "button",
    ...config,
  }
}
