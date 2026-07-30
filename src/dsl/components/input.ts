import type { ComponentBase } from "../core"

export type InputNode = ComponentBase & {
  type: "input"
  name: string
  label?: string
  placeholder?: string
  required?: boolean
  defaultValue?: string
  /** Enclosing Island handler to invoke, and on which DOM event. */
  islandHandler?: string
  islandEvent?: "input" | "change" | "keydown"
}

export function Input(config: Omit<InputNode, "type">): InputNode {
  return {
    type: "input",
    ...config,
  }
}
