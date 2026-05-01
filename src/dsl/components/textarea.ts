import type { ComponentBase } from "../core"

export type TextAreaNode = ComponentBase & {
  type: "textarea"
  name: string
  label?: string
  placeholder?: string
  required?: boolean
  rows?: number
}

export function TextArea(config: Omit<TextAreaNode, "type">): TextAreaNode {
  return {
    type: "textarea",
    ...config,
  }
}
