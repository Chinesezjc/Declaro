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
  /**
   * Value of the option to pre-select. Without it the browser selects the first
   * option, so a form whose default is not the first one has to be corrected by
   * script after load.
   *
   * A value matching no option selects nothing, which for a single select means
   * the browser falls back to the first option.
   */
  defaultValue?: string
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
