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
  /**
   * Name of the enclosing Island's handler to invoke on submit, instead of the
   * built-in POST to /api/form/<id>. Set this when the form needs to control its
   * own request — a multipart upload, a different endpoint, or its own error
   * rendering. The handler receives the submit event and must call
   * preventDefault() itself.
   */
  islandHandler?: string
}

export function Form(config: Omit<FormNode, "type">): FormNode {
  return {
    type: "form",
    ...config,
    fields: [...config.fields],
  }
}
