import type { ComponentBase } from "../core"

export type TextAreaNode = ComponentBase & {
  type: "textarea"
  name: string
  label?: string
  placeholder?: string
  required?: boolean
  rows?: number
  /**
   * Enclosing Island handler to invoke, and on which DOM event.
   *
   * Without this a textarea inside an Island is inert: an island reads its
   * controls only through the handlers bindIslandEvents dispatches, so a
   * multi-line field — a JSON request body, a list of CIDRs — could be typed
   * into but never read. Defaults to the input event, which fires per keystroke;
   * "change" fires once on blur, which is what a field the island only needs the
   * final value of wants.
   */
  islandHandler?: string
  islandEvent?: "input" | "change" | "keydown"
}

export function TextArea(config: Omit<TextAreaNode, "type">): TextAreaNode {
  return {
    type: "textarea",
    ...config,
  }
}
