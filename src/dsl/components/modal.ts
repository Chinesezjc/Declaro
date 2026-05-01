import type { Action, ComponentBase } from "../core"
import type { ComponentNode } from "../component"

export type ModalNode = ComponentBase & {
  type: "modal"
  id: string
  title?: string
  onSignal?: Action
  children: ComponentNode[]
}

export function Modal(config: Omit<ModalNode, "type">): ModalNode {
  return {
    type: "modal",
    ...config,
    children: [...config.children],
  }
}
