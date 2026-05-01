import type { Action, ComponentBase } from "../core"
import type { ComponentNode } from "../component"
import type { ButtonNode } from "./button"

export type FormNode = ComponentBase & {
  type: "form"
  id: string
  fields: ComponentNode[]
  submitButton?: ButtonNode
  onSubmit?: Action
  onSignal?: Action
}

export function Form(config: Omit<FormNode, "type">): FormNode {
  return {
    type: "form",
    ...config,
    fields: [...config.fields],
  }
}
