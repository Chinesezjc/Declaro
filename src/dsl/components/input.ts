import type { ComponentBase } from "../core"

export type InputNode = ComponentBase & {
  type: "input"
  name: string
  label?: string
  placeholder?: string
  required?: boolean
  defaultValue?: string
}

export function Input(config: Omit<InputNode, "type">): InputNode {
  return {
    type: "input",
    ...config,
  }
}
