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
  /** Enclosing Island handler to invoke, and on which DOM event. */
  islandHandler?: string
  islandEvent?: "change" | "input"
}

export function Select(config: Omit<SelectNode, "type">): SelectNode {
  return {
    type: "select",
    ...config,
    options: [...config.options],
  }
}
