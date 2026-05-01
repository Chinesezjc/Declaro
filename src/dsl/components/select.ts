import type { ComponentBase } from "../core"

export type SelectOption = {
  label: string
  value: string
}

export type SelectNode = ComponentBase & {
  type: "select"
  name: string
  label?: string
  options: SelectOption[]
  multiple?: boolean
  required?: boolean
}

export function Select(config: Omit<SelectNode, "type">): SelectNode {
  return {
    type: "select",
    ...config,
    options: [...config.options],
  }
}
